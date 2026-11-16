import { describe, expect, it } from 'vitest';
import { servicosDeTeste } from '../../testes/apoio';
import { criarInternet } from './internet';

describe('internet e catálogos (estado)', () => {
  it('liga e desliga a rede e lista as fontes', async () => {
    const { s } = servicosDeTeste();
    const i = criarInternet(s);
    await i.carregar();
    expect(i.store.getState().permitida).toBe(true);
    expect(i.store.getState().fontes[0]?.id).toBe('gutenberg');
    await i.definir(false);
    expect(i.store.getState().permitida).toBe(false);
    await i.atualizar('gutenberg');
    expect(i.store.getState().atualizando).toEqual([]);
  });
});
