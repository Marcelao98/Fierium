// A capa de um PDF: a página 1 desenhada pequena (WebP). Só lê os pedaços do arquivo que a página 1 precisa.
import * as pdfjs from 'pdfjs-dist';
import { configurarWorker, TransportePdf } from './motor-pdf';

export interface FontePdf {
  url: string;
  tamanho: number;
}

/** Converte o canvas em WebP (ou JPEG, se o navegador não souber WebP), em base64 sem o prefixo `data:`. */
async function paraBase64(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.82));
  const final =
    blob?.type === 'image/webp' ? blob : await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  if (!final) throw new Error('o navegador não conseguiu gerar a imagem da capa');
  const bytes = new Uint8Array(await final.arrayBuffer());
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
}

/** Desenha a 1ª página do PDF com `largura` px (360 por padrão) e devolve a imagem em base64. */
export async function desenharCapaPdf(fonte: FontePdf, largura = 360): Promise<string> {
  configurarWorker();
  const resposta = await fetch(fonte.url, { headers: { Range: 'bytes=0-65535' } });
  if (resposta.status !== 206) throw new Error(`resposta ${resposta.status} ao pedir o começo do PDF`);
  const dados = new Uint8Array(await resposta.arrayBuffer());
  let falha: unknown = null;
  const transporte = new TransportePdf(fonte.url, fonte.tamanho, dados, (e) => (falha = e));
  transporte.transportReady();
  const tarefa = pdfjs.getDocument({ range: transporte });
  try {
    const doc = await tarefa.promise;
    const pagina = await doc.getPage(1);
    const v1 = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: largura / v1.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('sem canvas 2D pra desenhar a capa');
    ctx.fillStyle = '#fff'; // PDF sem fundo próprio: branco, como no papel
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport }).promise;
    if (falha) throw falha instanceof Error ? falha : new Error(String(falha));
    return await paraBase64(canvas);
  } finally {
    transporte.abort();
    void tarefa.destroy();
  }
}
