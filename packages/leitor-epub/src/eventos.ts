// Eventos do EPUB: o que acontece DENTRO do capítulo (iframe) e na casca em volta: seleção, botão direito, tecla Menu,
// clique numa marcação, setas pra virar capítulo e o aviso "a pessoa mexeu" dos modos de leitura.
import { caixaDe, type Caixa, type Selecao } from '@fierium/leitor-base';
import { dividirCfi } from './cfi';
import { fontFacesDe } from './fontes';
import { marcaEm, quadroDe, retangulosNaTela } from './marcacoes';
import { avisarInteracao, type CtxEpub, type Epubjs } from './tipos';

/** Os botões ‹ › sobre o livro (quem os cria os entrega aqui). */
export interface BotoesNav {
  anterior: HTMLElement;
  proximo: HTMLElement;
}

export function navegar(c: CtxEpub, dir: 1 | -1): void {
  void (dir > 0 ? c.rendition.next() : c.rendition.prev());
}

/** A seleção deste capítulo como o motor entrega (âncora + trecho + onde está na tela). */
function selecaoDoCapitulo(d: Document, contents: Epubjs): Selecao | null {
  const s = d.getSelection();
  if (!s || s.isCollapsed || !s.rangeCount) return null;
  const rg = s.getRangeAt(0);
  const partes = dividirCfi(String(contents.cfiFromRange(rg)));
  const trecho = rg.toString().replace(/\s+/g, ' ').trim();
  const { left, top } = quadroDe(d);
  const r = rg.getClientRects()[0];
  if (!partes || !trecho || !r) return null;
  return {
    ancora: { tipo: 'epub', ...partes },
    trecho,
    caixa: caixaDe(new DOMRect(r.left + left, r.top + top, r.width, r.height)),
  };
}

/** Liga tudo; devolve o que desfazer e o `limparSelecao` da sessão. */
export function ligarEventos(c: CtxEpub, botoes: BotoesNav): { desfazer(): void; limparSelecao(): void } {
  const { op, doc, rendition, raiz } = c;
  const fontFaces = fontFacesDe(doc);

  const aoClicarBotao = (dir: 1 | -1) => () => navegar(c, dir);
  const irAtras = aoClicarBotao(-1);
  const irAdiante = aoClicarBotao(1);
  botoes.anterior.addEventListener('click', irAtras);
  botoes.proximo.addEventListener('click', irAdiante);
  const tecla = (e: KeyboardEvent) => {
    avisarInteracao(c);
    if (e.key === 'ArrowRight' || e.key === 'PageDown') navegar(c, 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') navegar(c, -1);
    else return;
    e.preventDefault();
  };
  doc.addEventListener('keydown', tecla);

  rendition.on('selected', (cfiRange: string, contents: Epubjs) => {
    const partes = dividirCfi(cfiRange);
    const trecho = String(contents.range(cfiRange)?.toString() ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const r = retangulosNaTela(contents, cfiRange)[0];
    if (!partes || !trecho || !r) return;
    c.comSelecao = true;
    op.eventos.selecao({ ancora: { tipo: 'epub', ...partes }, trecho, caixa: caixaDe(r) });
  });

  rendition.hooks.content.register((contents: Epubjs) => {
    const d: Document = contents.document;
    if (fontFaces) {
      const st = d.createElement('style');
      st.textContent = fontFaces;
      d.head.append(st);
    }
    const mexeu = () => avisarInteracao(c);
    for (const e of ['wheel', 'touchstart', 'pointerdown']) d.addEventListener(e, mexeu, { passive: true });
    d.addEventListener('keydown', tecla);
    d.addEventListener('selectionchange', () => {
      // a seleção sumiu (clicou fora): avisa pra fechar o balão
      if (c.comSelecao && d.getSelection()?.isCollapsed) {
        c.comSelecao = false;
        op.eventos.selecao(null);
      }
    });
    // botão direito: o menu é da casca (o do navegador não abre, nem aqui dentro do iframe)
    d.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const q = quadroDe(d);
      const x = e.clientX + q.left;
      const y = e.clientY + q.top;
      const sel = selecaoDoCapitulo(d, contents);
      const marca = marcaEm(c, contents, x, y);
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
        const sel = selecaoDoCapitulo(d, contents);
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
      const q = quadroDe(d);
      const marca = marcaEm(c, contents, e.clientX + q.left, e.clientY + q.top);
      if (marca) op.eventos.marcacaoClicada(marca.id, marca.caixa);
      else op.eventos.toque();
    });
  });

  // botão direito que cai no realce (o SVG fica no documento da casca, por cima do iframe): mesmo menu
  const aoMenuNaCasca = (e: MouseEvent) => {
    e.preventDefault();
    const contents = (rendition.getContents?.() ?? []) as Epubjs[];
    let marca: { id: string; caixa: Caixa } | null = null;
    for (const ct of contents) marca ??= marcaEm(c, ct, e.clientX, e.clientY);
    op.eventos.menu?.({ x: e.clientX, y: e.clientY, selecao: null, marcacaoId: marca?.id ?? null });
  };
  raiz.addEventListener('contextmenu', aoMenuNaCasca);
  const aoMexerNaCasca = () => avisarInteracao(c);
  for (const e of ['wheel', 'touchstart', 'pointerdown'])
    c.palco.addEventListener(e, aoMexerNaCasca, { passive: true });

  return {
    limparSelecao() {
      c.comSelecao = false;
      for (const ct of rendition.getContents?.() ?? []) ct.window?.getSelection()?.removeAllRanges();
    },
    desfazer() {
      doc.removeEventListener('keydown', tecla);
      botoes.anterior.removeEventListener('click', irAtras);
      botoes.proximo.removeEventListener('click', irAdiante);
      raiz.removeEventListener('contextmenu', aoMenuNaCasca);
      for (const e of ['wheel', 'touchstart', 'pointerdown']) c.palco.removeEventListener(e, aoMexerNaCasca);
    },
  };
}
