// CFI (o endereço de um trecho no EPUB): dividir um intervalo em início/fim e juntar de volta.

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
