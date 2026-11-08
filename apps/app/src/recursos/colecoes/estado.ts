// Coleções: espaços que a pessoa monta, cada um com a sua cor.
import type { Colecao, Obra } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

export function criarColecoes(s: Servicos) {
  const store = createStore<{ colecoes: Colecao[]; todas: Obra[] }>(() => ({ colecoes: [], todas: [] }));
  async function carregar() {
    const [colecoes, todas] = await Promise.all([
      s.chamar('colecoes.listar', {}),
      s.chamar('obras.listar', { ordem: 'titulo' }),
    ]);
    store.setState({ colecoes, todas });
  }
  return {
    store,
    carregar,
    async criar(nome: string, descricao: string, matiz: number) {
      const c = await s.chamar('colecao.criar', { nome, descricao, matiz });
      store.setState((e) => ({ colecoes: [...e.colecoes, c] }));
      s.eventos.emitir('colecoes-mudaram', {});
      s.avisar(`Coleção "${c.nome}" criada`);
      return c;
    },
    async definirObras(id: string, obraIds: string[]) {
      await s.chamar('colecao.definirObras', { id, obraIds });
      await carregar();
      s.eventos.emitir('colecoes-mudaram', {});
    },
  };
}
export type Colecoes = ReturnType<typeof criarColecoes>;
