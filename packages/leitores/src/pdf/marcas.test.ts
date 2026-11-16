import { describe, expect, it } from 'vitest';
import { dentro, dividirPorPagina, enxugar, juntarPartes, type Ret } from './marcas';

describe('marcas do PDF', () => {
  it('ida e volta de uma marcação que cruza páginas', () => {
    const a = juntarPartes([
      { pagina: 3, ret: [0.1, 0.9, 0.5, 0.05] },
      { pagina: 4, ret: [0.1, 0.02, 0.6, 0.05] },
    ])!;
    expect(a.pagina).toBe(3);
    expect(a.retangulos[1]![1]).toBeCloseTo(1.02);
    const volta = dividirPorPagina(a.pagina, a.retangulos);
    expect(volta.map((p) => p.pagina)).toEqual([3, 4]);
    expect(volta[1]!.ret[1]).toBeCloseTo(0.02);
  });
  it('enxugar tira o que está dentro de outro e os repetidos', () => {
    const g: Ret = [0.1, 0.1, 0.5, 0.05];
    expect(enxugar([g, [0.2, 0.11, 0.1, 0.03], g])).toEqual([g]);
  });
  it('dentro', () => {
    expect(dentro([0.1, 0.1, 0.2, 0.1], 0.15, 0.15)).toBe(true);
    expect(dentro([0.1, 0.1, 0.2, 0.1], 0.5, 0.15)).toBe(false);
  });
});
