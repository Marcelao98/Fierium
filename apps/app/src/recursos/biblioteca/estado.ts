// Biblioteca: todas as obras (o mapa precisa de todas), a lista filtrada da grade e os filtros (voltar pra
// Biblioteca mantém onde estava). Só a resposta da última busca vale (digitar rápido não embaralha a lista).
import type { FiltroObras, Obra } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

export interface EstadoBiblioteca {
  todas: Obra[];
  lista: Obra[];
  filtro: FiltroObras;
  visao: 'grade' | 'lista';
  carregando: boolean;
}

export type MudancaFiltro = { [K in keyof FiltroObras]?: FiltroObras[K] | undefined };

export function criarBiblioteca(s: Servicos) {
  const store = createStore<EstadoBiblioteca>(() => ({
    todas: [],
    lista: [],
    filtro: { ordem: 'recentes' },
    visao: 'grade',
    carregando: false,
  }));
  let pedido = 0;

  /** Muda filtros; `undefined` tira o filtro. */
  async function filtrar(m: MudancaFiltro = {}) {
    const filtro = Object.fromEntries(
      Object.entries({ ...store.getState().filtro, ...m }).filter(([, v]) => v !== undefined),
    ) as FiltroObras;
    store.setState({ filtro, carregando: true });
    const meu = ++pedido;
    try {
      const lista = await s.chamar('obras.listar', filtro);
      if (meu === pedido) store.setState({ lista });
    } finally {
      if (meu === pedido) store.setState({ carregando: false });
    }
  }
  async function carregar() {
    const [todas] = await Promise.all([s.chamar('obras.listar', { ordem: 'titulo' }), filtrar()]);
    store.setState({ todas });
  }
  const recarregar = () => void carregar().catch(() => undefined);
  s.eventos.ouvir('obra-mudou', recarregar);
  s.eventos.ouvir('biblioteca-mudou', recarregar);
  s.eventos.ouvir('colecoes-mudaram', recarregar);
  return { store, carregar, filtrar, mudarVisao: (visao: 'grade' | 'lista') => store.setState({ visao }) };
}
export type Biblioteca = ReturnType<typeof criarBiblioteca>;
