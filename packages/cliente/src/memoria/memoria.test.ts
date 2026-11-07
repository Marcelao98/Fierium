import { describe, expect, it } from 'vitest';
import { ErroFierium } from '../cliente';
import { criarClienteMemoria } from './memoria';
import { combina, normalizar } from './normalizar';
import { recorde, sequencia } from './estatisticas';
import { DOM_CASMURRO } from './texto-demo';

const AGORA = new Date(2026, 10, 7, 20, 0, 0).getTime();
const cliente = () => criarClienteMemoria({ agora: () => AGORA });

describe('busca', () => {
  it('sem acento e com as palavras em qualquer ordem', () => {
    expect(normalizar('Memórias Póstumas')).toBe('memorias postumas');
    expect(combina('casmurro dom', 'Dom Casmurro')).toBe(true);
    expect(combina('postumas', 'Memórias Póstumas de Brás Cubas')).toBe(true);
    expect(combina('xyz', 'Dom Casmurro')).toBe(false);
  });
  it('obras.listar acha pelo autor e pelo assunto', async () => {
    const c = cliente();
    expect((await c.chamar('obras.listar', { texto: 'machado' })).length).toBe(3);
    expect((await c.chamar('obras.listar', { texto: 'estoicismo' })).map((o) => o.titulo)).toEqual(['Meditações']);
  });
  it('série em ordem de volume pelo título', async () => {
    const l = await cliente().chamar('obras.listar', { reino: 'Mangá', ordem: 'titulo', texto: 'lamina' });
    expect(l.map((o) => o.serie?.volume)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('limiar', () => {
  it('o último sonho é Dom Casmurro e o eco é uma marcação antiga', async () => {
    const l = await cliente().chamar('biblioteca.limiar', {});
    expect(l.ultimo?.titulo).toBe('Dom Casmurro');
    expect(l.totalObras).toBe(40);
    expect(l.eco && AGORA - l.eco.marcacao.criadaEm).toBeGreaterThan(30 * 86_400_000);
  });
});

describe('marcações', () => {
  it('as âncoras do exemplo apontam pro texto de verdade', async () => {
    const ms = await cliente().chamar('marcacoes.listar', {});
    for (const m of ms.filter((x) => x.ancora.tipo === 'texto')) {
      const a = m.ancora as { capitulo: number; paragrafo: number; inicio: number; fim: number };
      expect(DOM_CASMURRO[a.capitulo]!.paragrafos[a.paragrafo]!.slice(a.inicio, a.fim)).toBe(m.trecho);
    }
  });
  it('criar, mudar a cor, anotar e apagar (e a ligação some junto)', async () => {
    const c = cliente();
    const dc = (await c.chamar('obras.listar', { texto: 'dom casmurro' }))[0]!;
    const m = await c.chamar('marcacao.criar', {
      obraId: dc.id,
      edicaoId: dc.edicoes[0]!.id,
      tipo: 'destaque',
      ancora: { tipo: 'texto', capitulo: 0, paragrafo: 0, inicio: 0, fim: 10 },
      trecho: 'Uma noite',
      cor: 'ideia',
      etiquetas: [],
      ligacoes: [],
    });
    const outra = (await c.chamar('marcacoes.listar', {})).find((x) => x.id !== m.id)!;
    await c.chamar('marcacao.atualizar', { id: outra.id, ligacoes: [...outra.ligacoes, m.id] });
    const mudada = await c.chamar('marcacao.atualizar', { id: m.id, cor: 'duvida', nota: 'por que o trem?' });
    expect([mudada.cor, mudada.nota]).toEqual(['duvida', 'por que o trem?']);
    await c.chamar('marcacao.apagar', { id: m.id });
    const depois = await c.chamar('marcacoes.listar', {});
    expect(depois.some((x) => x.id === m.id)).toBe(false);
    expect(depois.find((x) => x.id === outra.id)!.ligacoes).not.toContain(m.id);
  });
  it('erro tem código e mensagem em português', async () => {
    const e = await cliente()
      .chamar('marcacao.apagar', { id: 'nao-existe' })
      .catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroFierium);
    expect((e as ErroFierium).codigo).toBe('NAO_ENCONTRADO');
  });
  it('a tela não mexe no estado por engano (cada resposta é uma cópia)', async () => {
    const c = cliente();
    const [o] = await c.chamar('obras.listar', { texto: 'dom casmurro' });
    o!.titulo = 'estragado';
    expect((await c.chamar('obra.obter', { id: o!.id })).titulo).toBe('Dom Casmurro');
  });
});

describe('estatísticas', () => {
  const dia = (segundos: number) => ({ dia: '', segundos, paginas: 0 });
  it('hoje sem leitura não quebra a sequência; 5 min é o mínimo', () => {
    expect(sequencia([dia(0), dia(400), dia(400), dia(0)])).toBe(2);
    expect(sequencia([dia(400), dia(299), dia(400)])).toBe(1);
    expect(recorde([dia(400), dia(400), dia(0), dia(400), dia(400), dia(400)])).toBe(3);
  });
  it('sessão nova entra no hoje e nas metas de minutos', async () => {
    const c = cliente();
    const antes = await c.chamar('estatisticas.resumo', {});
    const dc = (await c.chamar('obras.listar', { texto: 'dom casmurro' }))[0]!;
    await c.chamar('sessao.registrar', { edicaoId: dc.edicoes[0]!.id, segundos: 600, paginas: 7 });
    const depois = await c.chamar('estatisticas.resumo', {});
    expect(depois.hoje.segundos - antes.hoje.segundos).toBe(600);
    expect(depois.dias).toHaveLength(365);
    const minutos = depois.metas.find((m) => m.meta.tipo === 'minutos')!;
    expect(minutos.feito).toBeGreaterThanOrEqual(10);
  });
});

describe('guardar entre recarregamentos', () => {
  it('o que muda volta depois de recarregar', async () => {
    const mem = new Map<string, string>();
    const guardar = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
    const a = criarClienteMemoria({ agora: () => AGORA, guardar });
    const [o] = await a.chamar('obras.listar', { texto: 'iracema' });
    await a.chamar('obra.atualizar', { id: o!.id, favorita: true });
    const b = criarClienteMemoria({ agora: () => AGORA, guardar });
    expect((await b.chamar('obra.obter', { id: o!.id })).relacao.favorita).toBe(true);
  });
});
