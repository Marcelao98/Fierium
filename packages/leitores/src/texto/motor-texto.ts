// Motor de texto: capítulos e parágrafos (a demonstração do M1; o EPUB do M5 usa o mesmo jeito de marcar).
// Posição = "capitulo:paragrafo:0". Âncora das marcações = parágrafo + deslocamento em caracteres.
import type { Ancora, CorMarcacao, Marcacao } from '@fierium/contratos';
import { caixaDe, type MotorDeLeitura, type OpcoesMotor, type SessaoLeitura } from '../motor';
import './texto.css';

type AncoraTexto = Extract<Ancora, { tipo: 'texto' }>;

/** Quantos caracteres do elemento vêm antes de (no, deslocamento). */
export function deslocamento(el: Node, no: Node, d: number): number {
  let n = 0;
  const w = el.ownerDocument!.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    if (t === no) return n + d;
    n += t.textContent?.length ?? 0;
  }
  // a seleção começou/terminou no próprio elemento (não num texto): conta os filhos antes dele
  if (no === el) {
    let k = 0;
    for (let i = 0; i < d && i < el.childNodes.length; i++) k += el.childNodes[i]!.textContent?.length ?? 0;
    return k;
  }
  return n;
}

/** Os pedaços de um parágrafo: texto solto e marcações (sobrepostas: a que começa antes vence). */
export function pedacos(texto: string, marcas: Marcacao[]): ({ texto: string } | { texto: string; marca: Marcacao })[] {
  const ordem = marcas
    .filter((m): m is Marcacao & { ancora: AncoraTexto } => m.ancora.tipo === 'texto')
    .sort((a, b) => a.ancora.inicio - b.ancora.inicio);
  const r: ({ texto: string } | { texto: string; marca: Marcacao })[] = [];
  let i = 0;
  for (const m of ordem) {
    const ini = Math.max(i, m.ancora.inicio);
    const fim = Math.min(texto.length, m.ancora.fim);
    if (fim <= ini) continue;
    if (ini > i) r.push({ texto: texto.slice(i, ini) });
    r.push({ texto: texto.slice(ini, fim), marca: m });
    i = fim;
  }
  if (i < texto.length) r.push({ texto: texto.slice(i) });
  return r;
}

