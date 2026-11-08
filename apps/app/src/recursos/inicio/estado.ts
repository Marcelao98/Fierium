// Início: o "continuar lendo", em andamento, uma marcação antiga, nunca abertos e os que chegaram por último.
import type { Limiar } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

export function criarInicio(s: Servicos) {
  const store = createStore<{ limiar: Limiar | null }>(() => ({ limiar: null }));
  const carregar = async () => store.setState({ limiar: await s.chamar('biblioteca.limiar', {}) });
  const recarregar = () => void carregar().catch(() => undefined); // o aviso e o log já mostraram o erro
  s.eventos.ouvir('obra-mudou', recarregar);
  s.eventos.ouvir('biblioteca-mudou', recarregar);
  s.eventos.ouvir('marcacoes-mudaram', recarregar);
  return { store, carregar };
}
export type Inicio = ReturnType<typeof criarInicio>;
