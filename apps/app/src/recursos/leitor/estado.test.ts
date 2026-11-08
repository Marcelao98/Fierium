import { describe, expect, it, vi } from 'vitest';
import { servicosDeTeste } from '../../testes/apoio';
import { criarLeitor } from './estado';

async function abrirDomCasmurro() {
  const t = servicosDeTeste();
  const [dc] = await t.s.chamar('obras.listar', { texto: 'dom casmurro' });
  let visivel = true;
  const l = criarLeitor(t.s, () => visivel);
  await l.abrir(dc!.id, dc!.edicoes[0]!.id);
  return { ...t, l, dc: dc!, esconder: () => (visivel = false) };
}

describe('leitor (estado)', () => {
  it('abre com a fonte de texto e as marcações da obra', async () => {
    const { l } = await abrirDomCasmurro();
    const st = l.store.getState();
    expect(st.fonte?.tipo).toBe('texto');
    expect(st.marcacoes.length).toBeGreaterThan(0);
    expect(st.fracao).toBeCloseTo(0.62);
  });
  it('o tempo só conta com a janela visível e a pessoa mexendo nos últimos 2 min', async () => {
    const { l, andar, esconder } = await abrirDomCasmurro();
    l.tique();
    l.tique();
    andar(121_000); // parou de mexer há mais de 2 min
    l.tique();
    l.mexeu();
    l.tique();
    esconder();
    l.tique();
    expect(l.sessao().segundos).toBe(3);
  });
  it('fechar registra a sessão e avisa as outras funcionalidades', async () => {
    const { l, s } = await abrirDomCasmurro();
    const ouvidos: string[] = [];
    s.eventos.ouvir('sessao-registrada', () => ouvidos.push('sessao'));
    s.eventos.ouvir('obra-mudou', () => ouvidos.push('obra'));
    for (let i = 0; i < 10; i++) l.tique();
    const antes = (await s.chamar('estatisticas.resumo', {})).hoje.segundos;
    await l.fechar();
    expect((await s.chamar('estatisticas.resumo', {})).hoje.segundos - antes).toBe(10);
    expect(ouvidos).toEqual(['sessao', 'obra']);
  });
  it('posição grava com atraso e o que estava pendente grava ao fechar', async () => {
    vi.useFakeTimers();
    const { l, s, dc } = await abrirDomCasmurro();
    l.posicaoMudou('1:3:0', 0.9);
    l.posicaoMudou('1:3:0', 0.95);
    await l.fechar();
    vi.useRealTimers();
    const o = await s.chamar('obra.obter', { id: dc.id });
    expect(o.edicoes[0]?.progresso).toMatchObject({ posicao: '1:3:0', fracao: 0.95 });
  });
  it('marcar, mudar a cor e apagar avisam marcacoes-mudaram', async () => {
    const { l, s } = await abrirDomCasmurro();
    let n = 0;
    s.eventos.ouvir('marcacoes-mudaram', () => n++);
    const m = await l.marcar({ tipo: 'texto', capitulo: 0, paragrafo: 0, inicio: 0, fim: 9 }, 'Uma noite', 'ideia');
    await l.mudarMarcacao(m!.id, { cor: 'duvida', nota: 'trem?' });
    expect(l.store.getState().marcacoes.find((x) => x.id === m!.id)).toMatchObject({ cor: 'duvida', nota: 'trem?' });
    await l.apagarMarcacao(m!.id);
    expect(n).toBe(3);
    expect(l.store.getState().marcacoes.some((x) => x.id === m!.id)).toBe(false);
  });
});
