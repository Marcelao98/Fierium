import type { Cliente } from '@fierium/cliente';
import type { EstadoCatalogo } from '@fierium/contratos';
import { describe, expect, it, vi } from 'vitest';
import { fraseDoCatalogo } from '../../compartilhado/catalogo';
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
      'Em português',
      'Fantasia e aventura',
      'Ficção científica',
      'Filosofia',
      'Poesia',
      'Ciência',
    ]);
    // cada linha vem de assuntos de verdade do catálogo (em inglês); linha sem livro não aparece
    expect(c.every((x) => x.itens.length > 0)).toBe(true);
    expect(c.find((x) => x.titulo === 'Poesia')!.itens[0]!.titulo).toBe('Os Lusíadas');
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
  it('enquanto o catálogo baixa mostra o andamento; quando chega, monta as linhas sozinho', async () => {
    const { cliente } = clienteComBaixa();
    const fases: EstadoCatalogo[] = [
      { fase: 'baixando', itens: 0, bytes: 1_048_576, total: 5_242_880 },
      { fase: 'importando', itens: 12000 },
    ];
    const comFases: Cliente = {
      chamar: ((cmd: string, args: unknown) =>
        cmd === 'catalogo.estado' && fases.length
          ? Promise.resolve(fases.shift())
          : cliente.chamar(cmd as never, args as never)) as Cliente['chamar'],
    };
    vi.useFakeTimers();
    try {
      const d = criarDescobrir(servicosDeTeste(comFases).s);
      await d.carregar();
      expect(d.store.getState().colecoes).toEqual([]);
      expect(fraseDoCatalogo(d.vigia.store.getState().estado!)).toBe('Baixando o catálogo do Gutenberg… 1 de 5 MB');
      await vi.advanceTimersByTimeAsync(1000);
      expect(fraseDoCatalogo(d.vigia.store.getState().estado!)).toBe('Baixando o catálogo do Gutenberg… 12.000 livros');
      await vi.advanceTimersByTimeAsync(1000);
      await vi.waitFor(() => expect(d.store.getState().colecoes.length).toBeGreaterThan(0));
      expect(d.vigia.store.getState().estado!.fase).toBe('pronto');
    } finally {
      vi.useRealTimers();
    }
  });
  it('catálogo que falhou: a frase traz o motivo e "tentar de novo" manda atualizar', async () => {
    const { cliente } = clienteComBaixa();
    const chamados: string[] = [];
    let falhou = true;
    const comErro: Cliente = {
      chamar: ((cmd: string, args: unknown) => {
        chamados.push(cmd);
        if (cmd === 'catalogo.estado' && falhou)
          return Promise.resolve({ fase: 'erro', itens: 0, mensagem: 'o servidor está em manutenção (erro 503)' });
        if (cmd === 'catalogo.atualizar') falhou = false;
        return cliente.chamar(cmd as never, args as never);
      }) as Cliente['chamar'],
    };
    const d = criarDescobrir(servicosDeTeste(comErro).s);
    await d.carregar();
    expect(fraseDoCatalogo(d.vigia.store.getState().estado!)).toContain('não baixou. o servidor está em manutenção');
    d.vigia.tentarDeNovo();
    await vi.waitFor(() => expect(d.store.getState().colecoes.length).toBeGreaterThan(0));
    expect(chamados).toContain('catalogo.atualizar');
    d.vigia.parar();
  });
});
