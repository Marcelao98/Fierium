import type { Obra } from '@fierium/contratos';
import { describe, expect, it } from 'vitest';
import { montarCeu } from './ceu';

const obra = (id: string, reino: string, autor: string): Obra => ({
  id,
  titulo: id,
  criadores: [{ nome: autor, papel: 'autor' }],
  assuntos: [],
  reino,
  matiz: 0,
  colecaoIds: [],
  edicoes: [],
  relacao: { estado: 'nao-lida', favorita: false, adicionadaEm: 0 },
});

describe('céu do mapa', () => {
  const obras = [
    obra('a', 'Romance', 'X'),
    obra('b', 'Romance', 'X'),
    obra('c', 'Filosofia', 'Y'),
    obra('d', 'Romance', 'Z'),
  ];
  it('uma região por área, uma luz por obra, fio entre obras do mesmo autor', () => {
    const c = montarCeu(obras);
    expect(c.regioes.map((r) => r.nome)).toEqual(['Filosofia', 'Romance']);
    expect(c.luzes).toHaveLength(4);
    expect(c.fios.map(([x, y]) => [x.obra.id, y.obra.id])).toEqual([['a', 'b']]);
  });
  it('estável: a mesma biblioteca em outra ordem dá o mesmo céu', () => {
    const pos = (l: ReturnType<typeof montarCeu>) =>
      l.luzes.map((x) => [x.obra.id, x.x.toFixed(3), x.y.toFixed(3)]).sort();
    expect(pos(montarCeu([...obras].reverse()))).toEqual(pos(montarCeu(obras)));
  });
});
