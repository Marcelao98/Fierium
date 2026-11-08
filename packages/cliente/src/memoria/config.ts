// Área "config" e "app".
import type { Base, Tratadores } from './base';

export const ESCREVEM_CONFIG = ['config.gravar'] as const;

export function comandosConfig(b: Base): Tratadores<'app.info' | 'config.ler' | 'config.gravar'> {
  return {
    'app.info': () => ({ versao: '0.1.0', plataforma: 'navegador', adaptador: 'memória' }),
    'config.ler': () => b.config,
    'config.gravar': ({ config }) => {
      b.config = config;
      return config;
    },
  };
}
