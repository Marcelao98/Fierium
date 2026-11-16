// Internet e catálogos (D30): o interruptor de rede e as fontes do catálogo (quantos itens, quando atualizou).
import type { FonteCatalogo } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

interface EstadoInternet {
  permitida: boolean;
  fontes: FonteCatalogo[];
  /** fontes sendo atualizadas agora */
  atualizando: string[];
  erro: string | null;
}

export function criarInternet(s: Servicos) {
  const store = createStore<EstadoInternet>(() => ({ permitida: true, fontes: [], atualizando: [], erro: null }));
  const falhou = (e: unknown) => store.setState({ erro: (e as { mensagem?: string }).mensagem ?? String(e) }); // o aviso já saiu

  async function carregar() {
    try {
      const [rede, fontes] = await Promise.all([s.chamar('rede.ler', {}), s.chamar('catalogo.fontes', {})]);
      store.setState({ permitida: rede.permitida, fontes, erro: null });
    } catch (e) {
      falhou(e);
    }
  }
  async function definir(permitida: boolean) {
    try {
      const r = await s.chamar('rede.definir', { permitida });
      store.setState({ permitida: r.permitida, erro: null });
    } catch (e) {
      falhou(e);
    }
  }
  async function atualizar(fonte: string) {
    store.setState((e) => ({ atualizando: [...e.atualizando, fonte], erro: null }));
    try {
      const nova = await s.chamar('catalogo.atualizar', { fonte });
      store.setState((e) => ({ fontes: e.fontes.map((f) => (f.id === nova.id ? nova : f)) }));
      s.eventos.emitir('biblioteca-mudou', {});
    } catch (e) {
      falhou(e);
    } finally {
      store.setState((e) => ({ atualizando: e.atualizando.filter((f) => f !== fonte) }));
    }
  }
  return { store, carregar, definir, atualizar };
}
export type Internet = ReturnType<typeof criarInternet>;
