// Os leitores que o app conhece. Cada um é carregado SOB DEMANDA (import dinâmico) na hora de abrir um livro daquele
// formato: o pdf.js, o epub.js e o DOMPurify não entram no pacote que abre o app. Acrescentar um formato = um pacote
// `packages/leitor-<nome>` (docs/ARQUITETURA.md, § leitores) e uma linha aqui.
import type { FonteLeitura } from '@fierium/contratos';
import { carregarMotor, type MotorDeLeitura, type RegistroMotor } from '@fierium/leitor-base';

export const REGISTROS: readonly RegistroMotor[] = [
  {
    nome: 'pdf',
    aceita: (f) => f.tipo === 'arquivo' && f.formato === 'pdf',
    carregar: async () => (await import('@fierium/leitor-pdf')).motorPdf,
  },
  {
    nome: 'epub',
    aceita: (f) => f.tipo === 'arquivo' && f.formato === 'epub',
    carregar: async () => (await import('@fierium/leitor-epub')).motorEpub,
  },
  {
    nome: 'texto',
    aceita: (f) => f.tipo === 'texto',
    carregar: async () => (await import('@fierium/leitor-texto')).motorTexto,
  },
];

export const abrirMotor = (fonte: FonteLeitura): Promise<MotorDeLeitura> => carregarMotor(REGISTROS, fonte);
