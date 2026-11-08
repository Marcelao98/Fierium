// As preferências (tema, movimento, leitura, cores das marcações). Infraestrutura do app: a casca e as
// funcionalidades leem daqui; só os Ajustes e o leitor mudam.
import type { Config } from '@fierium/contratos';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Servicos } from './servicos';

export interface ConfigApp {
  store: StoreApi<{ config: Config | null }>;
  carregar(): Promise<void>;
  mudar(m: (c: Config) => Config): Promise<void>;
}

/** Aplica tema e movimento na página. "sistema" segue o tema do computador. */
export function aplicarNaPagina(c: Config, raiz: HTMLElement = document.documentElement) {
  const escuro = matchMedia('(prefers-color-scheme: dark)').matches;
  raiz.dataset.tema = c.tema === 'sistema' ? (escuro ? 'noite' : 'lucido') : c.tema;
  const reduzido = c.movimento === 'reduzido' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  raiz.dataset.movimento = reduzido ? 'reduzido' : 'normal';
}

export function criarConfig(s: Servicos, aplicar: (c: Config) => void = aplicarNaPagina): ConfigApp {
  const store = createStore<{ config: Config | null }>(() => ({ config: null }));
  return {
    store,
    async carregar() {
      const config = await s.chamar('config.ler', {});
      aplicar(config);
      store.setState({ config });
    },
    async mudar(m) {
      const atual = store.getState().config;
      if (!atual) return;
      const novo = m(structuredClone(atual));
      aplicar(novo);
      store.setState({ config: novo });
      await s.chamar('config.gravar', { config: novo });
    },
  };
}
