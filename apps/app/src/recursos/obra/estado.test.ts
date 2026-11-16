import { bibliotecaDeExemplo } from '@fierium/cliente';
import { describe, expect, it } from 'vitest';
import { AGORA, servicosDeTeste } from '../../testes/apoio';
import { criarObra, parecidas } from './estado';

describe('página da obra (estado)', () => {
  it('parecidas: mesmo autor primeiro', () => {
    const { obras } = bibliotecaDeExemplo(AGORA);
    const dc = obras.find((o) => o.titulo === 'Dom Casmurro')!;
    expect(
      parecidas(dc, obras)
        .slice(0, 2)
        .map((o) => o.criadores[0]?.nome),
    ).toEqual(['Machado de Assis', 'Machado de Assis']);
  });
  it('favoritar avisa que a obra mudou', async () => {
    const { s } = servicosDeTeste();
    const e = criarObra(s);
    const [o] = await s.chamar('obras.listar', { texto: 'iracema' });
    const vistos: string[] = [];
    s.eventos.ouvir('obra-mudou', (d) => vistos.push(d.obraId));
    await e.abrir(o!.id);
    await e.favoritar(true);
    expect(e.store.getState().obra?.relacao.favorita).toBe(true);
    expect(vistos).toEqual([o!.id]);
  });
  it('juntar traz as edições da outra obra e avisa a biblioteca; separar devolve a obra nova', async () => {
    const { s } = servicosDeTeste();
    const e = criarObra(s);
    const [dc] = await s.chamar('obras.listar', { texto: 'dom casmurro' });
    const [ira] = await s.chamar('obras.listar', { texto: 'iracema' });
    let mudou = 0;
    s.eventos.ouvir('biblioteca-mudou', () => mudou++);
    await e.abrir(dc!.id);
    await e.juntar(ira!.id);
    expect(e.store.getState().obra?.edicoes.length).toBe(2);
    expect(mudou).toBe(1);
    const nova = await e.separar(ira!.edicoes[0]!.id);
    expect(nova).not.toBe(dc!.id);
    expect(e.store.getState().obra?.edicoes.length).toBe(1);
    expect((await s.chamar('obra.obter', { id: nova })).edicoes[0]?.id).toBe(ira!.edicoes[0]!.id);
    expect(mudou).toBe(2);
  });
});
