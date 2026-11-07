import type { ResultadoBusca } from '@fierium/contratos';
import { chamar } from './servicos';

export function buscarTudo(texto: string): Promise<ResultadoBusca[]> {
  return chamar('busca.tudo', { texto });
}
