// Aparência do EPUB: mapeia a config do app (fonte, tema, medidas) pro CSS que vai dentro do iframe do epub.js.
// As contas são puras (sem DOM) e testáveis sem navegador; só `aplicarAparencia` fala com o epub.js.
import type { ConfigLeitura } from '@fierium/contratos';
import { criarPintor, parametrosDaPagina } from '@fierium/leitor-base';
import type { CtxEpub } from './tipos';

const SERIFA = 'Georgia, "Times New Roman", serif';
const SEM_SERIFA = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Família CSS (com reserva do sistema, pra o caso de a fonte não existir dentro do iframe). */
export function familiaDe(fonte: ConfigLeitura['fonte']): string {
  switch (fonte) {
    case 'inter':
      return `"Inter Variable", ${SEM_SERIFA}`;
    case 'literata':
      return `"Literata Variable", ${SERIFA}`;
    case 'cormorant':
    case 'fraunces':
    default:
      return `"Cormorant Garamond Variable", ${SERIFA}`;
  }
}

/**
 * As cores do capítulo: o tema da página (papel = fundo, tinta = texto) já com brilho, contraste e luz quente
 * aplicados. Pinta só o fundo e o texto: as imagens do livro não são repintadas.
 */
export function coresDoEpub(a: ConfigLeitura): { fundo: string; texto: string } {
  const c = criarPintor(parametrosDaPagina(a.pagina, a.temasMeus)).cores();
  return { fundo: c.papel, texto: c.tinta };
}

const MARGEM = '0 auto';
const RESPIRO = '2rem 1.25rem 4rem';

/** As propriedades que vão no <body> do capítulo. */
export function estiloDoCorpo(a: ConfigLeitura): Record<string, string> {
  const t = coresDoEpub(a);
  return {
    background: t.fundo,
    color: t.texto,
    'font-family': familiaDe(a.fonte),
    'font-size': `${a.tamanho}px`,
    'line-height': String(a.entrelinha),
    'max-width': `${a.largura}ch`,
    margin: MARGEM,
    padding: RESPIRO,
  };
}

/** Regras gerais do capítulo (links na cor do texto, imagens que cabem). */
export function regrasGerais(a: ConfigLeitura): Record<string, Record<string, string>> {
  const t = coresDoEpub(a);
  return {
    // o epub.js regrava a margem e o respiro do <body> a cada redimensionamento (a coluna ia parar colada na
    // esquerda); a regra com !important vale mais que o estilo que ele escreve
    body: { margin: `${MARGEM} !important`, padding: `${RESPIRO} !important` },
    'a, a:link, a:visited': { color: `${t.texto} !important`, 'text-decoration': 'underline' },
    img: { 'max-width': '100% !important', height: 'auto !important' },
  };
}

/** Aplica a aparência (tema da página, fonte, medidas) no fundo da casca e nos capítulos já abertos e nos próximos. */
export function aplicarAparencia(c: CtxEpub, a: ConfigLeitura): void {
  const corpo = estiloDoCorpo(a);
  c.raiz.style.background = corpo.background!;
  c.rendition.themes.default(regrasGerais(a));
  for (const [k, v] of Object.entries(corpo)) c.rendition.themes.override(k, v);
}
