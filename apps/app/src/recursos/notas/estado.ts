// Notas: todas as marcações da biblioteca, filtro por cor, busca e editar a nota.
import type { Marcacao, Obra } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

export interface EstadoNotas {
  marcacoes: Marcacao[];
  obras: Map<string, Obra>;
  cor: string | undefined;
  texto: string;
}

export function criarNotas(s: Servicos) {
  const store = createStore<EstadoNotas>(() => ({ marcacoes: [], obras: new Map(), cor: undefined, texto: '' }));
  let pedido = 0;
  async function carregar(m: { cor?: string | undefined; texto?: string } = {}) {
    const st = { ...store.getState(), ...m };
    store.setState({ cor: st.cor, texto: st.texto });
    const meu = ++pedido;
    const [marcacoes, obras] = await Promise.all([
      s.chamar('marcacoes.listar', { ...(st.cor ? { cor: st.cor } : {}), ...(st.texto ? { texto: st.texto } : {}) }),
      s.chamar('obras.listar', {}),
    ]);
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
  };
}
export type Notas = ReturnType<typeof criarNotas>;
