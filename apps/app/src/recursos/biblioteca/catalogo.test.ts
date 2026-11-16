import { describe, expect, it } from 'vitest';
import { servicosDeTeste } from '../../testes/apoio';
import { criarBiblioteca } from './estado';

describe('biblioteca com o catálogo em cinza', () => {
  it('buscando, aparece "pra baixar"; sem busca e sem o interruptor, não', async () => {
    const { s } = servicosDeTeste();
    const b = criarBiblioteca(s);
    await b.filtrar();
    expect(b.store.getState().paraBaixar).toEqual([]);
    await b.filtrar({ texto: 'machado' });
    expect(b.store.getState().paraBaixar.length).toBeGreaterThanOrEqual(3);
    expect(b.store.getState().paraBaixar.every((i) => !i.obraId)).toBe(true);
  });
  it('o interruptor mostra o cinza sem busca, e filtros só do que a pessoa tem escondem', async () => {
    const { s } = servicosDeTeste();
    const b = criarBiblioteca(s);
    await b.mostrarCatalogo(true);
    expect(b.store.getState().paraBaixar.length).toBeGreaterThan(0);
    await b.filtrar({ estado: 'lendo' });
    expect(b.store.getState().paraBaixar).toEqual([]);
    await b.mostrarCatalogo(false);
  });
});
