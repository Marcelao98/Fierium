// A posição de leitura do EPUB (um CFI) e quanto do livro já passou. Enquanto os "pontos" do livro não ficam prontos
// (gerar leva um tempo em livros grandes) a fração vem do capítulo; depois vem da porcentagem exata.
import type { CtxEpub } from './tipos';

export function ligarPosicao(c: CtxEpub): { gerarPontos(): void } {
  let locaisProntas = false;
  const emitir = () => {
    if (!c.ultimoCfi) return;
    let f: number;
    if (locaisProntas) f = c.book.locations.percentageFromCfi(c.ultimoCfi) ?? 0;
    else {
      const n = c.book.spine?.length ?? 1;
      f = n > 1 ? c.ultimoIndice / (n - 1) : 0;
    }
    c.op.eventos.posicao(c.ultimoCfi, Math.round(Math.min(1, Math.max(0, f)) * 1000) / 1000);
  };
  c.rendition.on('relocated', (loc: { start: { cfi: string; index?: number } }) => {
    c.ultimoCfi = loc.start.cfi;
    c.ultimoIndice = loc.start.index ?? 0;
    emitir();
  });
  return {
    /** começa a gerar os pontos (depois de abrir); a porcentagem exata aparece quando ficam prontos */
    gerarPontos() {
      void Promise.resolve(c.book.locations.generate(1600))
        .then(() => {
          if (!c.vivo) return;
          locaisProntas = true;
          emitir();
        })
        .catch(() => {
          // sem os pontos fica a fração pela posição do capítulo; não é erro pra mostrar
        });
    },
  };
}
