import { describe, expect, it } from 'vitest';
import { contraste, hexParaRgb, PAGINA_PADRAO } from './pintor';
import { buscarTemas, GRUPOS_TEMAS, resolverTema, TEMAS_PAGINA, temaPorId } from './temas';

const IDS_KOFLIBRARY = [
  'original',
  'papel',
  'sepia',
  'cafe-com-leite',
  'pergaminho',
  'eink',
  'verde',
  'rosa',
  'lavanda',
  'solar',
  'cinza',
  'noite',
  'cafe-noite',
  'meia-noite',
  'solar-escuro',
  'lousa',
  'oled',
  'terminal',
  'ambar',
  'gameboy',
  'alto-contraste',
  'branco-total',
];

const dist = (a: string, b: string) => {
  const x = hexParaRgb(a);
  const y = hexParaRgb(b);
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
};

describe('catálogo de temas da página', () => {
  it('tem uns 100 temas e inclui os 22 do KOFlibrary com os mesmos ids', () => {
    expect(TEMAS_PAGINA.length).toBeGreaterThanOrEqual(95);
    for (const id of IDS_KOFLIBRARY) expect(temaPorId(id), id).toBeDefined();
  });
  it('ids e nomes únicos; grupos conhecidos; cores em #rrggbb', () => {
    expect(new Set(TEMAS_PAGINA.map((t) => t.id)).size).toBe(TEMAS_PAGINA.length);
    expect(new Set(TEMAS_PAGINA.map((t) => t.nome)).size).toBe(TEMAS_PAGINA.length);
    for (const t of TEMAS_PAGINA) {
      expect(GRUPOS_TEMAS as readonly string[], t.id).toContain(t.grupo);
      expect(t.papel, t.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(t.tinta, t.id).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const g of GRUPOS_TEMAS)
      expect(
        TEMAS_PAGINA.some((t) => t.grupo === g),
        g,
      ).toBe(true);
  });
  it('contraste papel × tinta ≥ 4,5:1 (≥ 7:1 no grupo Acessível)', () => {
    for (const t of TEMAS_PAGINA) {
      const c = contraste(t.papel, t.tinta);
      expect(c, `${t.id} ${c.toFixed(2)}`).toBeGreaterThanOrEqual(t.grupo === 'Acessível' ? 7 : 4.5);
    }
  });
  it('nenhum par de temas é quase igual (distância mínima entre as cores)', () => {
    const parecidos: string[] = [];
    for (let i = 0; i < TEMAS_PAGINA.length; i++)
      for (let j = i + 1; j < TEMAS_PAGINA.length; j++) {
        const a = TEMAS_PAGINA[i]!;
        const b = TEMAS_PAGINA[j]!;
        // "branco-total" é o "original" com outro nome no KOFlibrary: os dois ids ficam por compatibilidade
        if (a.id === 'original' && b.id === 'branco-total') continue;
        const d = dist(a.papel, b.papel) + dist(a.tinta, b.tinta);
        if (d < 30) parecidos.push(`${a.id} × ${b.id} (${d.toFixed(0)})`);
      }
    expect(parecidos).toEqual([]);
  });
  it('o tema padrão existe', () => {
    expect(temaPorId(PAGINA_PADRAO.tema)).toBeDefined();
  });
  it('resolve tema do catálogo, "meus temas", personalizado e id desconhecido', () => {
    const meus = [{ id: 'meu-1', nome: 'Azulão', papel: '#102030', tinta: '#f0e0c0' }];
    expect(resolverTema({ ...PAGINA_PADRAO, tema: 'noite' }).papel).toBe('#141414');
    expect(resolverTema({ ...PAGINA_PADRAO, tema: 'meu-1' }, meus).nome).toBe('Azulão');
    const livre = resolverTema({ ...PAGINA_PADRAO, tema: 'personalizado', papel: '#102030', tinta: '#f0e0c0' });
    expect(livre.papel).toBe('#102030');
    expect(resolverTema({ ...PAGINA_PADRAO, tema: 'sumiu' }).id).toBe('sepia');
  });
  it('a busca ignora acento e caixa', () => {
    const ids = (q: string) => buscarTemas(TEMAS_PAGINA, q).map((t) => t.id);
    expect(ids('cafe')).toEqual(expect.arrayContaining(['cafe-com-leite', 'cafe-noite']));
    expect(ids('SÉPIA')).toContain('sepia');
    expect(ids('')).toHaveLength(TEMAS_PAGINA.length);
    expect(ids('zzzz')).toEqual([]);
  });
});
