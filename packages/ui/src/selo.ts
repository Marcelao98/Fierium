// Selo: a capa gerada pra obra sem imagem (§9.5). Determinístico: o mesmo título dá sempre a mesma capa.
// Aqui só a conta (sem React): hash, ornamento de cada "mundo", quebra do título e do autor. O desenho está em Selo.tsx.

/** Hash pequeno e estável (FNV-1a de 32 bits). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Sorteio repetível a partir de uma semente (0..1). */
function sorteio(semente: string): () => number {
  let h = hash(semente);
  return () => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
    return (h % 10000) / 10000;
  };
}

/** O ornamento muda com o mundo da obra: constelação, lua, astrolábio, raios ou órbitas. */
export type Motivo = 'constelacao' | 'lua' | 'astrolabio' | 'raios' | 'orbitas';

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Do "reino"/assuntos da obra ("Fantasia", "Filosofia", "mangá"…) ao ornamento. Sem pista: a constelação. */
export function motivoDaArea(area?: string): Motivo {
  const a = sem(area ?? '');
  if (/fantas|magia|dragao|dragon|fada|mito/.test(a)) return 'lua';
  if (/filosof|religi|etica|ethic|teolog|metafis/.test(a)) return 'astrolabio';
  if (/manga|quadrin|\bhq\b|comic|anime|graphic/.test(a)) return 'raios';
  if (/cienc|science|fisica|astronom|matemat|natura|tecnolog/.test(a)) return 'orbitas';
  return 'constelacao';
}

/** Uma estrela do ornamento, em unidades da capa (200 × 300). */
export interface Estrela {
  x: number;
  y: number;
  r: number;
  /** estrela grande, de quatro pontas */
  brilho: boolean;
}

export interface Ornamento {
  motivo: Motivo;
  estrelas: Estrela[];
  /** pares de índices de `estrelas` ligados por um fio de luz (só na constelação) */
  fios: [number, number][];
  /** ângulo (graus) que gira o desenho do motivo, vindo do título */
  giro: number;
}

/** Onde o ornamento mora: o meio da metade de cima da capa. */
export const CENTRO = { x: 100, y: 86 } as const;

export function ornamentoDaCapa(semente: string, motivo: Motivo): Ornamento {
  const prox = sorteio(semente + '#' + motivo);
  const giro = Math.floor(prox() * 360);
  const n = motivo === 'constelacao' ? 6 + Math.floor(prox() * 3) : 3 + Math.floor(prox() * 3);
  // grade de 3 × 3 com folga: as estrelas nunca se amontoam nem saem da moldura
  const todas = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = todas.length - 1; i > 0; i--) {
    const j = Math.floor(prox() * (i + 1));
    [todas[i], todas[j]] = [todas[j] ?? 0, todas[i] ?? 0];
  }
  const casas = todas.slice(0, n);
  const estrelas: Estrela[] = casas.map((c, i) => ({
    x: CENTRO.x - 52 + (c % 3) * 52 + (prox() - 0.5) * 30,
    y: CENTRO.y - 40 + Math.floor(c / 3) * 40 + (prox() - 0.5) * 24,
    r: 1 + prox() * 1.6,
    brilho: i < 2,
  }));
  const fios: [number, number][] = [];
  if (motivo === 'constelacao') {
    const ordem = estrelas.map((_, i) => i).sort((a, b) => (estrelas[a]?.x ?? 0) - (estrelas[b]?.x ?? 0));
    for (let i = 1; i < ordem.length; i++) fios.push([ordem[i - 1] ?? 0, ordem[i] ?? 0]);
    if (ordem.length > 4) fios.push([ordem[1] ?? 0, ordem[ordem.length - 2] ?? 0]);
  }
  return { motivo, estrelas, fios, giro };
}

/** Quebra o título em `k` linhas o mais parelhas possível (sem partir palavra). */
function quebrarEm(palavras: string[], k: number): string[] {
  const n = palavras.length;
  const tam = (i: number, j: number) => palavras.slice(i, j).join(' ').length;
  const alvo = tam(0, n) / k;
  // melhor[l][j] = menor custo pra pôr as j primeiras palavras em l linhas; o custo é o desvio ao quadrado do alvo
  const inf = Number.POSITIVE_INFINITY;
  const melhor: number[][] = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(inf));
  const de: number[][] = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(0));
  melhor[0]![0] = 0;
  for (let l = 1; l <= k; l++)
    for (let j = 1; j <= n; j++)
      for (let i = l - 1; i < j; i++) {
        const c = (melhor[l - 1]![i] ?? inf) + (tam(i, j) - alvo) ** 2;
        if (c < (melhor[l]![j] ?? inf)) {
          melhor[l]![j] = c;
          de[l]![j] = i;
        }
      }
  const linhas: string[] = [];
  for (let l = k, j = n; l >= 1; l--) {
    const i = de[l]![j] ?? 0;
    linhas.unshift(palavras.slice(i, j).join(' '));
    j = i;
  }
  return linhas;
}

export interface TituloAjustado {
  linhas: string[];
  /** corpo da letra, em unidades da capa */
  tamanho: number;
}

const LARGURA_TITULO = 142;
const ALTURA_TITULO = 70;
/** largura média de uma letra da Cormorant em relação ao corpo (com folga) */
const LETRA = 0.5;
const CORPO_MAX = 27;
const CORPO_MIN = 10.5;

/** Quebra e dimensiona o título: o maior corpo que cabe na caixa; título imenso é cortado com reticências. */
export function ajustarTitulo(titulo: string): TituloAjustado {
  let texto = titulo.replace(/\s+/g, ' ').trim() || '—';
  for (;;) {
    const palavras = texto.split(' ');
    let melhor: TituloAjustado | null = null;
    for (let k = 1; k <= Math.min(5, palavras.length); k++) {
      const linhas = quebrarEm(palavras, k);
      const maior = Math.max(...linhas.map((l) => l.length));
      const tamanho = Math.min(CORPO_MAX, LARGURA_TITULO / (maior * LETRA), ALTURA_TITULO / (k * 1.14));
      if (!melhor || tamanho > melhor.tamanho + 0.4) melhor = { linhas, tamanho };
    }
    if (melhor && melhor.tamanho >= CORPO_MIN) return melhor;
    if (texto.length <= 12) return melhor ?? { linhas: [texto], tamanho: CORPO_MIN };
    texto = texto.slice(0, Math.max(12, Math.floor(texto.length * 0.8))).replace(/\s+\S*$/, '') + '…';
  }
}

export interface AutorAjustado {
  texto: string;
  tamanho: number;
}

const LARGURA_AUTOR = 150;

/** O autor em maiúsculas espaçadas: reduz o corpo até caber, e corta com reticências se ainda assim estourar. */
export function ajustarAutor(autor: string): AutorAjustado {
  let texto = autor.replace(/\s+/g, ' ').trim().toUpperCase();
  const largura = (t: string, corpo: number) => t.length * corpo * 0.82;
  const max = 8;
  const min = 5.4;
  while (largura(texto, min) > LARGURA_AUTOR && texto.length > 4) texto = texto.slice(0, -2).trimEnd() + '…';
  return { texto, tamanho: Math.max(min, Math.min(max, LARGURA_AUTOR / (texto.length * 0.82))) };
}

/** O que vai no selo de série: o número do volume ("vol. 3" → "3"), ou as primeiras letras. */
export function textoDoSeloDeSerie(detalhe: string): string {
  const n = /\d+/.exec(detalhe)?.[0];
  return n ?? detalhe.trim().slice(0, 3).toUpperCase();
}
