// Raiz da composição: o ÚNICO lugar que conhece todas as funcionalidades. Cria cada uma com os serviços
// (injeção de dependências). Testes de fluxo e o inspetor usam o mesmo objeto (window.__fierium em desenvolvimento).
import type { Cliente } from '@fierium/cliente';
import { criarConfig } from './nucleo/config';
import { criarServicos, type OpcoesServicos } from './nucleo/servicos';
import { criarBiblioteca } from './recursos/biblioteca/estado';
import { criarColecoes } from './recursos/colecoes/estado';
import { criarEstatisticas } from './recursos/estatisticas/estado';
import { criarInicio } from './recursos/inicio/estado';
import { criarLeitor } from './recursos/leitor/estado';
import { criarNotas } from './recursos/notas/estado';
import { criarObra } from './recursos/obra/estado';

export function montar(cliente: Cliente, op: OpcoesServicos = {}) {
  const servicos = criarServicos(cliente, op);
  return {
    servicos,
    config: criarConfig(servicos),
    recursos: {
      inicio: criarInicio(servicos),
      biblioteca: criarBiblioteca(servicos),
      obra: criarObra(servicos),
      colecoes: criarColecoes(servicos),
      leitor: criarLeitor(servicos),
      notas: criarNotas(servicos),
      estatisticas: criarEstatisticas(servicos),
    },
  };
}

export type AppMontado = ReturnType<typeof montar>;
export type Recursos = AppMontado['recursos'];
