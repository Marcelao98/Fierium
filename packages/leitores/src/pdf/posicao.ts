// Funções puras do motor de PDF (testáveis sem canvas): posição "pagina:fracao", tema e escala.
import type { TemaLeitura } from '@fierium/contratos';

export interface PosicaoPdf {
  /** 1..n */
  pagina: number;
  /** 0..1: quanto já desceu nesta página */
  fracao: number;
}

export const formatarPosicao = (p: PosicaoPdf): string =>
  `${p.pagina}:${Number(Math.min(1, Math.max(0, p.fracao)).toFixed(3))}`;

/** Lê "37:0.42" (ou "37"); devolve null se não for uma posição de PDF. */
export function lerPosicao(texto: string): PosicaoPdf | null {
  const m = /^(\d+)(?::(\d*\.?\d+))?$/.exec(texto.trim());
  if (!m) return null;
  const pagina = Number(m[1]);
  if (!Number.isInteger(pagina) || pagina < 1) return null;
  const fracao = m[2] === undefined ? 0 : Number(m[2]);
  if (!Number.isFinite(fracao)) return null;
  return { pagina, fracao: Math.min(1, Math.max(0, fracao)) };
}

/** O filtro CSS dos canvas pra cada tema. */
export function filtroDoTema(tema: TemaLeitura): string {
  if (tema === 'noite') return 'invert(0.88) hue-rotate(180deg)';
  if (tema === 'pergaminho' || tema === 'sepia') return 'sepia(0.18) brightness(0.98)';
  return 'none';
}

export const LARGURA_MAXIMA = 1000;
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 5;

export const limitarZoom = (z: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** Escala base (CSS px por unidade do PDF): ajusta a página à largura disponível, sem passar de LARGURA_MAXIMA. */
export function escalaBase(larguraAlvo: number, larguraPagina: number): number {
  const util = Math.max(120, Math.min(LARGURA_MAXIMA, larguraAlvo - 24));
  return util / Math.max(1, larguraPagina);
}

/** Índice (0..n-1) da página que contém a posição y, dadas as posições do topo de cada página (crescentes). */
export function paginaEm(topos: readonly number[], y: number): number {
  let lo = 0;
  let hi = topos.length - 1;
  while (lo < hi) {
    const meio = (lo + hi + 1) >> 1;
    if (topos[meio]! <= y) lo = meio;
    else hi = meio - 1;
  }
  return lo;
}
