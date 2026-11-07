// A porta (D5): o que a interface precisa do núcleo, sem saber se responde o adaptador em memória (M1), o Tauri (M2)
// ou um servidor HTTP (futuro). Cada adaptador implementa `chamar` com os mesmos comandos de @fierium/contratos.
import type { ArgsDe, ErroContrato, NomeComando, RespostaDe } from '@fierium/contratos';

export interface Cliente {
  /** Chama um comando do contrato. Rejeita sempre com ErroFierium (código estável + mensagem em português). */
  chamar<C extends NomeComando>(cmd: C, args: ArgsDe<C>): Promise<RespostaDe<C>>;
}

/** Erro com o código do contrato. Nunca um erro genérico. */
export class ErroFierium extends Error implements ErroContrato {
  readonly codigo: string;
  readonly mensagem: string;
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = 'ErroFierium';
    this.codigo = codigo;
    this.mensagem = mensagem;
  }
}

/** Códigos que a própria interface gera quando a conversa com o núcleo falha. */
export const ERRO_SEM_RESPOSTA = 'NUCLEO_SEM_RESPOSTA';

export function paraErroFierium(e: unknown): ErroFierium {
  if (e instanceof ErroFierium) return e;
  if (e && typeof e === 'object' && 'codigo' in e && 'mensagem' in e)
    return new ErroFierium(String((e as ErroContrato).codigo), String((e as ErroContrato).mensagem));
  return new ErroFierium(ERRO_SEM_RESPOSTA, e instanceof Error ? e.message : String(e));
}
