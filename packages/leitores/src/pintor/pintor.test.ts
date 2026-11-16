import { describe, expect, it } from 'vitest';
import {
  completarLeitura,
  contraste,
  criarPintor,
  normalizarHex,
  PAGINA_PADRAO,
  type ParametrosPintor,
} from './pintor';

const base = (o: Partial<ParametrosPintor> = {}): ParametrosPintor => ({
  papel: '#f4ecd8',
  tinta: '#5b4636',
  brilho: 0,
  contraste: 100,
  quente: 0,
  manterCores: true,
  ...o,
});
const px = (...v: number[]) => new Uint8ClampedArray(v);

describe('Pintor', () => {
  it('preto vira a tinta e branco vira o papel', () => {
    const d = px(0, 0, 0, 255, 255, 255, 255, 255);
    criarPintor(base()).pintar(d);
    expect([...d.slice(0, 4)]).toEqual([0x5b, 0x46, 0x36, 255]);
    expect([...d.slice(4, 8)]).toEqual([0xf4, 0xec, 0xd8, 255]);
  });
  it('"original" sem ajustes não repinta nada', () => {
    const p = criarPintor(base({ papel: '#ffffff', tinta: '#000000' }));
    expect(p.identidade).toBe(true);
    const d = px(10, 200, 30, 255, 0, 0, 0, 255);
    p.pintar(d);
    expect([...d]).toEqual([10, 200, 30, 255, 0, 0, 0, 255]);
  });
  it('com brilho ou luz quente deixa de ser identidade', () => {
    expect(criarPintor(base({ papel: '#ffffff', tinta: '#000000', quente: 10 })).identidade).toBe(false);
  });
  it('tema escuro: texto preto vira a tinta clara e o branco vira o papel escuro', () => {
    const p = criarPintor(base({ papel: '#141414', tinta: '#d6d6d6' }));
    expect(p.escuro).toBe(true);
    const d = px(0, 0, 0, 255, 255, 255, 255, 255);
    p.pintar(d);
    expect([...d.slice(0, 3)]).toEqual([0xd6, 0xd6, 0xd6]);
    expect([...d.slice(4, 7)]).toEqual([0x14, 0x14, 0x14]);
  });
  it('figura colorida no tema escuro mantém o matiz (inverte claro/escuro)', () => {
    const d = px(200, 40, 40, 255); // vermelho
    criarPintor(base({ papel: '#141414', tinta: '#d6d6d6' })).pintar(d);
    // dif = 255 - 200 - 40 = 15 → 215, 55, 55: ainda vermelho, na mesma distância entre canais
    expect([...d]).toEqual([215, 55, 55, 255]);
  });
  it('figura colorida no tema claro é multiplicada pelo papel', () => {
    const d = px(200, 40, 40, 255);
    criarPintor(base({ papel: '#808080', tinta: '#000000' })).pintar(d);
    expect(d[0]).toBe(100);
    expect(d[1]).toBe(20);
  });
  it('sem "manter cores" a figura vira tom entre tinta e papel', () => {
    const d = px(200, 40, 40, 255);
    criarPintor(base({ manterCores: false })).pintar(d);
    expect(d[0]).toBeGreaterThan(0x5b);
    expect(d[0]).toBeLessThan(0xf4);
    expect(d[1]).toBeLessThan(0xec);
    expect(d[2]).toBeLessThan(0xd8);
  });
  it('luz quente tira azul e um pouco de verde', () => {
    const d = px(255, 255, 255, 255);
    criarPintor(base({ papel: '#ffffff', tinta: '#000000', quente: 100 })).pintar(d);
    expect(d[0]).toBe(255);
    expect(d[1]!).toBeLessThan(255);
    expect(d[2]!).toBeLessThan(d[1]!);
  });
  it('brilho clareia e contraste alto afasta os tons', () => {
    const meio = (o: Partial<ParametrosPintor>) => {
      const d = px(100, 100, 100, 255);
      criarPintor(base({ papel: '#ffffff', tinta: '#000000', ...o })).pintar(d);
      return d[0]!;
    };
    expect(meio({ brilho: 50 })).toBeGreaterThan(meio({}));
    expect(meio({ contraste: 200 })).toBeLessThan(meio({}));
  });
  it('cores() diz o que branco e preto viram', () => {
    expect(criarPintor(base()).cores()).toEqual({ papel: '#f4ecd8', tinta: '#5b4636' });
  });
  it('contraste WCAG e hex', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 5);
    expect(normalizarHex('#ABC')).toBe('#aabbcc');
    expect(normalizarHex('102030')).toBe('#102030');
    expect(normalizarHex('xyz')).toBeNull();
  });
  it('config antiga sem os campos novos abre com o padrão', () => {
    const c = completarLeitura({ fonte: 'inter', tamanho: 20, entrelinha: 1.6, largura: 60, tema: 'noite' });
    expect(c.pagina).toEqual(PAGINA_PADRAO);
    expect(c.temasMeus).toEqual([]);
    expect(completarLeitura({ ...c, pagina: { ...PAGINA_PADRAO, brilho: 5 } }).pagina.brilho).toBe(5);
  });
});
