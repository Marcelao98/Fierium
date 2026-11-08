// Adaptador em memória (D4/D5): imita os comandos que o núcleo Rust vai ter, com a biblioteca de exemplo. É o que o
// `pnpm dev` e os testes usam. Dividido por área, igual ao Rust: cada área (obras.ts, colecoes.ts, leitura.ts…)
// troca pelo Rust de verdade sem mexer nas outras. Cada comando devolve uma CÓPIA (a tela nunca mexe no estado
// daqui por engano) e guarda as mudanças (localStorage, se der) pra sobreviverem a um recarregar.
import type { ArgsDe, NomeComando, RespostaDe } from '@fierium/contratos';
import { ErroFierium, type Cliente } from '../cliente';
import { criarBase, type Guardar, type Tratadores } from './base';
import { comandosBusca } from './busca';
import { comandosColecoes, ESCREVEM_COLECOES } from './colecoes';
import { comandosConfig, ESCREVEM_CONFIG } from './config';
import { comandosEstatisticas, ESCREVEM_ESTATISTICAS } from './estatisticas';
import { comandosLeitura, ESCREVEM_LEITURA } from './leitura';
import { comandosMarcacoes, ESCREVEM_MARCACOES } from './marcacoes';
import { comandosObras, ESCREVEM_OBRAS } from './obras';

export { CONFIG_PADRAO } from './base';

export interface OpcoesMemoria {
  /** relógio (os testes passam um fixo) */
  agora?: () => number;
  /** onde guardar entre recarregamentos; null = só na memória */
  guardar?: Guardar | null;
  /** atraso artificial em ms (pra ver os estados de carregando) */
  atraso?: number;
  /** começa como na primeira vez (abertura) */
  primeiraVez?: boolean;
}

export function criarClienteMemoria(op: OpcoesMemoria = {}): Cliente {
  const b = criarBase(op.agora ?? Date.now, op.guardar ?? null, op.primeiraVez ?? true);
  // o tipo garante que TODOS os comandos do contrato têm tratador (faltou um = não compila)
  const comandos: Tratadores<NomeComando> = {
    ...comandosConfig(b),
    ...comandosObras(b),
    ...comandosColecoes(b),
    ...comandosLeitura(b),
    ...comandosMarcacoes(b),
    ...comandosEstatisticas(b),
    ...comandosBusca(b),
  };
  const escrevem = new Set<NomeComando>([
    ...ESCREVEM_CONFIG,
    ...ESCREVEM_OBRAS,
    ...ESCREVEM_COLECOES,
    ...ESCREVEM_LEITURA,
    ...ESCREVEM_MARCACOES,
    ...ESCREVEM_ESTATISTICAS,
  ]);
  return {
    async chamar<C extends NomeComando>(cmd: C, args: ArgsDe<C>): Promise<RespostaDe<C>> {
      if (op.atraso) await new Promise((ok) => setTimeout(ok, op.atraso));
      const f = (comandos as Partial<Tratadores<NomeComando>>)[cmd] as ((a: ArgsDe<C>) => RespostaDe<C>) | undefined;
      if (!f) throw new ErroFierium('COMANDO_DESCONHECIDO', `comando desconhecido: ${String(cmd)}`);
      const r = f(structuredClone(args));
      if (escrevem.has(cmd)) b.salvar();
      return structuredClone(r);
    },
  };
}
