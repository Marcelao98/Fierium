// Notas: todas as marcações da biblioteca (os filtros ficam na tela), editar a nota e apagar.
import type { Marcacao, Obra } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

export interface EstadoNotas {
  marcacoes: Marcacao[];
  obras: Map<string, Obra>;
}

export function criarNotas(s: Servicos) {
  const store = createStore<EstadoNotas>(() => ({ marcacoes: [], obras: new Map() }));
  let pedido = 0;
  async function carregar() {
    const meu = ++pedido;
    const [marcacoes, obras] = await Promise.all([s.chamar('marcacoes.listar', {}), s.chamar('obras.listar', {})]);
    if (meu === pedido) store.setState({ marcacoes, obras: new Map(obras.map((o) => [o.id, o])) });
  }
  s.eventos.ouvir('marcacoes-mudaram', () => void carregar().catch(() => undefined));
  return {
    store,
    carregar,
    async anotar(id: string, nota: string) {
      const nova = await s.chamar('marcacao.atualizar', { id, nota });
      store.setState((e) => ({ marcacoes: e.marcacoes.map((x) => (x.id === id ? nova : x)) }));
    },
    async apagar(id: string) {
      await s.chamar('marcacao.apagar', { id });
      store.setState((e) => ({ marcacoes: e.marcacoes.filter((x) => x.id !== id) }));
    },
  };
}
export type Notas = ReturnType<typeof criarNotas>;
