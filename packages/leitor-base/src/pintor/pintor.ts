// O Pintor: repinta os pixels RGBA da página (porte do KOFlibrary). Puro: recebe um Uint8ClampedArray, sem DOM.
// Pra cada tom de cinza `v` (0..255) monta uma cor entre a tinta e o papel (com brilho, contraste e luz quente); o
// pixel colorido (figura) pode ser preservado, e no tema escuro ele mantém o matiz invertendo só claro/escuro.
import type { ConfigLeitura, PaginaLeitura } from '@fierium/contratos';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const PAGINA_PADRAO: PaginaLeitura = { tema: 'sepia', brilho: 0, contraste: 100, quente: 0, manterCores: true };

/** Config de leitura guardada por versões antigas (sem `pagina`/`temasMeus`) continua abrindo: completa com o padrão. */
export function completarLeitura(
  l: Omit<ConfigLeitura, 'pagina' | 'temasMeus'> & Partial<ConfigLeitura>,
): ConfigLeitura {
  return {
    ...l,
    pagina: { ...PAGINA_PADRAO, ...l.pagina },
    temasMeus: Array.isArray(l.temasMeus) ? l.temasMeus : [],
  };
}

export interface ParametrosPintor {
  /** `#rrggbb` */
  papel: string;
  /** `#rrggbb` */
  tinta: string;
  brilho: number;
  contraste: number;
  quente: number;
  manterCores: boolean;
}

export interface Pintor {
  /** nada a repintar: o canvas fica como o pdf.js desenhou */
  readonly identidade: boolean;
  readonly escuro: boolean;
  readonly papel: Rgb;
  readonly tinta: Rgb;
  /** repinta no lugar, ou lê de `de` (mesmo tamanho) e escreve em `dados`, sem precisar de cópia */
  pintar(dados: Uint8ClampedArray, de?: Uint8ClampedArray): void;
  /** a cor que o branco puro e o preto puro viram (pra quem pinta por CSS, como o EPUB) */
  cores(): { papel: string; tinta: string };
}

const LIMITE_FIGURA = 48;

export function hexParaRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1]!, 16) : 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbParaHex({ r, g, b }: Rgb): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** `#rgb` ou `#rrggbb` (com ou sem #) → `#rrggbb` minúsculo; null se não for cor. */
export function normalizarHex(texto: string): string | null {
  const t = texto.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(t)) return `#${[...t].map((c) => c + c).join('')}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(t)) return `#${t}`.toLowerCase();
  return null;
}

const limita = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Luminância relativa (WCAG), 0..1. */
export function luminanciaRelativa({ r, g, b }: Rgb): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Razão de contraste WCAG entre duas cores (1..21). */
export function contraste(a: string, b: string): number {
  const la = luminanciaRelativa(hexParaRgb(a));
  const lb = luminanciaRelativa(hexParaRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function criarPintor(p: ParametrosPintor): Pintor {
  const papel = hexParaRgb(p.papel);
  const tinta = hexParaRgb(p.tinta);
  const brilho = p.brilho;
  const contr = p.contraste;
  const quente = p.quente;
  const lumPapel = (77 * papel.r + 151 * papel.g + 28 * papel.b) >> 8;
  const lumTinta = (77 * tinta.r + 151 * tinta.g + 28 * tinta.b) >> 8;
  const escuro = lumPapel < lumTinta;
  const identidade =
    papel.r === 255 &&
    papel.g === 255 &&
    papel.b === 255 &&
    tinta.r === 0 &&
    tinta.g === 0 &&
    tinta.b === 0 &&
    brilho === 0 &&
    contr === 100 &&
    quente === 0;

  const fatorG = (256 - (quente * 50) / 100) / 256;
  const fatorB = (256 - (quente * 150) / 100) / 256;
  const tabR = new Uint8ClampedArray(256);
  const tabG = new Uint8ClampedArray(256);
  const tabB = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const t = limita(((v - 128) * contr) / 100 + 128 + (brilho * 128) / 100) / 255;
    tabR[v] = tinta.r + (papel.r - tinta.r) * t;
    tabG[v] = (tinta.g + (papel.g - tinta.g) * t) * fatorG;
    tabB[v] = (tinta.b + (papel.b - tinta.b) * t) * fatorB;
  }

  return {
    identidade,
    escuro,
    papel,
    tinta,
    cores() {
      return {
        papel: rgbParaHex({ r: tabR[255]!, g: tabG[255]!, b: tabB[255]! }),
        tinta: rgbParaHex({ r: tabR[0]!, g: tabG[0]!, b: tabB[0]! }),
      };
    },
    pintar(d, de = d) {
      if (identidade) {
        if (de !== d) d.set(de);
        return;
      }
      const manter = p.manterCores;
      for (let i = 0; i + 3 < d.length; i += 4) {
        let r = de[i]!;
        let g = de[i + 1]!;
        let b = de[i + 2]!;
        if (r === g && g === b) {
          // cinza (a maioria dos pixels de texto): direto na tabela
          d[i] = tabR[r]!;
          d[i + 1] = tabG[r]!;
          d[i + 2] = tabB[r]!;
        } else {
          const max = r > g ? (r > b ? r : b) : g > b ? g : b;
          const min = r < g ? (r < b ? r : b) : g < b ? g : b;
          if (manter && max - min > LIMITE_FIGURA) {
            if (escuro) {
              const dif = 255 - max - min;
              r += dif;
              g += dif;
              b += dif;
            } else {
              r = (r * papel.r) / 255;
              g = (g * papel.g) / 255;
              b = (b * papel.b) / 255;
            }
            d[i] = r;
            d[i + 1] = g * fatorG;
            d[i + 2] = b * fatorB;
          } else {
            const l = (77 * r + 151 * g + 28 * b) >> 8;
            d[i] = tabR[l]!;
            d[i + 1] = tabG[l]!;
            d[i + 2] = tabB[l]!;
          }
        }
        d[i + 3] = de[i + 3]!;
      }
    },
  };
}
