// Transporte e abertura do PDF: o arquivo é lido aos pedaços (HTTP Range), então PDFs de centenas de MB abrem rápido.
import * as pdfjs from 'pdfjs-dist';
import {
  PDFDataRangeTransport,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export function classificarErro(e: unknown): { codigo: string; mensagem: string } {
  const nome = (e as { name?: string } | null)?.name;
  if (nome === 'PasswordException')
    return { codigo: 'PDF_PROTEGIDO', mensagem: 'Este PDF tem senha, e ainda não sei abrir PDF protegido.' };
  return { codigo: 'PDF_ILEGIVEL', mensagem: 'Não consegui ler este PDF: o arquivo está danificado ou não é um PDF.' };
}

let workerConfigurado = false;
function configurarWorker() {
  if (workerConfigurado) return;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  workerConfigurado = true;
}

/** O pdf.js só habilita Range automaticamente em URLs HTTP(S); `fierium://` precisa de um transporte explícito. */
export class TransportePdf extends PDFDataRangeTransport {
  constructor(
    readonly url: string,
    tamanho: number,
    dadosIniciais: Uint8Array,
    private readonly falha: (e: unknown) => void,
  ) {
    super(tamanho, dadosIniciais);
  }

  override requestDataRange(inicio: number, fim: number) {
    void fetch(this.url, { headers: { Range: `bytes=${inicio}-${fim - 1}` } })
      .then(async (r) => {
        if (r.status !== 206) throw new Error(`resposta ${r.status} ao pedir bytes ${inicio}-${fim - 1}`);
        const intervalo = r.headers.get('Content-Range');
        if (!intervalo?.startsWith(`bytes ${inicio}-`))
          throw new Error(`intervalo inesperado: ${intervalo ?? 'ausente'}`);
        this.onDataRange(inicio, new Uint8Array(await r.arrayBuffer()));
      })
      .catch((e: unknown) => {
        this.falha(e);
        this.onDataRange(inicio, new Uint8Array());
      });
  }
}

export interface Aberto {
  documento: PDFDocumentProxy;
  primeira: PDFPageProxy;
  transporte: TransportePdf | undefined;
  tarefa: PDFDocumentLoadingTask | undefined;
}

/** Abre o documento (bytes iniciais + Range). Em caso de erro devolve o que já foi criado pra o chamador limpar. */
export async function abrirDocumento(
  url: string,
  tamanho: number,
  aoFalharIntervalo: (e: unknown) => void,
): Promise<{ aberto: Aberto } | { erro: unknown; transporte: TransportePdf | undefined }> {
  configurarWorker();
  const controle: { transporte?: TransportePdf; tarefa?: PDFDocumentLoadingTask } = {};
  try {
    const carga = (async () => {
      const resposta = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
      if (resposta.status !== 206) throw new Error(`resposta ${resposta.status} ao pedir os bytes iniciais do PDF`);
      const contentRange = resposta.headers.get('Content-Range');
      if (!contentRange?.startsWith('bytes 0-'))
        throw new Error(`intervalo inicial inesperado: ${contentRange ?? 'ausente'}`);
      const dados = new Uint8Array(await resposta.arrayBuffer());
      controle.transporte = new TransportePdf(url, tamanho, dados, aoFalharIntervalo);
      controle.transporte.transportReady();
      controle.tarefa = pdfjs.getDocument({ range: controle.transporte });
      return controle.tarefa.promise;
    })();
    const documento = await carga;
    const primeira = await documento.getPage(1);
    return { aberto: { documento, primeira, transporte: controle.transporte, tarefa: controle.tarefa } };
  } catch (erro) {
    return { erro, transporte: controle.transporte };
  }
}
