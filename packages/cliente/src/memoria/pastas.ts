// Área "pastas" (M3) no exemplo em memória: guarda as pastas de mentira e finge uma varredura. No app de verdade
// quem responde é o Rust (crates/fierium-biblioteca).
import type { PastaBiblioteca } from '@fierium/contratos';
import { ErroFierium } from '../cliente';
import type { Tratadores } from './base';

export const ESCREVEM_PASTAS = ['pastas.adicionar', 'pastas.remover', 'biblioteca.varrer'] as const;

export function comandosPastas(): Tratadores<
  'pastas.listar' | 'pastas.adicionar' | 'pastas.remover' | 'biblioteca.varrer'
> {
  const pastas: PastaBiblioteca[] = [];
  return {
    'pastas.listar': () => pastas,
    'pastas.adicionar': ({ caminho }) => {
      const c = caminho.trim();
      if (!c.startsWith('/') && !/^[A-Za-z]:\\/.test(c) && !c.startsWith('~'))
        throw new ErroFierium('ARGUMENTO_INVALIDO', `não é um caminho de pasta: "${caminho}"`);
      if (!pastas.some((p) => p.caminho === c)) pastas.push({ caminho: c, existe: true, arquivos: 0 });
      return pastas;
    },
    'pastas.remover': ({ caminho }) => {
      const i = pastas.findIndex((p) => p.caminho === caminho);
      if (i < 0) throw new ErroFierium('NAO_ENCONTRADO', `pasta não está na biblioteca: ${caminho}`);
      pastas.splice(i, 1);
      return pastas;
    },
    'biblioteca.varrer': () => ({ novos: 0, sumiram: 0, total: 0, milissegundos: 1 }),
  };
}
