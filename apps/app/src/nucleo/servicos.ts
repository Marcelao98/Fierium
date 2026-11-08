// As dependências do app, criadas uma vez no main.tsx e entregues a cada funcionalidade (injeção de dependências).
// Nos testes: criarServicos(clienteFalso, { agora: () => fixo }) e a store fica isolada (sem tela, sem Rust).
import { paraErroFierium, rastrear, type Cliente, type ErroFierium } from '@fierium/cliente';
import type { ArgsDe, NomeComando, RespostaDe } from '@fierium/contratos';
import { criarLog, type Log } from '@fierium/diagnostico';
import { avisar } from './avisos';
import { criarEventos, type Eventos } from './eventos';

export interface Servicos {
  /** chama um comando do núcleo; se falhar, registra, mostra o aviso e rejeita com ErroFierium */
  chamar<C extends NomeComando>(cmd: C, args: ArgsDe<C>): Promise<RespostaDe<C>>;
  log: Log;
  eventos: Eventos;
  agora: () => number;
  /** mostra um aviso (o padrão é o aviso da tela; os testes trocam) */
  avisar: (texto: string, tipo?: 'info' | 'erro') => void;
}

export interface OpcoesServicos {
  log?: Log;
  agora?: () => number;
  avisar?: Servicos['avisar'];
}

export function criarServicos(cliente: Cliente, op: OpcoesServicos = {}): Servicos {
  const log = op.log ?? criarLog();
  const aviso = op.avisar ?? avisar;
  const rastreado = rastrear(cliente, log);
  const eventos = criarEventos((e, dados) => log.registrar('debug', 'evento', e, { dados }));
  return {
    log,
    eventos,
    agora: op.agora ?? Date.now,
    avisar: aviso,
    async chamar(cmd, args) {
      try {
        return await rastreado.chamar(cmd, args);
      } catch (e) {
        const erro: ErroFierium = paraErroFierium(e);
        aviso(`${erro.mensagem} (${erro.codigo})`, 'erro');
        throw erro;
      }
    },
  };
}
