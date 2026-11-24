// As peças comuns do leitor de PDF (as mesmas que os modos de leitura usam): linhas visíveis pela camada de texto,
// rolar por código, virar página e a faixa de destaque passageira.
import {
  agruparLinhas,
  caixaDe,
  criarDestaque,
  type Capacidades,
  type Caixa,
  type Linha,
  type PaginaAtual,
  type Pedaco,
  type Rolagem,
  type SessaoLeitura,
} from '@fierium/leitor-base';
import { posicaoAtual, rolarPara } from './layout';
import { atualizarJanela } from './render';
import type { Contexto } from './tipos';

export const CAPACIDADES_PDF: Capacidades = { paginar: true, linhas: true, rolar: true, destacar: true };

const areaVisivel = (c: Contexto): Caixa => caixaDe(c.rolagem.getBoundingClientRect());

/** Os pedaços de texto de uma página (cada item da camada de texto do pdf.js), com a posição na tela. */
function pedacosDaPagina(c: Contexto, i: number): Pedaco[] {
  const texto = c.paginas[i]!.texto;
  if (!texto) return [];
  const pedacos: Pedaco[] = [];
  let ordem = 0;
  for (const el of texto.querySelectorAll<HTMLElement>('span:not(.markedContent)')) {
    const t = el.textContent ?? '';
    const r = el.getBoundingClientRect();
    if (t.trim()) pedacos.push({ texto: t, caixa: caixaDe(r), ordem });
    ordem++;
  }
  return pedacos;
}

/** As linhas de texto cujo centro está na área visível, de cima pra baixo. O `id` é "página:ordem do 1º item". */
export function linhasVisiveis(c: Contexto): Linha[] {
  const area = areaVisivel(c);
  const saida: Linha[] = [];
  c.paginas.forEach((p, i) => {
    if (!p.texto) return;
    const b = p.el.getBoundingClientRect();
    if (b.bottom < area.y || b.top > area.y + area.altura) return;
    for (const l of agruparLinhas(pedacosDaPagina(c, i), `${i + 1}:`)) {
      const centro = l.caixa.y + l.caixa.altura / 2;
      if (centro >= area.y && centro <= area.y + area.altura) saida.push(l);
    }
  });
  return saida;
}

export function rolagemDe(c: Contexto): Rolagem {
  return {
    atual: c.rolagem.scrollTop,
    total: Math.max(0, c.rolagem.scrollHeight - c.rolagem.clientHeight),
    area: areaVisivel(c),
  };
}

export function paginaDe(c: Contexto): PaginaAtual {
  return { atual: posicaoAtual(c).pagina, total: c.n };
}

/** Vira uma página: adiante vai pro começo da próxima; atrás volta ao começo da atual (ou da anterior, se já está lá). */
export function paginarPdf(c: Contexto, direcao: 1 | -1): void {
  const p = posicaoAtual(c);
  const alvo = direcao > 0 ? p.pagina + 1 : p.fracao > 0.02 ? p.pagina : p.pagina - 1;
  rolarPara(c, { pagina: Math.min(c.n, Math.max(1, alvo)), fracao: 0 });
  atualizarJanela(c);
}

/** Avisa quando a PESSOA mexe (roda, toque, clique, tecla): rolagem por código não conta. */
export function aoInteragirPdf(c: Contexto, ouvinte: () => void): () => void {
  const { rolagem, doc } = c;
  const aoMexer = () => ouvinte();
  const eventos = ['wheel', 'touchstart', 'pointerdown'] as const;
  for (const e of eventos) rolagem.addEventListener(e, aoMexer, { passive: true });
  doc.addEventListener('keydown', aoMexer);
  return () => {
    for (const e of eventos) rolagem.removeEventListener(e, aoMexer);
    doc.removeEventListener('keydown', aoMexer);
  };
}

/** As peças comuns como pedaço da SessaoLeitura; `desmontar` desfaz o destaque. */
export function pecasComuns(
  c: Contexto,
): Pick<
  SessaoLeitura,
  'capacidades' | 'linhas' | 'rolarPor' | 'rolagem' | 'paginar' | 'paginaAtual' | 'destacarTrecho' | 'aoInteragir'
> & { desfazerDestaque(): void } {
  const destaque = criarDestaque(c.doc, c.lista);
  return {
    capacidades: CAPACIDADES_PDF,
    linhas: () => linhasVisiveis(c),
    rolarPor: (px) => {
      c.rolagem.scrollTop += px;
    },
    rolagem: () => rolagemDe(c),
    paginar: (d) => paginarPdf(c, d),
    paginaAtual: () => paginaDe(c),
    destacarTrecho: (faixa) => destaque.mostrar(faixa, c.lista.getBoundingClientRect()),
    aoInteragir: (o) => aoInteragirPdf(c, o),
    desfazerDestaque: () => destaque.desfazer(),
  };
}
