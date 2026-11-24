// Os modos de leitura (Rolagem, Automático, Guiado...) são escritos UMA vez, aqui, e só usam as peças comuns da
// SessaoLeitura (linhas, rolarPor, rolagem, paginar, destacarTrecho, aoInteragir). Por isso valem pra PDF, EPUB e
// qualquer leitor novo que declare essas peças em `capacidades`. Um modo não conhece React nem formato.
import type { Capacidades, SessaoLeitura } from '../motor';

export type IdModo = 'rolagem' | 'automatico' | 'guiado';

/** `rodando`; `pausado` (a pessoa mexeu ou pausou); `fim` (acabou o conteúdo ou não há texto pra seguir). */
export type EstadoModo = 'rodando' | 'pausado' | 'fim';

/** Quem pede os quadros de animação. Em produção é o requestAnimationFrame; nos testes, um relógio manual. */
export interface Agenda {
  /** pede UM quadro (`agora` em ms); devolve o cancelador */
  quadro(ouvinte: (agora: number) => void): () => void;
}

export const agendaDoNavegador: Agenda = {
  quadro(ouvinte) {
    const id = requestAnimationFrame(ouvinte);
    return () => cancelAnimationFrame(id);
  },
};

export interface AmbienteModo {
  /** velocidade inicial na unidade do modo (px/s ou palavras/min) */
  velocidade: number;
  agenda?: Agenda;
  /** o estado mudou (a casca atualiza o botão). Nunca é chamado por quadro. */
  aoMudar?(estado: EstadoModo): void;
}

export interface InstanciaModo {
  definirVelocidade(v: number): void;
  pausar(): void;
  retomar(): void;
  estado(): EstadoModo;
  /** desfaz tudo (laço, ouvintes, destaque) */
  parar(): void;
}

export interface FaixaVelocidade {
  min: number;
  max: number;
  passo: number;
  padrao: number;
}

export interface ModoLeitura {
  id: IdModo;
  rotulo: string;
  /** como a velocidade é dita ("px/s", "palavras/min"); vazio quando o modo não tem velocidade */
  unidade: string;
  faixa: FaixaVelocidade | null;
  /** as peças comuns que a sessão precisa ter pra este modo funcionar */
  precisa: readonly (keyof Capacidades)[];
  iniciar(sessao: SessaoLeitura, ambiente: AmbienteModo): InstanciaModo;
}

/** O modo está disponível se a sessão declara todas as peças que ele usa. */
export function modoDisponivel(modo: ModoLeitura, c: Capacidades | undefined): boolean {
  return modo.precisa.every((p) => !!c?.[p]);
}
