// Aparência do EPUB: mapeia a config do app (fonte, tema, medidas) pro CSS que vai dentro do iframe do epub.js.
// Puro (sem DOM): testável sem navegador.
import type { ConfigLeitura } from '@fierium/contratos';

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

export const TEMAS_EPUB: Record<ConfigLeitura['tema'], { fundo: string; texto: string }> = {
  pergaminho: { fundo: '#f1e6c9', texto: '#2b2216' },
  papel: { fundo: '#f7f3ea', texto: '#1f1b16' },
  sepia: { fundo: '#efe1c6', texto: '#3b2b1a' },
  noite: { fundo: '#12101f', texto: '#ddd6c8' },
  tinta: { fundo: '#e9e9e4', texto: '#111111' },
};

/** As propriedades que vão no <body> do capítulo. */
export function estiloDoCorpo(a: ConfigLeitura): Record<string, string> {
  const t = TEMAS_EPUB[a.tema] ?? TEMAS_EPUB.pergaminho;
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
  const t = TEMAS_EPUB[a.tema] ?? TEMAS_EPUB.pergaminho;
  return {
    'a, a:link, a:visited': { color: `${t.texto} !important`, 'text-decoration': 'underline' },
    img: { 'max-width': '100% !important', height: 'auto !important' },
  };
}
