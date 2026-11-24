// Marcações do EPUB: o realce é um highlight do epub.js (SVG por cima do texto); o clique numa marcação é resolvido
// aqui, pelos retângulos do trecho (assim não depende dos eventos do SVG).
import type { Marcacao } from '@fierium/contratos';
import { caixaDe, type Caixa } from '@fierium/leitor-base';
import { juntarCfi } from './cfi';
import type { CtxEpub, Epubjs } from './tipos';

// marcador de página (tipo 'marcador') só lembra o lugar: não tem trecho pra realçar
export const cfiDe = (m: Marcacao): string | null =>
  m.ancora.tipo === 'epub' && m.tipo !== 'marcador' ? juntarCfi(m.ancora.cfiInicio, m.ancora.cfiFim) : null;

export const cfiInicioDe = (c: CtxEpub, id: string): string | undefined => {
  const m = c.marcas.marcacoes.find((x) => x.id === id);
  return m?.ancora.tipo === 'epub' ? m.ancora.cfiInicio : undefined;
};

/** onde o iframe do capítulo está na tela (ele desloca as coordenadas de dentro) */
export function quadroDe(d: Document): { left: number; top: number } {
  const q = (d.defaultView as Window | null)?.frameElement?.getBoundingClientRect();
  return { left: q?.left ?? 0, top: q?.top ?? 0 };
}

/** onde o intervalo está na tela */
export function retangulosNaTela(contents: Epubjs, cfi: string): DOMRect[] {
  const range: Range | null = contents.range(cfi);
  if (!range) return [];
  const { left, top } = quadroDe(contents.document);
  return [...range.getClientRects()].map((r) => new DOMRect(r.left + left, r.top + top, r.width, r.height));
}

export function marcaEm(c: CtxEpub, contents: Epubjs, x: number, y: number): { id: string; caixa: Caixa } | null {
  const { marcacoes } = c.marcas;
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
}

/** Os realces: o epub.js guarda e reaplica a cada capítulo que abre. Devolve quem refaz tudo. */
export function criarRealces(c: CtxEpub): () => void {
  let realces: string[] = [];
  let avisou = false;
  return () => {
    for (const cfi of realces) {
      try {
        c.rendition.annotations.remove(cfi, 'highlight');
      } catch {
        // já removido junto com o capítulo
      }
    }
    realces = [];
    const { marcacoes, cores, selecionada } = c.marcas;
    for (const m of marcacoes) {
      const cfi = cfiDe(m);
      if (!cfi) continue;
      const cor = cores.find((x) => x.id === m.cor)?.cor ?? '#a99be6';
      try {
        c.rendition.annotations.highlight(
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
        if (!avisou) {
          avisou = true;
          c.op.eventos.erro('EPUB_MARCACAO', 'Não consegui pintar uma marcação neste EPUB.', String(e));
        }
      }
    }
  };
}