export const motorTexto: MotorDeLeitura = {
  nome: 'texto',
  aceita: (f) => f.tipo === 'texto',
  async montar(alvo: HTMLElement, op: OpcoesMotor): Promise<SessaoLeitura> {
    if (op.fonte.tipo !== 'texto') throw new Error('motor de texto recebeu outro conteúdo');
    const doc = alvo.ownerDocument;
    const rolagem = doc.createElement('div');
    rolagem.className = 'fl-rolagem';
    const artigo = doc.createElement('article');
    artigo.className = 'fl-texto';
    rolagem.append(artigo);
    alvo.append(rolagem);

    const paragrafos: { el: HTMLParagraphElement; texto: string; cap: number; par: number }[] = [];
    op.fonte.capitulos.forEach((c, ci) => {
      const sec = doc.createElement('section');
      const h = doc.createElement('h2');
      h.textContent = c.titulo;
      sec.append(h);
      c.paragrafos.forEach((t, pi) => {
        const p = doc.createElement('p');
        p.dataset.cap = String(ci);
        p.dataset.par = String(pi);
        p.textContent = t;
        sec.append(p);
        paragrafos.push({ el: p, texto: t, cap: ci, par: pi });
      });
      artigo.append(sec);
    });
    const fim = doc.createElement('p');
    fim.className = 'fl-fim';
    fim.textContent = 'Fim da demonstração.';
    artigo.append(fim);

    let marcacoes = op.marcacoes;
    let cores = op.cores;
    let selecionada: string | null = null;
    const corDe = (id: string) => cores.find((c) => c.id === id)?.cor ?? '#a99be6';
    const desenhar = () => {
      for (const p of paragrafos) {
        const minhas = marcacoes.filter(
          (m) => m.ancora.tipo === 'texto' && m.ancora.capitulo === p.cap && m.ancora.paragrafo === p.par,
        );
        p.el.replaceChildren(
          ...pedacos(p.texto, minhas).map((x) => {
            if (!('marca' in x)) return doc.createTextNode(x.texto);
            const mk = doc.createElement('mark');
            mk.className = 'fl-marca';
            mk.dataset.id = x.marca.id;
            mk.dataset.nota = String(!!x.marca.nota);
            mk.dataset.selecionada = String(selecionada === x.marca.id);
            mk.style.setProperty('--cor-marca', corDe(x.marca.cor));
            mk.title = x.marca.nota ?? '';
            mk.textContent = x.texto;
            return mk;
          }),
        );
      }
    };
    desenhar();

    const posicaoAtual = () => {
      const f =
        rolagem.scrollHeight > rolagem.clientHeight
          ? Math.min(1, rolagem.scrollTop / (rolagem.scrollHeight - rolagem.clientHeight))
          : 1;
      let atual = paragrafos[0];
      for (const p of paragrafos) {
        if (p.el.offsetTop - rolagem.scrollTop > 140) break;
        atual = p;
      }
      return { posicao: atual ? `${atual.cap}:${atual.par}:0` : '0:0:0', fracao: Math.round(f * 1000) / 1000 };
    };
    const rolou = () => {
      const p = posicaoAtual();
      op.eventos.posicao(p.posicao, p.fracao);
    };
    rolagem.addEventListener('scroll', rolou, { passive: true });

    const soltou = () => {
      const s = doc.getSelection();
      if (!s || s.isCollapsed || !s.rangeCount) return;
      const rg = s.getRangeAt(0);
      const pIni = (
        rg.startContainer.nodeType === 1 ? (rg.startContainer as Element) : rg.startContainer.parentElement
      )?.closest('p[data-par]');
      const pFim = (
        rg.endContainer.nodeType === 1 ? (rg.endContainer as Element) : rg.endContainer.parentElement
      )?.closest('p[data-par]');
      const p = paragrafos.find((x) => x.el === pIni);
      if (!p) return;
      const inicio = deslocamento(p.el, rg.startContainer, rg.startOffset);
      // seleção que passa do parágrafo vai até o fim dele (uma marcação por parágrafo)
      const fimSel = pFim === p.el ? deslocamento(p.el, rg.endContainer, rg.endOffset) : p.texto.length;
      const bruto = p.texto.slice(inicio, fimSel);
      const trecho = bruto.trim();
      if (!trecho) return;
      const ini = inicio + bruto.indexOf(trecho);
      op.eventos.selecao({
        trecho,
        ancora: { tipo: 'texto', capitulo: p.cap, paragrafo: p.par, inicio: ini, fim: ini + trecho.length },
        caixa: caixaDe(rg.getBoundingClientRect()),
      });
    };
    const tocou = () => setTimeout(soltou, 50);
    const clicou = (e: MouseEvent) => {
      if (doc.getSelection()?.toString()) return;
      const mk = (e.target as Element).closest?.('mark[data-id]') as HTMLElement | null;
      if (mk?.dataset.id) {
        e.stopPropagation();
        op.eventos.marcacaoClicada(mk.dataset.id, caixaDe(mk.getBoundingClientRect()));
      } else op.eventos.toque();
    };
    artigo.addEventListener('mouseup', soltou);
    artigo.addEventListener('touchend', tocou);
    artigo.addEventListener('click', clicou);

    const sessao: SessaoLeitura = {
      aplicarAparencia(a) {
        alvo.style.setProperty('--l-tamanho', `${a.tamanho}px`);
        alvo.style.setProperty('--l-entrelinha', String(a.entrelinha));
        alvo.style.setProperty('--l-largura', `${a.largura}ch`);
      },
      mostrarMarcacoes(ms: Marcacao[], cs: CorMarcacao[], sel?: string | null) {
        marcacoes = ms;
        cores = cs;
        selecionada = sel ?? null;
        desenhar();
      },
      irPara(a) {
        if ('marcacaoId' in a) {
          const mk = artigo.querySelector(`mark[data-id="${a.marcacaoId}"]`);
          mk?.scrollIntoView({ block: 'center' });
          return;
        }
        const [cap, par] = a.posicao.split(':').map(Number);
        const p = paragrafos.find((x) => x.cap === cap && x.par === par);
        if (p && (cap || par)) rolagem.scrollTop = p.el.offsetTop - 120;
      },
      limparSelecao() {
        doc.getSelection()?.removeAllRanges();
      },
      desmontar() {
        rolagem.removeEventListener('scroll', rolou);
        artigo.removeEventListener('mouseup', soltou);
        artigo.removeEventListener('touchend', tocou);
        artigo.removeEventListener('click', clicou);
        rolagem.remove();
      },
    };
    sessao.aplicarAparencia(op.aparencia);
    if (op.alvo) sessao.irPara(op.alvo);
    // texto curto que não rola conta como visto até o fim
    queueMicrotask(rolou);
    return sessao;
  },
};
