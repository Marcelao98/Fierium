// Motor de EPUB (epub.js): um capítulo por vez, rolando. Posição = CFI. Marcações: seleção vira âncora
// { cfiInicio, cfiFim }, o realce é um highlight do epub.js (SVG por cima do texto) e o clique numa marcação é
// resolvido aqui, pelos retângulos do trecho (assim não depende dos eventos do SVG).
import type { ConfigLeitura, CorMarcacao, Marcacao } from '@fierium/contratos';
import ePub from 'epubjs';
import {
  caixaDe,
  ErroLeitor,
  type Caixa,
  type MotorDeLeitura,
  type OpcoesMotor,
  type Selecao,
  type SessaoLeitura,
} from '../motor';
import { estiloDoCorpo, regrasGerais } from './aparencia';
import { fontFacesDe } from './fontes';

// o epub.js não traz tipos completos; usamos só o que precisamos
/* eslint-disable @typescript-eslint/no-explicit-any */

/** "epubcfi(/6/4!/4/2,/1:0,/1:10)" → início e fim, cada um um CFI de ponto. */
export function dividirCfi(intervalo: string): { cfiInicio: string; cfiFim: string } | null {
  const m = /^epubcfi\((.*)\)$/.exec(intervalo);
  const partes = m?.[1]?.split(',');
  if (!partes || partes.length !== 3) return null;
  const [base, a, b] = partes as [string, string, string];
  return { cfiInicio: `epubcfi(${base}${a})`, cfiFim: `epubcfi(${base}${b})` };
}

/** O contrário: dois CFIs de ponto → o CFI de intervalo que o epub.js usa pra realçar. */
export function juntarCfi(cfiInicio: string, cfiFim: string): string | null {
  const ini = /^epubcfi\((.*)\)$/.exec(cfiInicio)?.[1];
  const fim = /^epubcfi\((.*)\)$/.exec(cfiFim)?.[1];
  if (ini === undefined || fim === undefined) return null;
  let n = 0;
  while (n < ini.length && n < fim.length && ini[n] === fim[n]) n++;
  const corte = ini.slice(0, n).lastIndexOf('/');
  if (corte < 0) return `epubcfi(,${ini},${fim})`;
  return `epubcfi(${ini.slice(0, corte)},${ini.slice(corte)},${fim.slice(corte)})`;
}

const TEMPO_LIMITE_MS = 30_000;

/** Tira do capítulo tudo o que executaria código do livro: <script>, atributos on* e endereços javascript:. */
export function tirarScripts(capitulo: Document): void {
  for (const el of [...capitulo.querySelectorAll('script')]) el.remove();
  for (const el of capitulo.querySelectorAll('*')) {
    for (const at of [...el.attributes]) {
      const nome = at.name.toLowerCase();
      if (nome.startsWith('on')) el.removeAttribute(at.name);
      else if ((nome === 'href' || nome === 'xlink:href' || nome === 'src') && /^\s*javascript:/i.test(at.value))
        el.removeAttribute(at.name);
    }
  }
}

