// O estado compartilhado dos módulos do motor de PDF (um "contexto" por sessão). Os módulos são funções que recebem o
// contexto: nada de classe, e o motor continua testável com jsdom.
import type { ConfigLeitura, CorMarcacao, Marcacao } from '@fierium/contratos';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from 'pdfjs-dist';
import type { OpcoesMotor, Pintor } from '@fierium/leitor-base';

export const MARGEM = 2; // páginas desenhadas além das visíveis
export const ESPACO = 12; // px entre páginas

export interface Pagina {
  el: HTMLDivElement;
  w: number; // unidades do PDF (escala 1)
  h: number;
  canvas: HTMLCanvasElement | null;
  desenhadaEm: number; // escala*dpr do canvas atual
  tarefa: RenderTask | null;
  pedido: number; // contador pra ignorar desenhos antigos
  conhecida: boolean; // dimensões reais já lidas
  /** pixels como o pdf.js desenhou, guardados enquanto um tema repinta o canvas (null = o canvas está cru) */
  crua: ImageData | null;
  /** camada de texto selecionável (transparente, por cima do canvas) */
  texto: HTMLDivElement | null;
  textoPedido: number;
  textoCamada: TextLayer | null;
  /** camada das marcações (retângulos coloridos) */
  marcas: HTMLDivElement | null;
}

export interface EstadoMarcas {
  marcacoes: Marcacao[];
  cores: CorMarcacao[];
  selecionada: string | null;
}

export interface Contexto {
  op: OpcoesMotor;
  doc: Document;
  /** o elemento que rola */
  rolagem: HTMLDivElement;
  lista: HTMLDivElement;
  documento: PDFDocumentProxy;
  cache: Map<number, PDFPageProxy>;
  paginas: Pagina[];
  n: number;
  zoom: number;
  base: number;
  /** topo (px) de cada página dentro da lista */
  topos: number[];
  visiveis: Set<number>;
  aparencia: ConfigLeitura;
  pintor: Pintor;
  chavePintor: string;
  marcas: EstadoMarcas;
  desmontada: boolean;
}

export const escalaDe = (c: Contexto) => c.base * c.zoom;
export const dprDe = (c: Contexto) => Math.min(2, c.doc.defaultView?.devicePixelRatio || 1);
