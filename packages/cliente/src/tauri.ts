// Adaptador Tauri (M2): fala com o núcleo Rust pela porta única `chamar` (os mesmos nomes de comando do contrato).
// Recebe a função `invoke` de fora (injeção): o cliente não depende do Tauri e o teste passa um invoke falso.
import type { ArgsDe, NomeComando, RespostaDe } from '@fierium/contratos';
import { ErroFierium, ERRO_SEM_RESPOSTA, paraErroFierium, type Cliente } from './cliente';

export type Invocar = (cmd: string, args: Record<string, unknown>) => Promise<unknown>;

export function criarClienteTauri(invocar: Invocar): Cliente {
  return {
    async chamar<C extends NomeComando>(cmd: C, args: ArgsDe<C>): Promise<RespostaDe<C>> {
      try {
        return (await invocar('chamar', { cmd, args })) as RespostaDe<C>;
      } catch (e) {
        // o Rust devolve { codigo, mensagem }; o resto (IPC quebrado) vira NUCLEO_SEM_RESPOSTA
        const erro = paraErroFierium(e);
        throw erro.codigo === ERRO_SEM_RESPOSTA && typeof e === 'string' ? new ErroFierium(ERRO_SEM_RESPOSTA, e) : erro;
      }
    },
  };
}

/**
 * Adaptador combinado (a migração área por área): os comandos que o Rust já atende vão pro Rust; o resto, pro
 * adaptador de reserva (o exemplo em memória). A cada marco, mais comandos passam pro Rust sem mexer nas telas.
 */
export function criarClienteCombinado(rust: Cliente, reserva: Cliente, noRust: ReadonlySet<string>): Cliente {
  return {
    chamar: (cmd, args) => (noRust.has(cmd) ? rust.chamar(cmd, args) : reserva.chamar(cmd, args)),
  };
}

/** Evita misturar sessões de livros reais com as sessões do acervo de demonstração. */
export function criarClienteSemSessoesDeDemonstracao(cliente: Cliente): Cliente {
  return {
    chamar: (cmd, args) => (cmd === 'sessao.registrar' ? Promise.resolve(null) : cliente.chamar(cmd, args)),
  };
}
