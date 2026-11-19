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
  avisar: (texto: string, tipo?: 'info' | 'erro', detalhes?: string) => void;
  /** abre o seletor de pastas do sistema (só no app; no navegador é null). Devolve as pastas, ou [] se cancelou */
  escolherPastas: (() => Promise<string[]>) | null;
  /** abre um link https no navegador do sistema; false se não conseguiu */
  abrirLink: (url: string) => Promise<boolean>;
  /** liga/desliga a tela cheia da janela; false se não conseguiu */
  telaCheia: (ligar: boolean) => Promise<boolean>;
}

export interface OpcoesServicos {
  log?: Log;
  agora?: () => number;
  avisar?: Servicos['avisar'];
  escolherPastas?: Servicos['escolherPastas'];
  abrirLink?: Servicos['abrirLink'];
  telaCheia?: Servicos['telaCheia'];
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
    escolherPastas: op.escolherPastas ?? null,
    abrirLink: op.abrirLink ?? (() => Promise.resolve(false)),
    telaCheia: op.telaCheia ?? (() => Promise.resolve(false)),
    async chamar(cmd, args) {
      try {
        return await rastreado.chamar(cmd, args);
      } catch (e) {
        const erro: ErroFierium = paraErroFierium(e);
        // o aviso leva os detalhes (comando, código, mensagem) pra pessoa copiar e mandar
        aviso(
          `${erro.mensagem} (${erro.codigo})`,
          'erro',
          `Comando: ${cmd}\nCódigo: ${erro.codigo}\nMensagem: ${erro.mensagem}`,
        );
        throw erro;
      }
    },
  };
}
