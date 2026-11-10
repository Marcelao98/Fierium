// Motor de PDF (pdf.js): rolagem vertical contínua. Todas as páginas têm o tamanho reservado, mas só as que estão
// perto da tela (±2) têm canvas; o arquivo é lido aos pedaços (Range), então PDFs de centenas de MB abrem rápido.
// Posição = "pagina:fracao" (ex.: "37:0.42"). Marcações e seleção de texto no PDF ainda não existem.
import type { ConfigLeitura } from '@fierium/contratos';
import * as pdfjs from 'pdfjs-dist';
import {
  PDFDataRangeTransport,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { MotorDeLeitura, OpcoesMotor, SessaoLeitura } from '../motor';
import './pdf.css';
import {
  escalaBase,
  filtroDoTema,
  formatarPosicao,
  lerPosicao,
  limitarZoom,
  paginaEm,
  type PosicaoPdf,
} from './posicao';

const MARGEM = 2; // páginas desenhadas além das visíveis
const ESPACO = 12; // px entre páginas

interface Pagina {
  el: HTMLDivElement;
  w: number; // unidades do PDF (escala 1)
  h: number;
  canvas: HTMLCanvasElement | null;
  desenhadaEm: number; // escala*dpr do canvas atual
  tarefa: RenderTask | null;
  pedido: number; // contador pra ignorar desenhos antigos
  conhecida: boolean; // dimensões reais já lidas
}

export function classificarErro(e: unknown): { codigo: string; mensagem: string } {
  const nome = (e as { name?: string } | null)?.name;
  if (nome === 'PasswordException')
    return { codigo: 'PDF_PROTEGIDO', mensagem: 'Este PDF tem senha, e ainda não sei abrir PDF protegido.' };
  return { codigo: 'PDF_ILEGIVEL', mensagem: 'Não consegui ler este PDF: o arquivo está danificado ou não é um PDF.' };
}

let workerConfigurado = false;
function configurarWorker() {
  if (workerConfigurado) return;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  workerConfigurado = true;
}

/** O pdf.js só habilita Range automaticamente em URLs HTTP(S); `fierium://` precisa de um transporte explícito. */
class TransportePdf extends PDFDataRangeTransport {
  constructor(
    readonly url: string,
    tamanho: number,
    dadosIniciais: Uint8Array,
    private readonly falha: (e: unknown) => void,
  ) {
    super(tamanho, dadosIniciais);
  }

  override requestDataRange(inicio: number, fim: number) {
    void fetch(this.url, { headers: { Range: `bytes=${inicio}-${fim - 1}` } })
      .then(async (r) => {
        if (r.status !== 206) throw new Error(`resposta ${r.status} ao pedir bytes ${inicio}-${fim - 1}`);
        const intervalo = r.headers.get('Content-Range');
        if (!intervalo?.startsWith(`bytes ${inicio}-`))
          throw new Error(`intervalo inesperado: ${intervalo ?? 'ausente'}`);
        this.onDataRange(inicio, new Uint8Array(await r.arrayBuffer()));
      })
      .catch((e: unknown) => {
        this.falha(e);
        this.onDataRange(inicio, new Uint8Array());
      });
  }
}

export const motorPdf: MotorDeLeitura = {
  nome: 'pdf',
  aceita: (f) => f.tipo === 'arquivo' && f.formato === 'pdf',
  async montar(alvo: HTMLElement, op: OpcoesMotor): Promise<SessaoLeitura> {
    if (op.fonte.tipo !== 'arquivo') throw new Error('motor de PDF recebeu outro conteúdo');
    const fonte = op.fonte;
    const doc = alvo.ownerDocument;
    const rolagem = doc.createElement('div');
    rolagem.className = 'fl-pdf';
    rolagem.tabIndex = 0;
    const lista = doc.createElement('div');
    lista.className = 'fl-pdf-lista';
    rolagem.append(lista);
    alvo.append(rolagem);

    let desmontada = false;
    const sessaoVazia = (): SessaoLeitura => ({
      aplicarAparencia: () => undefined,
      mostrarMarcacoes: () => undefined,
      irPara: () => undefined,
      limparSelecao: () => undefined,
      desmontar() {
        rolagem.remove();
      },
    });

    configurarWorker();
    const controle: { transporte?: TransportePdf; tarefa?: PDFDocumentLoadingTask } = {};
    const tarefaCarga = (async () => {
      const resposta = await fetch(fonte.url, { headers: { Range: 'bytes=0-65535' } });
      if (resposta.status !== 206) throw new Error(`resposta ${resposta.status} ao pedir os bytes iniciais do PDF`);
      const contentRange = resposta.headers.get('Content-Range');
      if (!contentRange?.startsWith('bytes 0-'))
        throw new Error(`intervalo inicial inesperado: ${contentRange ?? 'ausente'}`);
      const dados = new Uint8Array(await resposta.arrayBuffer());
      controle.transporte = new TransportePdf(fonte.url, fonte.tamanho, dados, (e) => {
        op.eventos.erro('PDF_INTERVALO', 'Não consegui carregar uma parte deste PDF.', String(e));
      });
      controle.transporte.transportReady();
      controle.tarefa = pdfjs.getDocument({ range: controle.transporte });
      return controle.tarefa.promise;
    })();
    let documento: PDFDocumentProxy;
    let primeira: PDFPageProxy;
    try {
      documento = await tarefaCarga;
      primeira = await documento.getPage(1);
    } catch (e) {
      const { codigo, mensagem } = classificarErro(e);
      op.eventos.erro(codigo, mensagem, e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      controle.transporte?.abort();
      return sessaoVazia();
    }
    const n = documento.numPages;
    const v1 = primeira.getViewport({ scale: 1 });
    const paginas: Pagina[] = [];
    for (let i = 0; i < n; i++) {
      const el = doc.createElement('div');
      el.className = 'fl-pdf-pagina';
      el.dataset.pagina = String(i + 1);
      lista.append(el);
      paginas.push({
        el,
        w: v1.width,
        h: v1.height,
        canvas: null,
        desenhadaEm: 0,
        tarefa: null,
        pedido: 0,
        conhecida: false,
      });
    }
    paginas[0]!.conhecida = true;
    const cache = new Map<number, PDFPageProxy>([[1, primeira]]);

    let zoom = 1;
    let aparencia: ConfigLeitura = op.aparencia;
    let topos: number[] = [];
    let base = 1;
    const visiveis = new Set<number>();
    const dpr = () => Math.min(2, doc.defaultView?.devicePixelRatio || 1);
    const escala = () => base * zoom;

    function disposicao() {
      let y = ESPACO;
      let maior = 0;
      topos = paginas.map((p) => {
        const t = y;
        const altura = p.h * escala();
        p.el.style.top = `${t}px`;
        p.el.style.width = `${p.w * escala()}px`;
        p.el.style.height = `${altura}px`;
        maior = Math.max(maior, p.w * escala());
        y += altura + ESPACO;
        return t;
      });
      lista.style.height = `${y}px`;
      lista.style.width = `${maior + 2 * ESPACO}px`;
    }

    function posicaoAtual(): PosicaoPdf {
      if (!topos.length) return { pagina: 1, fracao: 0 };
      const i = paginaEm(topos, rolagem.scrollTop + 1);
      const altura = paginas[i]!.h * escala();
      return { pagina: i + 1, fracao: Math.min(1, Math.max(0, (rolagem.scrollTop - topos[i]!) / altura)) };
    }

    function rolarPara(p: PosicaoPdf) {
      const i = Math.min(n, Math.max(1, p.pagina)) - 1;
      rolagem.scrollTop = topos[i]! + p.fracao * paginas[i]!.h * escala();
    }

    /** Refaz o layout mantendo o ponto de leitura no mesmo lugar. */
    function redisporMantendo() {
      const p = posicaoAtual();
      disposicao();
      rolarPara(p);
    }

    async function pagina(i: number): Promise<PDFPageProxy> {
      let p = cache.get(i + 1);
      if (!p) {
        p = await documento.getPage(i + 1);
        cache.set(i + 1, p);
      }
      return p;
    }

    function liberar(i: number) {
      const p = paginas[i]!;
      p.pedido++;
      p.tarefa?.cancel();
      p.tarefa = null;
      if (p.canvas) {
        p.canvas.width = 0; // devolve a memória do bitmap
        p.canvas.remove();
        p.canvas = null;
      }
      p.desenhadaEm = 0;
      delete p.el.dataset.pronta;
      const pg = cache.get(i + 1);
      if (pg && i !== 0) {
        pg.cleanup();
        cache.delete(i + 1);
      }
    }

    async function desenhar(i: number) {
      const p = paginas[i]!;
      const chave = escala() * dpr();
      if (p.canvas && p.desenhadaEm === chave) return;
      const meu = ++p.pedido;
      p.tarefa?.cancel();
      try {
        const pg = await pagina(i);
        if (desmontada || meu !== p.pedido) return;
        if (!p.conhecida) {
          const v = pg.getViewport({ scale: 1 });
          p.conhecida = true;
          if (Math.abs(v.width - p.w) > 0.5 || Math.abs(v.height - p.h) > 0.5) {
            p.w = v.width;
            p.h = v.height;
            redisporMantendo();
          }
        }
        const vp = pg.getViewport({ scale: escala() * dpr() });
        const canvas = doc.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(vp.width));
        canvas.height = Math.max(1, Math.floor(vp.height));
        canvas.className = 'fl-pdf-canvas';
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const tarefa = pg.render({ canvasContext: ctx, viewport: vp });
        p.tarefa = tarefa;
        await tarefa.promise;
        if (desmontada || meu !== p.pedido) return;
        canvas.style.filter = filtroDoTema(aparencia.tema);
        p.canvas?.remove();
        p.canvas = canvas;
        p.desenhadaEm = chave;
        p.tarefa = null;
        p.el.append(canvas);
        p.el.dataset.pronta = 'sim';
      } catch (e) {
        if ((e as { name?: string } | null)?.name === 'RenderingCancelledException') return;
        if (meu === p.pedido) op.eventos.erro('PDF_PAGINA', `Não consegui desenhar a página ${i + 1} do PDF.`);
      }
    }

    function atualizarJanela() {
      if (desmontada) return;
      const meio = paginaEm(topos, rolagem.scrollTop + rolagem.clientHeight / 2);
      let ini = meio;
      let fim = meio;
      if (visiveis.size) {
        ini = Math.min(...visiveis);
        fim = Math.max(...visiveis);
      }
      ini = Math.max(0, ini - MARGEM);
      fim = Math.min(n - 1, fim + MARGEM);
      for (let i = 0; i < n; i++) {
        if ((i < ini || i > fim) && (paginas[i]!.canvas || paginas[i]!.tarefa)) liberar(i);
      }
      const ordem: number[] = [];
      for (let i = ini; i <= fim; i++) ordem.push(i);
      ordem.sort((a, b) => Math.abs(a - meio) - Math.abs(b - meio));
      for (const i of ordem) void desenhar(i);
    }

    const observador =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entradas) => {
              for (const e of entradas) {
                const i = Number((e.target as HTMLElement).dataset.pagina) - 1;
                if (e.isIntersecting) visiveis.add(i);
                else visiveis.delete(i);
              }
              atualizarJanela();
            },
            { root: rolagem, rootMargin: '50px 0px' },
          );
    for (const p of paginas) observador?.observe(p.el);

    // posição → casca (com atraso)
    let temporizadorPosicao: ReturnType<typeof setTimeout> | undefined;
    const avisarPosicao = () => {
      clearTimeout(temporizadorPosicao);
      temporizadorPosicao = setTimeout(() => {
        const p = posicaoAtual();
        const fracao = (p.pagina - 1 + p.fracao) / n;
        op.eventos.posicao(formatarPosicao(p), Math.min(1, Math.max(0, fracao)));
      }, 400);
    };
    const aoRolar = () => {
      if (!observador) atualizarJanela();
      avisarPosicao();
    };
    rolagem.addEventListener('scroll', aoRolar, { passive: true });

    // zoom: Ctrl + roda, Ctrl +/−/0
    let temporizadorZoom: ReturnType<typeof setTimeout> | undefined;
    function mudarZoom(novo: number) {
      const z = limitarZoom(novo);
      if (z === zoom) return;
      const p = posicaoAtual();
      zoom = z;
      disposicao();
      rolarPara(p);
      // enquanto muda, os canvas velhos esticam (CSS); redesenha nítido depois de parar
      clearTimeout(temporizadorZoom);
      temporizadorZoom = setTimeout(atualizarJanela, 250);
    }
    const aoRoda = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      mudarZoom(zoom * Math.exp(-e.deltaY * 0.002));
    };
    rolagem.addEventListener('wheel', aoRoda, { passive: false });
    const aoTeclar = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '+' || e.key === '=') mudarZoom(zoom * 1.15);
      else if (e.key === '-' || e.key === '_') mudarZoom(zoom / 1.15);
      else if (e.key === '0') mudarZoom(1);
      else return;
      e.preventDefault();
    };
    doc.addEventListener('keydown', aoTeclar);

    // toque: clique sem arrastar
    let inicio: { x: number; y: number } | null = null;
    const aoApertar = (e: PointerEvent) => (inicio = { x: e.clientX, y: e.clientY });
    const aoSoltar = (e: PointerEvent) => {
      if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 6) op.eventos.toque();
      inicio = null;
    };
    rolagem.addEventListener('pointerdown', aoApertar);
    rolagem.addEventListener('pointerup', aoSoltar);

    // largura do alvo mudou: reajusta a escala base
    let larguraVista = 0;
    const redim =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            const l = rolagem.clientWidth;
            if (!l || l === larguraVista) return;
            larguraVista = l;
            base = escalaBase(l, paginas[0]!.w);
            redisporMantendo();
            atualizarJanela();
          });
    redim?.observe(rolagem);

    function aplicarTema(a: ConfigLeitura) {
      aparencia = a;
      rolagem.dataset.tema = a.tema;
      const f = filtroDoTema(a.tema);
      for (const p of paginas) if (p.canvas) p.canvas.style.filter = f;
    }

    larguraVista = rolagem.clientWidth;
    base = escalaBase(larguraVista || alvo.clientWidth || 800, paginas[0]!.w);
    disposicao();
    aplicarTema(op.aparencia);
    const inicial = op.alvo && 'posicao' in op.alvo ? lerPosicao(op.alvo.posicao) : null;
    if (inicial) rolarPara(inicial);
    atualizarJanela();

    return {
      aplicarAparencia: aplicarTema,
      mostrarMarcacoes: () => undefined, // PDF ainda sem marcações
      limparSelecao: () => undefined,
      irPara(a) {
        if (!('posicao' in a)) return;
        const p = lerPosicao(a.posicao);
        if (p) {
          rolarPara(p);
          atualizarJanela();
        }
      },
      desmontar() {
        desmontada = true;
        clearTimeout(temporizadorPosicao);
        clearTimeout(temporizadorZoom);
        observador?.disconnect();
        redim?.disconnect();
        doc.removeEventListener('keydown', aoTeclar);
        for (let i = 0; i < n; i++) liberar(i);
        rolagem.remove();
        void controle.tarefa?.destroy();
      },
    };
  },
};
