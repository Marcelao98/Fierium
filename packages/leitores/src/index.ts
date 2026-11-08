// @fierium/leitores — os motores de leitura (um por formato) e a tomada comum (MotorDeLeitura).
// Sem React e sem o núcleo: cada motor é testável sozinho com um DOM falso (jsdom).
export * from './motor';
export { motorEpub } from './epub/motor-epub';
export { motorPdf } from './pdf/motor-pdf';
export { motorTexto, deslocamento, pedacos } from './texto/motor-texto';
import { motorEpub } from './epub/motor-epub';
import type { MotorDeLeitura } from './motor';
import { motorPdf } from './pdf/motor-pdf';
import { motorTexto } from './texto/motor-texto';

/** Os motores disponíveis, na ordem em que são tentados. */
export const MOTORES: readonly MotorDeLeitura[] = [motorPdf, motorEpub, motorTexto];
