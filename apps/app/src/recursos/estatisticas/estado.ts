import type { Meta, ResumoEstatisticas } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

export function criarEstatisticas(s: Servicos) {
  const store = createStore<{ resumo: ResumoEstatisticas | null }>(() => ({ resumo: null }));
  const carregar = async () => store.setState({ resumo: await s.chamar('estatisticas.resumo', {}) });
  s.eventos.ouvir('sessao-registrada', () => void carregar().catch(() => undefined));
  return {
    store,
    carregar,
    async salvarMetas(metas: Meta[]) {
      await s.chamar('metas.salvar', { metas });
      await carregar();
    },
  };
}
export type Estatisticas = ReturnType<typeof criarEstatisticas>;
