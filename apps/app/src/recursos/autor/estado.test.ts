import { describe, expect, it } from 'vitest';
import { servicosDeTeste } from '../../testes/apoio';
import { criarAutor } from './estado';

describe('autor (estado)', () => {
  it('junta o que a pessoa tem (colorido) e o do catálogo (cinza), por ano', async () => {
    const { s } = servicosDeTeste();
    const a = criarAutor(s);
    await a.abrir('Machado de Assis');
    const pecas = a.store.getState().pecas;
    expect(pecas.some((p) => p.tipo === 'obra')).toBe(true);
    expect(pecas.some((p) => p.tipo === 'item')).toBe(true);
    const anos = pecas.map((p) => (p.tipo === 'obra' ? p.obra.ano : p.item.ano) ?? Infinity);
    expect(anos).toEqual([...anos].sort((x, y) => x - y));
  });
});
