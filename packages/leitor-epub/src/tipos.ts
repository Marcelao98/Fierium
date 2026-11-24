// O estado compartilhado dos módulos do motor de EPUB (um "contexto" por sessão). O epub.js não traz tipos completos,
// então o que vem dele é `Epubjs` (qualquer): usamos só o que precisamos e cada módulo diz o que espera.
import type { ConfigLeitura, CorMarcacao, Marcacao } from '@fierium/contratos';
import type { OpcoesMotor } from '@fierium/leitor-base';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Epubjs = any;

export interface EstadoMarcas {
  marcacoes: Marcacao[];
  cores: CorMarcacao[];
  selecionada: string | null;
}

export interface CtxEpub {
  op: OpcoesMotor;
  doc: Document;
  /** o elemento do app que contém tudo (botões + palco) */
  raiz: HTMLDivElement;
  /** onde o epub.js desenha (ele cria `.epub-container` com o iframe do capítulo aqui dentro) */
  palco: HTMLDivElement;
  book: Epubjs;
  rendition: Epubjs;
  marcas: EstadoMarcas;
  aparencia: ConfigLeitura;
  /** há uma seleção avisada à casca (pra avisar o "sem seleção" depois) */
  comSelecao: boolean;
  ultimoCfi: string;
  /** índice do capítulo atual na espinha do livro (0..) */
  ultimoIndice: number;
  /** quem quer saber quando a PESSOA mexe (modos de leitura) */
  interessados: Set<() => void>;
  vivo: boolean;
}

/** Avisa quem pediu `aoInteragir` (a pessoa rolou, tocou ou apertou uma tecla). */
export function avisarInteracao(c: CtxEpub): void {
  for (const f of [...c.interessados]) f();
}
