// As peças comuns do leitor de EPUB (as mesmas que os modos de leitura usam): linhas visíveis pelo DOM do capítulo,
// rolar por código, virar capítulo e a faixa de destaque passageira (dentro do iframe, então rola junto).
import {
  agruparLinhas,
  caixaDe,
  criarDestaque,
  type Caixa,
  type Capacidades,
  type Linha,
  type Pedaco,
  type SessaoLeitura,
} from '@fierium/leitor-base';
import { navegar } from './eventos';
import { quadroDe } from './marcacoes';
import type { CtxEpub, Epubjs } from './tipos';

export const CAPACIDADES_EPUB: Capacidades = { paginar: true, linhas: true, rolar: true, destacar: true };

/** O elemento que rola (o `.epub-container` do epub.js: no fluxo "scrolled-doc" o iframe tem a altura do capítulo). */
function rolador(c: CtxEpub): HTMLElement | null {
  return (c.rendition.manager?.container as HTMLElement | undefined) ?? c.palco.querySelector('.epub-container');
}

function conteudoAtual(c: CtxEpub): Epubjs | null {
  const todos = (c.rendition.getContents?.() ?? []) as Epubjs[];
  return todos[0] ?? null;
}

const areaDe = (c: CtxEpub): Caixa => caixaDe((rolador(c) ?? c.palco).getBoundingClientRect());

/**
 * As palavras do capítulo que estão na tela (cada uma com a sua caixa), de cima pra baixo. Só olha os blocos de texto
 * que aparecem; o `ordem` é a posição da palavra no capítulo inteiro (dá o `id` estável da linha).
 */
function palavrasVisiveis(d: Document, area: Caixa): Pedaco[] {
  const { left, top } = quadroDe(d);
  const pedacos: Pedaco[] = [];
  const andar = d.createTreeWalker(d.body, 4 /* NodeFilter.SHOW_TEXT */);
  const faixa = d.createRange();
  let no = 0;
  for (let t = andar.nextNode() as Text | null; t; t = andar.nextNode() as Text | null, no++) {
    const dono = t.parentElement;
    if (!dono || !t.data.trim()) continue;
    const b = dono.getBoundingClientRect();
    if (b.height === 0 || b.bottom + top < area.y || b.top + top > area.y + area.altura) continue;
    let k = 0;
    for (const m of t.data.matchAll(/\S+/g)) {
      faixa.setStart(t, m.index);
      faixa.setEnd(t, m.index + m[0].length);
      const r = faixa.getClientRects()[0];
      if (r && r.height > 0) {
        pedacos.push({
          texto: m[0],
          caixa: caixaDe(new DOMRect(r.left + left, r.top + top, r.width, r.height)),
          ordem: no * 100_000 + k,
        });
      }
      k++;
    }
  }
  return pedacos;
}

/** As linhas de texto cujo centro está na área visível, de cima pra baixo. O `id` é "capítulo:ordem da 1ª palavra". */
export function linhasVisiveisEpub(c: CtxEpub): Linha[] {
  const ct = conteudoAtual(c);
  if (!ct) return [];
  const area = areaDe(c);
  return agruparLinhas(palavrasVisiveis(ct.document, area), `${c.ultimoIndice}:`).filter((l) => {
    const centro = l.caixa.y + l.caixa.altura / 2;
    return centro >= area.y && centro <= area.y + area.altura;
  });
}

/** Avisa quando a PESSOA mexe: o `eventos.ts` liga os ouvintes (casca e iframes) e chama quem se registrou aqui. */
function aoInteragirEpub(c: CtxEpub, ouvinte: () => void): () => void {
  c.interessados.add(ouvinte);
  return () => void c.interessados.delete(ouvinte);
}

export function pecasComuns(
  c: CtxEpub,
): Pick<
  SessaoLeitura,
  'capacidades' | 'linhas' | 'rolarPor' | 'rolagem' | 'paginar' | 'paginaAtual' | 'destacarTrecho' | 'aoInteragir'
> & { desfazerDestaque(): void } {
  let destaque: { doc: Document; faixa: ReturnType<typeof criarDestaque> } | null = null;
  const apagar = () => {
    destaque?.faixa.desfazer();
    destaque = null;
  };
  return {
    capacidades: CAPACIDADES_EPUB,
    linhas: () => linhasVisiveisEpub(c),
    rolarPor: (px) => {
      const el = rolador(c);
      if (el) el.scrollTop += px;
    },
    rolagem: () => {
      const el = rolador(c);
      return {
        atual: el?.scrollTop ?? 0,
        total: el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0,
        area: areaDe(c),
      };
    },
    paginar: (d) => navegar(c, d),
    paginaAtual: () => ({
      atual: Math.min(c.ultimoIndice + 1, c.book.spine?.length ?? 1),
      total: c.book.spine?.length ?? 1,
    }),
    destacarTrecho: (faixa) => {
      const ct = conteudoAtual(c);
      if (!faixa || !ct) return apagar();
      const d: Document = ct.document;
      if (destaque && destaque.doc !== d) apagar(); // o capítulo trocou: a faixa antiga ficou no documento velho
      destaque ??= { doc: d, faixa: criarDestaque(d, d.body) };
      destaque.faixa.mostrar(faixa, quadroDe(d));
    },
    aoInteragir: (o) => aoInteragirEpub(c, o),
    desfazerDestaque: apagar,
  };
}
