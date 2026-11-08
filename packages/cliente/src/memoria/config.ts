// Área "config" e "app".
import type { Base, Tratadores } from './base';

export const ESCREVEM_CONFIG = ['config.gravar'] as const;

export function comandosConfig(
  b: Base,
): Tratadores<'app.info' | 'app.comandos' | 'log.escrever' | 'config.ler' | 'config.gravar'> {
  return {
    'app.info': () => ({ versao: '0.2.0', plataforma: 'navegador', adaptador: 'memória' }),
    'app.comandos': () => [],
    // sem núcleo Rust, o log fica só no anel da interface (inspetor)
    'log.escrever': () => null,
    'config.ler': () => b.config,
    'config.gravar': ({ config }) => {
      b.config = config;
      return config;
    },
  };
}
