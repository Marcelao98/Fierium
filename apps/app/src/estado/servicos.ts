// Onde as stores pegam o cliente (a porta pro núcleo). As telas nunca chegam aqui (regra de camadas).
import { paraErroFierium, type Cliente } from '@fierium/cliente';
import type { ArgsDe, NomeComando, RespostaDe } from '@fierium/contratos';
import { avisar } from './avisos';

let cliente: Cliente | null = null;

export function ligarCliente(c: Cliente) {
  cliente = c;
}

/** Chama um comando; se der erro, mostra o aviso (código + mensagem) e repassa o erro. */
export async function chamar<C extends NomeComando>(cmd: C, args: ArgsDe<C>): Promise<RespostaDe<C>> {
  if (!cliente) throw new Error('cliente não ligado (main.tsx chama ligarCliente antes da primeira tela)');
  try {
    return await cliente.chamar(cmd, args);
  } catch (e) {
    const erro = paraErroFierium(e);
    avisar(`${erro.mensagem} (${erro.codigo})`, 'erro');
    throw erro;
  }
}
