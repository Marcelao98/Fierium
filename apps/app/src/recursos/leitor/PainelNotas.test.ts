// @vitest-environment jsdom
import { bibliotecaDeExemplo } from '@fierium/cliente';
import { describe, expect, it } from 'vitest';
import { filtrarNotas } from './PainelNotas';

describe('notas deste livro', () => {
  const ms = bibliotecaDeExemplo(1_700_000_000_000).marcacoes;
  it('filtra por cor e por texto sem acento', () => {
    expect(filtrarNotas(ms, null, '')).toHaveLength(ms.length);
    const cor = ms[0]!.cor;
    expect(filtrarNotas(ms, cor, '').every((m) => m.cor === cor)).toBe(true);
    const trecho = ms[0]!.trecho.slice(0, 12).toUpperCase();
    expect(filtrarNotas(ms, null, trecho).map((m) => m.id)).toContain(ms[0]!.id);
    expect(filtrarNotas(ms, null, 'zzz-nada-assim')).toEqual([]);
  });
});
