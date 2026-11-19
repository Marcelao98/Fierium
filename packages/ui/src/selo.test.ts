import { describe, expect, it } from 'vitest';
import { ajustarAutor, ajustarTitulo, hash, motivoDaArea, ornamentoDaCapa, textoDoSeloDeSerie } from './selo';

describe('selo (capa gerada)', () => {
  it('o mesmo título dá sempre a mesma capa; títulos diferentes dão capas diferentes', () => {
    const a = ornamentoDaCapa('Dom Casmurro|Machado', 'constelacao');
    expect(a).toEqual(ornamentoDaCapa('Dom Casmurro|Machado', 'constelacao'));
    expect(a).not.toEqual(ornamentoDaCapa('Iracema|Alencar', 'constelacao'));
    expect(hash('')).toBe(0x811c9dc5);
  });

  it('o ornamento muda com o mundo da obra', () => {
    expect(motivoDaArea('Fantasia')).toBe('lua');
    expect(motivoDaArea('Science-Fiction & Fantasy')).toBe('lua');
    expect(motivoDaArea('filosofia')).toBe('astrolabio');
    expect(motivoDaArea('Mangá')).toBe('raios');
    expect(motivoDaArea('ciência')).toBe('orbitas');
    expect(motivoDaArea('romance')).toBe('constelacao');
    expect(motivoDaArea(undefined)).toBe('constelacao');
    const o = ornamentoDaCapa('X', 'constelacao');
    expect(o.fios.length).toBeGreaterThan(0);
    expect(ornamentoDaCapa('X', 'lua').fios).toEqual([]);
    // as estrelas ficam dentro da moldura
    for (const e of o.estrelas) expect(e.x > 20 && e.x < 180 && e.y > 20 && e.y < 140).toBe(true);
  });

  it('título curto fica grande, longo quebra em linhas parelhas e nunca estoura a caixa', () => {
    expect(ajustarTitulo('Iracema')).toMatchObject({ linhas: ['Iracema'] });
    const longo = ajustarTitulo('Memórias Póstumas de Brás Cubas');
    expect(longo.linhas.length).toBeGreaterThan(1);
    expect(longo.linhas.join(' ')).toBe('Memórias Póstumas de Brás Cubas');
    expect(ajustarTitulo('Iracema').tamanho).toBeGreaterThan(longo.tamanho);
    const imenso =
      'A Vida e as Aventuras Surpreendentes de Robinson Crusoé, de York, Marinheiro, que Viveu Vinte e Oito Anos Sozinho numa Ilha Deserta';
    for (const t of [imenso, 'Supercalifragilisticexpialidocious', 'x'.repeat(80), '', 'A B C D E F G H I J K L M N']) {
      const r = ajustarTitulo(t);
      const maior = Math.max(...r.linhas.map((l) => l.length));
      expect(r.tamanho).toBeGreaterThanOrEqual(10.5);
      expect(maior * r.tamanho * 0.5).toBeLessThanOrEqual(143);
      expect(r.linhas.length * r.tamanho * 1.14).toBeLessThanOrEqual(71);
    }
    expect(ajustarTitulo(imenso).linhas.join(' ')).toContain('…');
  });

  it('autor em maiúsculas cabe na largura; selo de série mostra o volume', () => {
    expect(ajustarAutor('Machado de Assis')).toMatchObject({ texto: 'MACHADO DE ASSIS', tamanho: 8 });
    const longo = ajustarAutor("Alfredo d'Escragnolle Taunay, Visconde de Taunay e Outros Autores Muito Famosos");
    expect(longo.texto.length * longo.tamanho * 0.82).toBeLessThanOrEqual(151);
    expect(textoDoSeloDeSerie('vol. 12')).toBe('12');
    expect(textoDoSeloDeSerie('especial')).toBe('ESP');
  });
});
