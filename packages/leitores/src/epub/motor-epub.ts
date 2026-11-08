// Motor de EPUB (epub.js): um capítulo por vez, rolando. Posição = CFI. Marcações ainda não (fica pro próximo passo).
import type { ConfigLeitura } from '@fierium/contratos';
import ePub from 'epubjs';
import { ErroLeitor, type MotorDeLeitura, type OpcoesMotor, type SessaoLeitura } from '../motor';
import { estiloDoCorpo, regrasGerais } from './aparencia';
import { fontFacesDe } from './fontes';

// o epub.js não traz tipos completos; usamos só o que precisamos
/* eslint-disable @typescript-eslint/no-explicit-any */

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
      rendition = book.renderTo(palco, { flow: 'scrolled-doc', width: '100%', height: '100%' });
    } catch (e) {
      raiz.remove();
      return falhar(e instanceof Error ? e.message : 'formato inválido');
    }

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

    rendition.hooks.content.register((contents: any) => {
      const d: Document = contents.document;
      if (fontFaces) {
        const st = d.createElement('style');
        st.textContent = fontFaces;
        d.head.append(st);
      }
      d.addEventListener('keydown', tecla);
      d.addEventListener('click', (e) => {
        if (d.getSelection()?.toString()) return;
        if ((e.target as Element | null)?.closest?.('a[href]')) return;
        op.eventos.toque();
      });
    });

    aplicar();
    const inicio = op.alvo && 'posicao' in op.alvo && op.alvo.posicao ? op.alvo.posicao : undefined;
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
      await book.opened; // rejeita quando o zip ou o OPF não abrem (o ready sozinho ficaria esperando)
      await book.ready;
      try {
        await rendition.display(inicio);
      } catch (e) {
        if (!inicio) throw e;
        // CFI que não vale mais (arquivo trocado): abre do começo em vez de falhar
        await rendition.display();
      }
    } catch (e) {
      desfazer();
      return falhar(e instanceof Error ? e.message : 'sem conteúdo');
    }

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
      mostrarMarcacoes() {
        // marcações no EPUB: próximo passo
      },
      irPara(a) {
        if ('posicao' in a && a.posicao) void rendition.display(a.posicao);
      },
      limparSelecao() {
        // sem marcações ainda, não há seleção a limpar
      },
      desmontar() {
        vivo = false;
        desfazer();
      },
    };
  },
};
