import type { Config } from '@fierium/contratos';
import { create } from 'zustand';
import { chamar } from './servicos';

export const useConfig = create<{ config: Config | null }>(() => ({ config: null }));

/** Aplica tema e movimento na página. "sistema" segue o tema do computador. */
function aplicar(c: Config) {
  const raiz = document.documentElement;
  const escuro = matchMedia('(prefers-color-scheme: dark)').matches;
  raiz.dataset.tema = c.tema === 'sistema' ? (escuro ? 'noite' : 'lucido') : c.tema;
  const reduzido = c.movimento === 'reduzido' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  raiz.dataset.movimento = reduzido ? 'reduzido' : 'normal';
}

export async function carregarConfig() {
  const config = await chamar('config.ler', {});
  aplicar(config);
  useConfig.setState({ config });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const c = useConfig.getState().config;
    if (c) aplicar(c);
  });
}

export async function mudarConfig(m: (c: Config) => Config) {
  const atual = useConfig.getState().config;
  if (!atual) return;
  const novo = m(structuredClone(atual));
  aplicar(novo);
  useConfig.setState({ config: novo });
  await chamar('config.gravar', { config: novo });
}

export function movimentoReduzido(): boolean {
  return document.documentElement.dataset.movimento === 'reduzido';
}
