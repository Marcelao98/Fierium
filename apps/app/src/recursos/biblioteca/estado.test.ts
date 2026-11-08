import type { Cliente } from '@fierium/cliente';
import { criarClienteMemoria } from '@fierium/cliente';
import { describe, expect, it } from 'vitest';
import { AGORA, servicosDeTeste } from '../../testes/apoio';
import { criarBiblioteca } from './estado';

describe('biblioteca (estado)', () => {
  it('filtros se somam e undefined tira o filtro', async () => {
    const { s } = servicosDeTeste();
    const b = criarBiblioteca(s);
    await b.filtrar({ reino: 'Filosofia' });
    expect(b.store.getState().lista.every((o) => o.reino === 'Filosofia')).toBe(true);
    await b.filtrar({ texto: 'platao' });
    expect(
      b.store
        .getState()
        .lista.map((o) => o.titulo)
        .sort(),
    ).toEqual(['A República', 'O Banquete']);
    await b.filtrar({ reino: undefined, texto: undefined });
    expect(b.store.getState().lista).toHaveLength(40);
  });
  it('só a resposta da última busca vale (digitar rápido não embaralha)', async () => {
    const mem = criarClienteMemoria({ agora: () => AGORA });
    // a primeira busca demora mais que a segunda
    const lento: Cliente = {
      chamar: async (cmd, args) => {
        if (cmd === 'obras.listar' && (args as { texto?: string }).texto === 'a')
          await new Promise((r) => setTimeout(r, 30));
        return mem.chamar(cmd, args);
      },
    };
    const b = criarBiblioteca(servicosDeTeste(lento).s);
    const p1 = b.filtrar({ texto: 'a' });
    const p2 = b.filtrar({ texto: 'machado' });
    await Promise.all([p1, p2]);
    expect(b.store.getState().lista.map((o) => o.criadores[0]?.nome)).toEqual([
      'Machado de Assis',
      'Machado de Assis',
      'Machado de Assis',
    ]);
    expect(b.store.getState().filtro.texto).toBe('machado');
  });
  it('recarrega sozinha quando uma obra muda (evento)', async () => {
    const { s } = servicosDeTeste();
    const b = criarBiblioteca(s);
    await b.carregar();
    const alvo = b.store.getState().todas.find((o) => o.titulo === 'Iracema')!;
    await s.chamar('obra.atualizar', { id: alvo.id, favorita: true });
    s.eventos.emitir('obra-mudou', { obraId: alvo.id });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(b.store.getState().todas.find((o) => o.id === alvo.id)?.relacao.favorita).toBe(true);
  });
});
