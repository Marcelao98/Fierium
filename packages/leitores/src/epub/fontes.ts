// As fontes do app vivem no documento de cima (@fontsource); o iframe do epub.js é outro documento e não as enxerga.
// Copiamos as regras @font-face das famílias que interessam, com as URLs já absolutas, pra dentro do iframe.
const FAMILIAS = ['Cormorant Garamond Variable', 'Literata Variable', 'Inter Variable'];

export function fontFacesDe(doc: Document): string {
  const saida: string[] = [];
  for (const folha of Array.from(doc.styleSheets)) {
    let regras: CSSRuleList;
    try {
      regras = folha.cssRules;
    } catch {
      continue; // folha de outra origem: o navegador não deixa ler; a reserva do sistema cobre
    }
    const base = folha.href ?? doc.baseURI;
    const visitar = (lista: CSSRuleList) => {
      for (const r of Array.from(lista)) {
        if (r.cssText.startsWith('@font-face')) {
          const fam = (r as CSSFontFaceRule).style.getPropertyValue('font-family').replace(/["']/g, '').trim();
          if (!FAMILIAS.includes(fam)) continue;
          saida.push(
            r.cssText.replace(/url\((["']?)([^)"']+)\1\)/g, (_m, _q, u: string) => {
              try {
                return `url("${new URL(u, base).href}")`;
              } catch {
                return `url("${u}")`;
              }
            }),
          );
        } else if ('cssRules' in r) visitar((r as CSSGroupingRule).cssRules);
      }
    };
    visitar(regras);
  }
  return saida.join('\n');
}
