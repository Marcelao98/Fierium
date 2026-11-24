import { modoAutomatico } from './automatico';
import { modoGuiado } from './guiado';
import { modoRolagem } from './rolagem';
import type { IdModo, ModoLeitura } from './tipos';

export { modoAutomatico } from './automatico';
export { duracaoDaLinha, modoGuiado, palavrasDe } from './guiado';
export { modoRolagem } from './rolagem';
export { criarLaco, criarRolador } from './laco';
export {
  agendaDoNavegador,
  modoDisponivel,
  type Agenda,
  type AmbienteModo,
  type EstadoModo,
  type FaixaVelocidade,
  type IdModo,
  type InstanciaModo,
  type ModoLeitura,
} from './tipos';

/** Os modos de leitura, na ordem do menu. Acrescentar um modo = escrevê-lo (só com peças comuns) e pôr aqui. */
export const MODOS: readonly ModoLeitura[] = [modoRolagem, modoAutomatico, modoGuiado];

export const modoPorId = (id: IdModo): ModoLeitura => MODOS.find((m) => m.id === id) ?? modoRolagem;
