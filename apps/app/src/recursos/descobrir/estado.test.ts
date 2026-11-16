import { describe, expect, it } from 'vitest';
import { servicosDeTeste } from '../../testes/apoio';
import { clienteComBaixa } from '../../testes/catalogo';
import { criarDescobrir } from './estado';

describe('descobrir (estado)', () => {
  it('carrega as coleções prontas e busca no catálogo inteiro', async () => {
    const { s } = servicosDeTeste();
    const d = criarDescobrir(s);
    await d.carregar();
    const c = d.store.getState().colecoes;
    expect(c.map((x) => x.titulo)).toEqual([
      'Clássicos brasileiros',
      'Fantasia e aventura',
      'Filosofia',
      'Poesia',
      'Ciência',
    ]);
    expect(c[0]!.itens.length).toBeGreaterThan(0);
    await d.buscar('machado');
    expect(d.store.getState().resultados!.length).toBeGreaterThanOrEqual(3);
    await d.buscar('');
    expect(d.store.getState().resultados).toBeNull();
  });
  it('baixar: sem rede, o item guarda a mensagem em português', async () => {
    const { s } = servicosDeTeste();
    const d = criarDescobrir(s);
    const r = await d.baixador.baixar('gutenberg:55682');
    expect(r).toBeNull();
    const f = d.store.getState();
    expect(f).toBeTruthy();
    const fase = d.baixador.store.getState()['gutenberg:55682'];
    expect(fase?.fase).toBe('erro');
    expect(fase?.fase === 'erro' && fase.mensagem).toContain('Ajustes → Internet');
  });
  it('baixar: no fim emite biblioteca-mudou e devolve a obra pronta', async () => {
    const { cliente, baixados } = clienteComBaixa();
    const { s } = servicosDeTeste(cliente);
    const d = criarDescobrir(s);
    let mudou = 0;
    s.eventos.ouvir('biblioteca-mudou', () => mudou++);
    const r = await d.baixador.baixar('gutenberg:55682');
    expect(r).toEqual({ obraId: 'obra-nova', edicaoId: 'edicao-nova' });
    expect(baixados).toEqual(['gutenberg:55682']);
    expect(mudou).toBeGreaterThanOrEqual(1);
    expect(d.baixador.store.getState()['gutenberg:55682']?.fase).toBe('pronto');
  });
  it('ficha de um item', async () => {
    const { s } = servicosDeTeste();
    const d = criarDescobrir(s);
    await d.abrirItem('gutenberg:55682');
    expect(d.store.getState().item?.titulo).toBe('Quincas Borba');
  });
});
