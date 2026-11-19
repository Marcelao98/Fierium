import { criarLog } from '@fierium/diagnostico';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instalarAtualizacao, procurarAtualizacao, useAtualizacao } from './atualizacao';

describe('atualização automática', () => {
  beforeEach(() => useAtualizacao.setState({ versao: null, fase: 'nenhuma', instalar: null }));

  it('sem atualizador (navegador ou sem chave) não faz nada', async () => {
    await procurarAtualizacao(null, criarLog());
    expect(useAtualizacao.getState().versao).toBeNull();
  });

  it('avisa a versão nova e instala quando a pessoa pede', async () => {
    const instalar = vi.fn(() => Promise.resolve());
    await procurarAtualizacao({ procurar: () => Promise.resolve({ versao: '0.6.0', instalar }) }, criarLog());
    expect(useAtualizacao.getState()).toMatchObject({ versao: '0.6.0', fase: 'disponivel' });
    await instalarAtualizacao(criarLog(), vi.fn());
    expect(instalar).toHaveBeenCalledOnce();
  });

  it('falha na procura não incomoda a pessoa', async () => {
    await procurarAtualizacao({ procurar: () => Promise.reject(new Error('sem rede')) }, criarLog());
    expect(useAtualizacao.getState().fase).toBe('nenhuma');
  });

  it('falha ao instalar avisa e volta a oferecer', async () => {
    const avisar = vi.fn();
    await procurarAtualizacao(
      { procurar: () => Promise.resolve({ versao: '0.6.0', instalar: () => Promise.reject(new Error('x')) }) },
      criarLog(),
    );
    await instalarAtualizacao(criarLog(), avisar);
    expect(avisar).toHaveBeenCalledWith(expect.any(String), 'erro');
    expect(useAtualizacao.getState().fase).toBe('disponivel');
  });
});
