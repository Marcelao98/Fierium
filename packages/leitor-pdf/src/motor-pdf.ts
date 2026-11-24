// Motor de PDF (pdf.js): rolagem vertical contínua. Todas as páginas têm o tamanho reservado, mas só as que estão
// perto da tela (±2) têm canvas; o arquivo é lido aos pedaços (Range), então PDFs de centenas de MB abrem rápido.
// Posição = "pagina:fracao" (ex.: "37:0.42"). Texto selecionável (camada de texto do pdf.js) e marcações (camada
// própria por cima, sem ser repintada pelo tema). Este arquivo só liga as partes: cada uma mora no seu módulo
// (transporte, layout, render, marcacoes, interacao, tema, pecas).
import {
  criarPintor,
  parametrosDaPagina,
  type MotorDeLeitura,
  type OpcoesMotor,
  type SessaoLeitura,
} from '@fierium/leitor-base';
import type { PDFPageProxy } from 'pdfjs-dist';
import { ligarInteracao } from './interacao';
import { disposicao, posicaoAtual, redisporMantendo, rolarPara } from './layout';
import { desenharMarcas, partesDe } from './marcacoes';
import './pdf.css';
import { escalaBase, formatarPosicao, lerPosicao, type PosicaoPdf } from './posicao';
import { atualizarJanela, liberar } from './render';
import { aplicarTema } from './tema';
import { pecasComuns } from './pecas';
import type { Contexto, Pagina } from './tipos';
import { abrirDocumento, classificarErro } from './transporte';

const paginaNova = (el: HTMLDivElement, w: number, h: number): Pagina => ({
  el,
  w,
  h,
  canvas: null,
  desenhadaEm: 0,
  tarefa: null,
  pedido: 0,
  conhecida: false,
  crua: null,
  texto: null,
  textoPedido: 0,
  textoCamada: null,
  marcas: null,
});

function sessaoVazia(rolagem: HTMLElement): SessaoLeitura {
  return {
    aplicarAparencia: () => undefined,
    mostrarMarcacoes: () => undefined,
    irPara: () => undefined,
    limparSelecao: () => undefined,
    desmontar: () => rolagem.remove(),
  };
}

/** Pra onde "ir" um alvo: a posição salva ou a primeira parte de uma marcação (um pouco acima, pra não colar no topo). */
function posicaoDoAlvo(c: Contexto, a: { posicao: string } | { marcacaoId: string }): PosicaoPdf | null {
  if ('posicao' in a) return lerPosicao(a.posicao);
  const m = c.marcas.marcacoes.find((x) => x.id === a.marcacaoId);
  const primeira = m ? partesDe(m)[0] : undefined;
  if (primeira) return { pagina: primeira.pagina, fracao: Math.max(0, primeira.ret[1] - 0.06) };
  if (m?.ancora.tipo === 'pdf') return { pagina: m.ancora.pagina, fracao: 0 }; // marcador de página
  return null;
}

