// O registro dos leitores: cada formato diz se aceita a fonte e como CARREGAR o motor (import dinâmico), então o app só
// baixa o pdf.js ou o epub.js na hora de abrir um livro daquele formato. Acrescentar um leitor = uma linha na lista.
import type { FonteLeitura } from '@fierium/contratos';
import { erroSemLeitor, type MotorDeLeitura } from './motor';

export interface RegistroMotor {
  /** nome curto pro log ("pdf", "epub"…) */
  nome: string;
  aceita(f: FonteLeitura): boolean;
  /** carrega o motor (um `import()` do pacote do leitor) */
  carregar(): Promise<MotorDeLeitura>;
}

/** O registro que aceita a fonte (o primeiro da lista), sem carregar nada. */
export function escolherRegistro(registros: readonly RegistroMotor[], fonte: FonteLeitura): RegistroMotor {
  const r = registros.find((x) => x.aceita(fonte));
  if (!r) throw erroSemLeitor(fonte);
  return r;
}

/** Escolhe e carrega o motor sob demanda. */
export async function carregarMotor(registros: readonly RegistroMotor[], fonte: FonteLeitura): Promise<MotorDeLeitura> {
  return escolherRegistro(registros, fonte).carregar();
}
