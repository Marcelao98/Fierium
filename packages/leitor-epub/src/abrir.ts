// Abrir o EPUB: ler o arquivo, conferir que é um zip, montar o livro no epub.js (com a limpeza de cada capítulo) e
// mostrar o primeiro capítulo, com tempo limite (um EPUB torto pode deixar o epub.js esperando pra sempre).
import ePub from 'epubjs';
import { ErroLeitor, type OpcoesMotor } from '@fierium/leitor-base';
import { sanitizarCapitulo } from './sanitizar';
import type { Epubjs } from './tipos';

const TEMPO_LIMITE_MS = 30_000;

/** Registra o erro (código estável, mensagem em português) e o devolve pra o chamador lançar. */
export function falhar(op: OpcoesMotor, detalhe: string): ErroLeitor {
  const mensagem = `Não consegui abrir este EPUB (${detalhe}).`;
  op.eventos.erro('EPUB_ILEGIVEL', mensagem);
  return new ErroLeitor('EPUB_ILEGIVEL', mensagem);
}

/** Baixa o arquivo e confere o "PK" do zip (o epub.js não avisa quando recebe outra coisa). */
export async function lerArquivo(op: OpcoesMotor, url: string): Promise<ArrayBuffer> {
  let dados: ArrayBuffer;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    dados = await r.arrayBuffer();
  } catch (e) {
    throw falhar(op, e instanceof Error ? e.message : 'arquivo inacessível');
  }
  const cab = new Uint8Array(dados, 0, Math.min(4, dados.byteLength));
  if (cab[0] !== 0x50 || cab[1] !== 0x4b) throw falhar(op, 'não é um arquivo EPUB (zip)');
  return dados;
}

/**
 * Cria o livro e o desenhista. O WebKit (o app no Linux e no Mac) não roda NENHUM ouvinte de evento num iframe sem
 * 'allow-scripts', nem os nossos: sem isto, dentro do capítulo não há clique, seleção, botão direito nem teclado. Em
 * troca, cada capítulo passa pelo DOMPurify antes de ser montado: scripts e atributos on* do livro nem chegam ao iframe
 * (e a CSP do app também não os deixa rodar).
 */
export function criarLivro(
  op: OpcoesMotor,
  dados: ArrayBuffer,
  palco: HTMLElement,
): { book: Epubjs; rendition: Epubjs } {
  try {
    const book: Epubjs = (ePub as Epubjs)(dados);
    book.spine.hooks.content.register((capitulo: Document) => sanitizarCapitulo(capitulo));
    const rendition = book.renderTo(palco, {
      flow: 'scrolled-doc',
      width: '100%',
      height: '100%',
      allowScriptedContent: true,
    });
    return { book, rendition };
  } catch (e) {
    throw falhar(op, e instanceof Error ? e.message : 'formato inválido');
  }
}

const noTempo = <T>(p: Promise<T>): Promise<T> =>
  new Promise<T>((ok, falha) => {
    const t = setTimeout(() => falha(new Error('demorou demais pra abrir')), TEMPO_LIMITE_MS);
    p.then(
      (v) => (clearTimeout(t), ok(v)),
      (e: unknown) => (clearTimeout(t), falha(e instanceof Error ? e : new Error(String(e)))),
    );
  });

/** Espera o livro abrir e mostra o capítulo do `inicio` (um CFI); se o CFI não vale mais, abre do começo. */
export async function exibir(
  op: OpcoesMotor,
  book: Epubjs,
  rendition: Epubjs,
  inicio: string | undefined,
): Promise<void> {
  try {
    await noTempo(book.opened); // rejeita quando o zip ou o OPF não abrem (o ready sozinho ficaria esperando)
    await noTempo(book.ready);
    try {
      await noTempo(rendition.display(inicio));
    } catch (e) {
      if (!inicio) throw e;
      // CFI que não vale mais (arquivo trocado): abre do começo em vez de falhar
      await noTempo(rendition.display());
    }
  } catch (e) {
    throw falhar(op, e instanceof Error ? e.message : 'sem conteúdo');
  }
}
