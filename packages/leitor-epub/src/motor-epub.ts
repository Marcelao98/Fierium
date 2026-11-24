// Motor de EPUB (epub.js): um capítulo por vez, rolando. Posição = CFI. Marcações: seleção vira âncora
// { cfiInicio, cfiFim }, o realce é um highlight do epub.js (SVG por cima do texto) e o clique numa marcação é
// resolvido pelos retângulos do trecho. Este arquivo só liga as partes: abrir (+ limpeza do DOMPurify), aparência,
// posição, marcações, eventos e as peças comuns dos modos de leitura.
import type { Marcacao } from '@fierium/contratos';
import type { MotorDeLeitura, OpcoesMotor, SessaoLeitura } from '@fierium/leitor-base';
import { exibir, criarLivro, lerArquivo } from './abrir';
import { aplicarAparencia } from './aparencia';
import { criarCasca } from './casca';
import { ligarEventos } from './eventos';
import { cfiInicioDe, criarRealces } from './marcacoes';
import { pecasComuns } from './pecas';
import { ligarPosicao } from './posicao';
import type { CtxEpub } from './tipos';

/** O CFI onde abrir: a posição salva ou o começo da marcação pedida. */
function inicioDe(c: CtxEpub, alvo: OpcoesMotor['alvo']): string | undefined {
  if (alvo && 'posicao' in alvo) return alvo.posicao || undefined;
  if (alvo && 'marcacaoId' in alvo) return cfiInicioDe(c, alvo.marcacaoId);
  return undefined;
}

export const motorEpub: MotorDeLeitura = {
  nome: 'epub',
  aceita: (f) => f.tipo === 'arquivo' && f.formato === 'epub',
  async montar(alvo: HTMLElement, op: OpcoesMotor): Promise<SessaoLeitura> {
    const fonte = op.fonte;
    if (fonte.tipo !== 'arquivo') throw new Error('motor de EPUB recebeu outro conteúdo');
    const doc = alvo.ownerDocument;
    const dados = await lerArquivo(op, fonte.url);

    const casca = criarCasca(doc, alvo);
    let livro: ReturnType<typeof criarLivro>;
    try {
      livro = criarLivro(op, dados, casca.palco);
    } catch (e) {
      casca.raiz.remove();
      throw e;
    }
    const c: CtxEpub = {
      op,
      doc,
      raiz: casca.raiz,
      palco: casca.palco,
      book: livro.book,
      rendition: livro.rendition,
      marcas: { marcacoes: op.marcacoes, cores: op.cores, selecionada: null },
      aparencia: { ...op.aparencia },
      comSelecao: false,
      ultimoCfi: '',
      ultimoIndice: 0,
      interessados: new Set(),
      vivo: true,
    };
    const posicao = ligarPosicao(c);
    const eventos = ligarEventos(c, casca);
    const { desfazerDestaque, ...pecasDaSessao } = pecasComuns(c);
    const desenharRealces = criarRealces(c);
    const desfazer = () => {
      c.vivo = false;
      eventos.desfazer();
      desfazerDestaque();
      try {
        c.rendition.destroy();
        c.book.destroy();
      } catch {
        // já desmontado pelo epub.js
      }
      c.raiz.remove();
    };

    aplicarAparencia(c, c.aparencia);
    try {
      await exibir(op, c.book, c.rendition, inicioDe(c, op.alvo));
    } catch (e) {
      desfazer();
      throw e;
    }
    desenharRealces();
    posicao.gerarPontos(); // a porcentagem exata vem depois (gerar os pontos leva um tempo em livros grandes)

    return {
      ...pecasDaSessao,
      aplicarAparencia(a) {
        c.aparencia = { ...a };
        aplicarAparencia(c, c.aparencia);
      },
      mostrarMarcacoes(novas: Marcacao[], novasCores, sel) {
        c.marcas = { marcacoes: novas, cores: novasCores, selecionada: sel ?? null };
        desenharRealces();
      },
      irPara(a) {
        const cfi = 'posicao' in a ? a.posicao : cfiInicioDe(c, a.marcacaoId);
        if (cfi) void c.rendition.display(cfi);
      },
      limparSelecao: eventos.limparSelecao,
      desmontar: desfazer,
    };
  },
};
