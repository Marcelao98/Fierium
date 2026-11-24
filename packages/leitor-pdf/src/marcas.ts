// Geometria das marcações do PDF (pura, testável sem DOM). A âncora guarda `pagina` + retângulos normalizados 0..1
// [x, y, largura, altura]. Marcação que cruza páginas é UMA marcação só: `pagina` é a primeira e o `y` de cada
// retângulo soma o número de páginas depois dela (y = 1.25 é 25% de altura na página seguinte). O contrato não muda.
export type Ret = [number, number, number, number];
export interface Parte {
  pagina: number;
  ret: Ret;
}

const arredondar = (n: number) => Math.round(n * 10_000) / 10_000;

/** Âncora → retângulos, cada um na sua página (y de volta pra 0..1). */
export function dividirPorPagina(pagina: number, retangulos: readonly Ret[]): Parte[] {
  return retangulos.map(([x, y, l, a]) => {
    const extra = Math.floor(y + 1e-9);
    return { pagina: pagina + extra, ret: [x, y - extra, l, a] };
  });
}

/** Retângulos por página → a âncora ({ pagina da primeira, retângulos com o y deslocado }). */
export function juntarPartes(partes: readonly Parte[]): { pagina: number; retangulos: Ret[] } | null {
  if (!partes.length) return null;
  const primeira = Math.min(...partes.map((p) => p.pagina));
  return {
    pagina: primeira,
    retangulos: partes.map(({ pagina, ret: [x, y, l, a] }) => [
      arredondar(x),
      arredondar(y + (pagina - primeira)),
      arredondar(l),
      arredondar(a),
    ]),
  };
}

const contem = (a: Ret, b: Ret) =>
  b[0] >= a[0] - 0.001 &&
  b[1] >= a[1] - 0.001 &&
  b[0] + b[2] <= a[0] + a[2] + 0.001 &&
  b[1] + b[3] <= a[1] + a[3] + 0.001;

/** Tira retângulos repetidos ou inteiramente dentro de outro (a seleção do navegador devolve vários por linha). */
export function enxugar(rets: readonly Ret[]): Ret[] {
  return rets.filter((r, i) => !rets.some((o, j) => j !== i && contem(o, r) && (!contem(r, o) || j < i)));
}

export const dentro = (r: Ret, x: number, y: number) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
