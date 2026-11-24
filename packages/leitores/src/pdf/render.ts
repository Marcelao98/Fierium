// Páginas virtualizadas, parte 2: só as páginas perto da tela (±MARGEM) têm canvas e camada de texto; as outras
// devolvem a memória. Também a pintura do tema por cima dos pixels crus do pdf.js.
import { TextLayer, type PDFPageProxy } from 'pdfjs-dist';
import { redisporMantendo } from './layout';
import { paginaEm } from './posicao';
import { dprDe, escalaDe, MARGEM, type Contexto, type Pagina } from './tipos';

async function pegarPagina(c: Contexto, i: number): Promise<PDFPageProxy> {
  let p = c.cache.get(i + 1);
  if (!p) {
    p = await c.documento.getPage(i + 1);
    c.cache.set(i + 1, p);
  }
  return p;
}

export function liberar(c: Contexto, i: number): void {
  const p = c.paginas[i]!;
  p.pedido++;
  p.tarefa?.cancel();
  p.tarefa = null;
  if (p.canvas) {
    p.canvas.width = 0; // devolve a memória do bitmap
    p.canvas.remove();
    p.canvas = null;
  }
  p.desenhadaEm = 0;
  p.crua = null;
  p.textoPedido++;
  p.textoCamada?.cancel();
  p.textoCamada = null;
  p.texto?.remove();
  p.texto = null;
  delete p.el.dataset.pronta;
  const pg = c.cache.get(i + 1);
  if (pg && i !== 0) {
    pg.cleanup();
    c.cache.delete(i + 1);
  }
}

/** Aplica o tema da página no canvas (repintando a partir dos pixels crus). */
export function pintar(c: Contexto, p: Pagina): void {
  const canvas = p.canvas;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  if (c.pintor.identidade) {
    if (p.crua) ctx.putImageData(p.crua, 0, 0);
    p.crua = null;
    return;
  }
  const t0 = performance.now();
  p.crua ??= ctx.getImageData(0, 0, canvas.width, canvas.height);
  const saida = ctx.createImageData(p.crua.width, p.crua.height);
  c.pintor.pintar(saida.data, p.crua.data);
  ctx.putImageData(saida, 0, 0);
  c.rolagem.dataset.pinturaMs = (performance.now() - t0).toFixed(1);
}

/** A camada de texto transparente (pra selecionar): criada uma vez por página desenhada; acompanha o zoom por CSS. */
async function camadaDeTexto(c: Contexto, i: number, pg: PDFPageProxy): Promise<void> {
  const p = c.paginas[i]!;
  if (p.texto || !p.canvas) return;
  const meu = ++p.textoPedido;
  const div = c.doc.createElement('div');
  div.className = 'fl-pdf-texto';
  try {
    const camada = new TextLayer({
      textContentSource: pg.streamTextContent(),
      container: div,
      viewport: pg.getViewport({ scale: 1 }),
    });
    p.textoCamada = camada;
    await camada.render();
    if (c.desmontada || meu !== p.textoPedido) return;
    p.texto = div;
    p.el.append(div);
    p.el.dataset.texto = 'sim';
  } catch (e) {
    if ((e as { name?: string } | null)?.name === 'AbortException') return;
    if (meu === p.textoPedido) c.op.eventos.erro('PDF_TEXTO', `Não consegui ler o texto da página ${i + 1} do PDF.`);
  }
}

export async function desenhar(c: Contexto, i: number): Promise<void> {
  const p = c.paginas[i]!;
  const chave = escalaDe(c) * dprDe(c);
  if (p.canvas && p.desenhadaEm === chave) return;
  const meu = ++p.pedido;
  p.tarefa?.cancel();
  try {
    const pg = await pegarPagina(c, i);
    if (c.desmontada || meu !== p.pedido) return;
    if (!p.conhecida) {
      const v = pg.getViewport({ scale: 1 });
      p.conhecida = true;
      if (Math.abs(v.width - p.w) > 0.5 || Math.abs(v.height - p.h) > 0.5) {
        p.w = v.width;
        p.h = v.height;
        redisporMantendo(c);
      }
    }
    const vp = pg.getViewport({ scale: escalaDe(c) * dprDe(c) });
    const canvas = c.doc.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    canvas.className = 'fl-pdf-canvas';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const tarefa = pg.render({ canvasContext: ctx, viewport: vp });
    p.tarefa = tarefa;
    await tarefa.promise;
    if (c.desmontada || meu !== p.pedido) return;
    p.canvas?.remove();
    p.canvas = canvas;
    p.crua = null; // canvas novo, cru
    pintar(c, p);
    p.desenhadaEm = chave;
    p.tarefa = null;
    p.el.append(canvas);
    p.el.dataset.pronta = 'sim';
    void camadaDeTexto(c, i, pg);
  } catch (e) {
    if ((e as { name?: string } | null)?.name === 'RenderingCancelledException') return;
    if (meu === p.pedido) c.op.eventos.erro('PDF_PAGINA', `Não consegui desenhar a página ${i + 1} do PDF.`);
  }
}

/** Libera as páginas longe da tela e desenha as perto (a do meio primeiro). */
export function atualizarJanela(c: Contexto): void {
  if (c.desmontada) return;
  const meio = paginaEm(c.topos, c.rolagem.scrollTop + c.rolagem.clientHeight / 2);
  let ini = meio;
  let fim = meio;
  if (c.visiveis.size) {
    ini = Math.min(...c.visiveis);
    fim = Math.max(...c.visiveis);
  }
  ini = Math.max(0, ini - MARGEM);
  fim = Math.min(c.n - 1, fim + MARGEM);
  for (let i = 0; i < c.n; i++) {
    if ((i < ini || i > fim) && (c.paginas[i]!.canvas || c.paginas[i]!.tarefa)) liberar(c, i);
  }
  const ordem: number[] = [];
  for (let i = ini; i <= fim; i++) ordem.push(i);
  ordem.sort((a, b) => Math.abs(a - meio) - Math.abs(b - meio));
  for (const i of ordem) void desenhar(c, i);
}
