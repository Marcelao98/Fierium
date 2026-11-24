// Limpeza de cada capítulo do EPUB antes de montar: o DOMPurify tira tudo o que executaria código do livro (<script>,
// atributos on*, endereços javascript:, <iframe>, <object>, <embed>...) e deixa texto, imagens, estilos e notas de
// rodapé. O livro é de terceiros: nada dele roda no app (a CSP também não deixa, mas aqui nem chega ao iframe).
import DOMPurify from 'dompurify';

/** Atributos do EPUB (tipos semânticos como "noteref"/"footnote") e do XHTML que o DOMPurify não conhece. */
const ATRIBUTOS_EXTRAS = ['epub:type', 'epub:prefix', 'xml:lang', 'xlink:href', 'xmlns:epub', 'xmlns:xlink', 'role'];
/** `link` (folha de estilo do próprio livro) e `style` ficam; `base` não: mudaria pra onde apontam todos os links. */
const TAGS_EXTRAS = ['link', 'style', 'aside', 'figure', 'figcaption', 'section', 'nav', 'ruby', 'rt', 'rp'];
const TAGS_PROIBIDAS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'base', 'form', 'meta'];

/** Limpa o capítulo no lugar (o epub.js serializa o próprio documento depois do gancho, então não dá pra trocá-lo). */
export function sanitizarCapitulo(capitulo: Document): void {
  const raiz = capitulo.documentElement;
  DOMPurify.sanitize(raiz, {
    IN_PLACE: true,
    WHOLE_DOCUMENT: true,
    ADD_TAGS: TAGS_EXTRAS,
    ADD_ATTR: ATRIBUTOS_EXTRAS,
    FORBID_TAGS: TAGS_PROIBIDAS,
  });
  // um <link> só vale como folha de estilo (nada de rel=import, prefetch...)
  for (const l of [...capitulo.querySelectorAll('link')]) {
    if (!/\bstylesheet\b/i.test(l.getAttribute('rel') ?? '')) l.remove();
  }
}
