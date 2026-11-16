// Aparência do EPUB: mapeia a config do app (fonte, tema, medidas) pro CSS que vai dentro do iframe do epub.js.
// Puro (sem DOM): testável sem navegador.
import type { ConfigLeitura } from '@fierium/contratos';
import { criarPintor } from '../pintor/pintor';
import { parametrosDaPagina } from '../pintor/temas';

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
    margin: '0 auto',
    padding: '2rem 1.25rem 4rem',
  };
}

/** Regras gerais do capítulo (links na cor do texto, imagens que cabem). */
export function regrasGerais(a: ConfigLeitura): Record<string, Record<string, string>> {
  const t = coresDoEpub(a);
  return {
    'a, a:link, a:visited': { color: `${t.texto} !important`, 'text-decoration': 'underline' },
    img: { 'max-width': '100% !important', height: 'auto !important' },
  };
}