export const motorPdf: MotorDeLeitura = {
  nome: 'pdf',
  aceita: (f) => f.tipo === 'arquivo' && f.formato === 'pdf',
  async montar(alvo: HTMLElement, op: OpcoesMotor): Promise<SessaoLeitura> {
    if (op.fonte.tipo !== 'arquivo') throw new Error('motor de PDF recebeu outro conteúdo');
    const fonte = op.fonte;
    const doc = alvo.ownerDocument;
    const rolagem = doc.createElement('div');
    rolagem.className = 'fl-pdf';
    rolagem.tabIndex = 0;
    const lista = doc.createElement('div');
    lista.className = 'fl-pdf-lista';
    rolagem.append(lista);
    alvo.append(rolagem);

    const r = await abrirDocumento(fonte.url, fonte.tamanho, (e) =>
      op.eventos.erro('PDF_INTERVALO', 'Não consegui carregar uma parte deste PDF.', String(e)),
    );
    if ('erro' in r) {
      const { codigo, mensagem } = classificarErro(r.erro);
      op.eventos.erro(codigo, mensagem, r.erro instanceof Error ? `${r.erro.name}: ${r.erro.message}` : String(r.erro));
      r.transporte?.abort();
      return sessaoVazia(rolagem);
    }
    const { documento, primeira, tarefa } = r.aberto;
    const n = documento.numPages;
    const v1 = primeira.getViewport({ scale: 1 });
    const paginas: Pagina[] = [];
    for (let i = 0; i < n; i++) {
      const el = doc.createElement('div');
      el.className = 'fl-pdf-pagina';
      el.dataset['pagina'] = String(i + 1);
      lista.append(el);
      paginas.push(paginaNova(el, v1.width, v1.height));
    }
    paginas[0]!.conhecida = true;

    const c: Contexto = {
      op,
      doc,
      rolagem,
      lista,
      documento,
      cache: new Map<number, PDFPageProxy>([[1, primeira]]),
      paginas,
      n,
      zoom: 1,
      base: 1,
      topos: [],
      visiveis: new Set<number>(),
      aparencia: op.aparencia,
      pintor: criarPintor(parametrosDaPagina(op.aparencia.pagina, op.aparencia.temasMeus)),
      chavePintor: '',
      marcas: { marcacoes: op.marcacoes, cores: op.cores, selecionada: null },
      desmontada: false,
    };
    desenharMarcas(c);

    const observador =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entradas) => {
              for (const e of entradas) {
                const i = Number((e.target as HTMLElement).dataset['pagina']) - 1;
                if (e.isIntersecting) c.visiveis.add(i);
                else c.visiveis.delete(i);
              }
              atualizarJanela(c);
            },
            { root: rolagem, rootMargin: '50px 0px' },
          );
    for (const p of paginas) observador?.observe(p.el);

    // posição → casca (com atraso)
    let temporizadorPosicao: ReturnType<typeof setTimeout> | undefined;
    const emitirPosicao = () => {
      const p = posicaoAtual(c);
      op.eventos.posicao(formatarPosicao(p), Math.min(1, Math.max(0, (p.pagina - 1 + p.fracao) / n)));
    };
    const aoRolar = () => {
      if (!observador) atualizarJanela(c);
      clearTimeout(temporizadorPosicao);
      temporizadorPosicao = setTimeout(emitirPosicao, 400);
    };
    rolagem.addEventListener('scroll', aoRolar, { passive: true });
    const interacao = ligarInteracao(c);
    const pecas = pecasComuns(c);

    // largura do alvo mudou: reajusta a escala base
    let larguraVista = rolagem.clientWidth;
    const redim =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            const l = rolagem.clientWidth;
            if (!l || l === larguraVista) return;
            larguraVista = l;
            c.base = escalaBase(l, paginas[0]!.w);
            redisporMantendo(c);
            atualizarJanela(c);
          });
    redim?.observe(rolagem);

    c.base = escalaBase(larguraVista || alvo.clientWidth || 800, paginas[0]!.w);
    disposicao(c);
    aplicarTema(c, op.aparencia);
    const irParaAlvo = (a: { posicao: string } | { marcacaoId: string }) => {
      const p = posicaoDoAlvo(c, a);
      if (!p) return;
      rolarPara(c, p);
      atualizarJanela(c);
    };
    const inicial = op.alvo && 'posicao' in op.alvo ? lerPosicao(op.alvo.posicao) : null;
    if (op.alvo && 'marcacaoId' in op.alvo) irParaAlvo(op.alvo);
    else if (inicial) rolarPara(c, inicial);
    atualizarJanela(c);
    emitirPosicao(); // a casca precisa saber a página já na abertura (marcador de página, menu), sem esperar rolar

    const { desfazerDestaque, ...pecasDaSessao } = pecas;
    return {
      ...pecasDaSessao,
      aplicarAparencia: (a) => aplicarTema(c, a),
      mostrarMarcacoes(novas, novasCores, sel) {
        c.marcas = { marcacoes: novas, cores: novasCores, selecionada: sel ?? null };
        desenharMarcas(c);
      },
      limparSelecao: interacao.limparSelecao,
      irPara: irParaAlvo,
      desmontar() {
        c.desmontada = true;
        clearTimeout(temporizadorPosicao);
        observador?.disconnect();
        redim?.disconnect();
        rolagem.removeEventListener('scroll', aoRolar);
        interacao.desfazer();
        desfazerDestaque();
        for (let i = 0; i < n; i++) liberar(c, i);
        rolagem.remove();
        void tarefa?.destroy();
      },
    };
  },
};