export const motorEpub: MotorDeLeitura = {
  nome: 'epub',
  aceita: (f) => f.tipo === 'arquivo' && f.formato === 'epub',
  async montar(alvo: HTMLElement, op: OpcoesMotor): Promise<SessaoLeitura> {
    const fonte = op.fonte;
    if (fonte.tipo !== 'arquivo') throw new Error('motor de EPUB recebeu outro conteúdo');
    const doc = alvo.ownerDocument;
    const falhar = (detalhe: string): never => {
      const mensagem = `Não consegui abrir este EPUB (${detalhe}).`;
      op.eventos.erro('EPUB_ILEGIVEL', mensagem);
      throw new ErroLeitor('EPUB_ILEGIVEL', mensagem);
    };

    let dados: ArrayBuffer;
    try {
      const r = await fetch(fonte.url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      dados = await r.arrayBuffer();
    } catch (e) {
      return falhar(e instanceof Error ? e.message : 'arquivo inacessível');
    }

    // todo EPUB é um zip ("PK"); o epub.js não avisa quando recebe outra coisa, então conferimos antes
    const cab = new Uint8Array(dados, 0, Math.min(4, dados.byteLength));
    if (cab[0] !== 0x50 || cab[1] !== 0x4b) return falhar('não é um arquivo EPUB (zip)');

    const raiz = doc.createElement('div');
    raiz.className = 'fl-epub';
    raiz.style.cssText = 'position:relative;width:100%;height:100%;';
    const palco = doc.createElement('div');
    palco.style.cssText = 'width:100%;height:100%;';
    raiz.append(palco);
    const botao = (rotulo: string, texto: string, lado: 'left' | 'right') => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'fl-epub-nav';
      b.setAttribute('aria-label', rotulo);
      b.textContent = texto;
      b.style.cssText = `position:absolute;${lado}:8px;top:50%;transform:translateY(-50%);z-index:5;width:40px;height:56px;border:0;border-radius:12px;background:rgba(127,127,127,.28);color:inherit;font-size:22px;cursor:pointer;opacity:.7;`;
      return b;
    };
    const anterior = botao('Capítulo anterior', '‹', 'left');
    const proximo = botao('Próximo capítulo', '›', 'right');
    raiz.append(anterior, proximo);
    alvo.append(raiz);

    let book: any;
    let rendition: any;
    try {
      book = (ePub as any)(dados);
      // O WebKit (o app no Linux e no Mac) não roda NENHUM ouvinte de evento num iframe sem 'allow-scripts', nem os
      // nossos: sem isto, dentro do capítulo não há clique, seleção, botão direito nem teclado. Em troca, os scripts
      // do próprio livro são arrancados antes de o capítulo ser montado (e a CSP do app também não os deixa rodar).
      book.spine.hooks.content.register((capitulo: Document) => tirarScripts(capitulo));
      rendition = book.renderTo(palco, {
        flow: 'scrolled-doc',
        width: '100%',
        height: '100%',
        allowScriptedContent: true,
      });
    } catch (e) {
      raiz.remove();
      return falhar(e instanceof Error ? e.message : 'formato inválido');
    }

    let marcacoes: Marcacao[] = op.marcacoes;
    let cores: CorMarcacao[] = op.cores;
    let selecionada: string | null = null;
    let comSelecao = false;
    // marcador de página (tipo 'marcador') só lembra o lugar: não tem trecho pra realçar
    const cfiDe = (m: Marcacao) =>
      m.ancora.tipo === 'epub' && m.tipo !== 'marcador' ? juntarCfi(m.ancora.cfiInicio, m.ancora.cfiFim) : null;
    let ap: ConfigLeitura = { ...op.aparencia };
    const fontFaces = fontFacesDe(doc);
    const aplicar = () => {
      const corpo = estiloDoCorpo(ap);
      raiz.style.background = corpo.background!;
      rendition.themes.default(regrasGerais(ap));
      for (const [k, v] of Object.entries(corpo)) rendition.themes.override(k, v);
    };

    let ultimoCfi = '';
    let ultimoIndice = 0;
    let locaisProntas = false;
    const emitir = () => {
      if (!ultimoCfi) return;
      let f: number;
      if (locaisProntas) f = book.locations.percentageFromCfi(ultimoCfi) ?? 0;
      else {
        const n = book.spine?.length ?? 1;
        f = n > 1 ? ultimoIndice / (n - 1) : 0;
      }
      op.eventos.posicao(ultimoCfi, Math.round(Math.min(1, Math.max(0, f)) * 1000) / 1000);
    };
    rendition.on('relocated', (loc: any) => {
      ultimoCfi = loc.start.cfi;
      ultimoIndice = loc.start.index ?? 0;
      emitir();
    });

    const navegar = (dir: 1 | -1) => void (dir > 0 ? rendition.next() : rendition.prev());
    anterior.addEventListener('click', () => navegar(-1));
    proximo.addEventListener('click', () => navegar(1));
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') navegar(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') navegar(-1);
      else return;
      e.preventDefault();
    };
    doc.addEventListener('keydown', tecla);

    /** onde o intervalo está na tela (o iframe do capítulo desloca as coordenadas) */
    const retangulosNaTela = (contents: any, cfi: string): DOMRect[] => {
      const range: Range | null = contents.range(cfi);
      if (!range) return [];
      const quadro = (contents.document.defaultView as Window | null)?.frameElement?.getBoundingClientRect();
      const dx = quadro?.left ?? 0;
      const dy = quadro?.top ?? 0;
      return [...range.getClientRects()].map((r) => new DOMRect(r.left + dx, r.top + dy, r.width, r.height));
    };
    const marcaEm = (contents: any, x: number, y: number): { id: string; caixa: Caixa } | null => {
      for (let i = marcacoes.length - 1; i >= 0; i--) {
        const m = marcacoes[i]!;
        const cfi = cfiDe(m);
        if (!cfi) continue;
        try {
          const dentro = retangulosNaTela(contents, cfi).find(
            (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
          );
          if (dentro) return { id: m.id, caixa: caixaDe(dentro) };
        } catch {
          // o trecho é de outro capítulo (não está neste documento): não é esta marcação
        }
      }
      return null;
    };

    rendition.on('selected', (cfiRange: string, contents: any) => {
      const partes = dividirCfi(cfiRange);
      const trecho = String(contents.range(cfiRange)?.toString() ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      const r = retangulosNaTela(contents, cfiRange)[0];
      if (!partes || !trecho || !r) return;
      comSelecao = true;
      op.eventos.selecao({ ancora: { tipo: 'epub', ...partes }, trecho, caixa: caixaDe(r) });
    });

    rendition.hooks.content.register((contents: any) => {
      const d: Document = contents.document;
      if (fontFaces) {
        const st = d.createElement('style');
        st.textContent = fontFaces;
        d.head.append(st);
      }
      d.addEventListener('keydown', tecla);
      d.addEventListener('selectionchange', () => {
        // a seleção sumiu (clicou fora): avisa pra fechar o balão
        if (comSelecao && d.getSelection()?.isCollapsed) {
          comSelecao = false;
          op.eventos.selecao(null);
        }
      });
      /** a seleção deste capítulo como o motor entrega (âncora + trecho + onde está na tela) */
      const selecaoDoCapitulo = (): Selecao | null => {
        const s = d.getSelection();
        if (!s || s.isCollapsed || !s.rangeCount) return null;
        const rg = s.getRangeAt(0);
        const partes = dividirCfi(String(contents.cfiFromRange(rg)));
        const trecho = rg.toString().replace(/\s+/g, ' ').trim();
        const quadro = (d.defaultView as Window | null)?.frameElement?.getBoundingClientRect();
        const r = rg.getClientRects()[0];
        if (!partes || !trecho || !r) return null;
        return {
          ancora: { tipo: 'epub', ...partes },
          trecho,
          caixa: caixaDe(new DOMRect(r.left + (quadro?.left ?? 0), r.top + (quadro?.top ?? 0), r.width, r.height)),
        };
      };
      // botão direito: o menu é da casca (o do navegador não abre, nem aqui dentro do iframe)
      d.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const quadro = (d.defaultView as Window | null)?.frameElement?.getBoundingClientRect();
        const x = e.clientX + (quadro?.left ?? 0);
        const y = e.clientY + (quadro?.top ?? 0);
        const sel = selecaoDoCapitulo();
        const marca = marcaEm(contents, x, y);
        const naSelecao =
          !!sel &&
          sel.caixa.x <= x &&
          x <= sel.caixa.x + sel.caixa.largura &&
          sel.caixa.y <= y &&
          y <= sel.caixa.y + sel.caixa.altura;
        op.eventos.menu?.({
          x,
          y,
          selecao: marca && !naSelecao ? null : sel,
          marcacaoId: marca && !naSelecao ? marca.id : null,
        });
      });
      // a tecla Menu / Shift+F10 e os atalhos da casca (Ctrl+Shift+N, Ctrl+Shift+C) valem aqui dentro também (o foco fica no iframe)
      d.addEventListener('keydown', (e) => {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          const sel = selecaoDoCapitulo();
          op.eventos.menu?.({
            x: sel ? sel.caixa.x + sel.caixa.largura / 2 : innerWidth / 2,
            y: sel ? sel.caixa.y + sel.caixa.altura : innerHeight / 3,
            selecao: sel,
            marcacaoId: null,
          });
        } else if (e.ctrlKey && e.shiftKey && ['n', 'c'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          doc.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, ctrlKey: true, shiftKey: true, bubbles: true }));
        }
      });
      d.addEventListener('click', (e) => {
        if (d.getSelection()?.toString()) return;
        if ((e.target as Element | null)?.closest?.('a[href]')) return;
        const quadro = (d.defaultView as Window | null)?.frameElement?.getBoundingClientRect();
        const marca = marcaEm(contents, e.clientX + (quadro?.left ?? 0), e.clientY + (quadro?.top ?? 0));
        if (marca) op.eventos.marcacaoClicada(marca.id, marca.caixa);
        else op.eventos.toque();
      });
    });

    // botão direito que cai no realce (o SVG fica no documento da casca, por cima do iframe): mesmo menu
    const aoMenuNaCasca = (e: MouseEvent) => {
      e.preventDefault();
      const contents = (rendition.getContents?.() ?? []) as any[];
      let marca: { id: string; caixa: Caixa } | null = null;
      for (const c of contents) marca ??= marcaEm(c, e.clientX, e.clientY);
      op.eventos.menu?.({ x: e.clientX, y: e.clientY, selecao: null, marcacaoId: marca?.id ?? null });
    };
    raiz.addEventListener('contextmenu', aoMenuNaCasca);

    aplicar();
    const cfiInicioDe = (id: string): string | undefined => {
      const m = marcacoes.find((x) => x.id === id);
      return m?.ancora.tipo === 'epub' ? m.ancora.cfiInicio : undefined;
    };
    const inicio =
      op.alvo && 'posicao' in op.alvo
        ? op.alvo.posicao || undefined
        : op.alvo && 'marcacaoId' in op.alvo
          ? cfiInicioDe(op.alvo.marcacaoId)
          : undefined;

    // realces: o epub.js guarda e reaplica a cada capítulo que abre
    let realces: string[] = [];
    let avisouRealce = false;
    const desenharRealces = () => {
      for (const cfi of realces) {
        try {
          rendition.annotations.remove(cfi, 'highlight');
        } catch {
          // já removido junto com o capítulo
        }
      }
      realces = [];
      for (const m of marcacoes) {
        const cfi = cfiDe(m);
        if (!cfi) continue;
        const cor = cores.find((c) => c.id === m.cor)?.cor ?? '#a99be6';
        try {
          rendition.annotations.highlight(
            cfi,
            { id: m.id },
            undefined,
            'fl-realce',
            selecionada === m.id
              ? { fill: cor, 'fill-opacity': '0.4', 'mix-blend-mode': 'normal', stroke: cor, 'stroke-width': '2' }
              : { fill: cor, 'fill-opacity': '0.38', 'mix-blend-mode': 'normal' },
          );
          realces.push(cfi);
        } catch (e) {
          if (!avisouRealce) {
            avisouRealce = true;
            op.eventos.erro('EPUB_MARCACAO', 'Não consegui pintar uma marcação neste EPUB.', String(e));
          }
        }
      }
    };
    const desfazer = () => {
      try {
        rendition.destroy();
        book.destroy();
      } catch {
        // já desmontado pelo epub.js
      }
      raiz.remove();
      doc.removeEventListener('keydown', tecla);
    };
    try {
      // um EPUB torto pode deixar o epub.js esperando pra sempre: depois do tempo limite vira erro, não tela parada
      const noTempo = <T>(p: Promise<T>): Promise<T> =>
        new Promise<T>((ok, falha) => {
          const t = setTimeout(() => falha(new Error('demorou demais pra abrir')), TEMPO_LIMITE_MS);
          p.then(
            (v) => (clearTimeout(t), ok(v)),
            (e: unknown) => (clearTimeout(t), falha(e instanceof Error ? e : new Error(String(e)))),
          );
        });
      await noTempo(book.opened); // rejeita quando o zip ou o OPF não abrem (o ready sozinho ficaria esperando)
      await noTempo(book.ready);
      try {
        await noTempo(rendition.display(inicio));
      } catch (e) {
        if (!inicio) throw e;
        // CFI que não vale mais (arquivo trocado): abre do começo em vez de falhar
        await noTempo(rendition.display());
      }
    } catch (e) {
      desfazer();
      return falhar(e instanceof Error ? e.message : 'sem conteúdo');
    }

    desenharRealces();

    // a porcentagem exata vem depois (gerar os pontos leva um tempo em livros grandes)
    let vivo = true;
    void Promise.resolve(book.locations.generate(1600))
      .then(() => {
        if (!vivo) return;
        locaisProntas = true;
        emitir();
      })
      .catch(() => {
        // sem os pontos fica a fração pela posição do capítulo; não é erro pra mostrar
      });

    return {
      aplicarAparencia(a) {
        ap = { ...a };
        aplicar();
      },
      mostrarMarcacoes(novas, novasCores, sel) {
        marcacoes = novas;
        cores = novasCores;
        selecionada = sel ?? null;
        desenharRealces();
      },
      irPara(a) {
        const alvoCfi = 'posicao' in a ? a.posicao : cfiInicioDe(a.marcacaoId);
        if (alvoCfi) void rendition.display(alvoCfi);
      },
      limparSelecao() {
        comSelecao = false;
        for (const c of rendition.getContents?.() ?? []) c.window?.getSelection()?.removeAllRanges();
      },
      desmontar() {
        vivo = false;
        desfazer();
      },
    };
  },
};
