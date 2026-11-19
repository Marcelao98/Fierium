// O cartão de citação pra compartilhar: um PNG 1080×1350 (formato do Instagram) com a citação em Cormorant, autor e
// livro em Cinzel, as cores de um tema, a moldura gravada e o selo + "Fierium" discreto no rodapé. Desenha num
// <canvas>; as fontes já vêm embutidas no app, só é preciso esperar elas carregarem.

export const LARGURA = 1080;
export const ALTURA = 1350;

export type Moldura = 'dupla' | 'cantos' | 'estrelas';

export interface EstiloCartao {
  id: string;
  nome: string;
  /** cor do fundo */
  papel: string;
  /** cor do texto */
  tinta: string;
  /** cor da moldura, das aspas e do selo */
  destaque: string;
  moldura: Moldura;
}

export interface DadosDoCartao {
  trecho: string;
  autor: string;
  livro: string;
}

/** Os 3 estilos da prévia: o da página que a pessoa está lendo, o Céu antigo (escuro) e o Pergaminho (claro). */
export function estilosDoCartao(pagina: { papel: string; tinta: string; nome?: string }): EstiloCartao[] {
  return [
    {
      id: 'pagina',
      nome: pagina.nome ? `Da página (${pagina.nome})` : 'Da página',
      papel: pagina.papel,
      tinta: pagina.tinta,
      destaque: pagina.tinta,
      moldura: 'dupla',
    },
    { id: 'ceu', nome: 'Céu antigo', papel: '#0a0f1e', tinta: '#efe4c8', destaque: '#e2b866', moldura: 'estrelas' },
    {
      id: 'pergaminho',
      nome: 'Pergaminho',
      papel: '#f1e6c9',
      tinta: '#2b2216',
      destaque: '#8a5a1e',
      moldura: 'cantos',
    },
  ];
}

/** Quebra o texto em linhas que cabem em `largura` (a fonte do contexto já deve estar posta). */
export function quebrarLinhas(medir: (t: string) => number, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.replace(/\s+/g, ' ').trim().split('\n')) {
    let atual = '';
    for (const palavra of paragrafo.split(' ')) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && medir(tentativa) > largura) {
        linhas.push(atual);
        atual = palavra;
      } else atual = tentativa;
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

/** Maior corpo de letra (entre `max` e `min`) em que a citação cabe na altura; no mínimo, corta com reticências. */
export function ajustarTexto(
  ctx: CanvasRenderingContext2D,
  texto: string,
  largura: number,
  altura: number,
  max = 78,
  min = 34,
): { linhas: string[]; corpo: number; entrelinha: number } {
  for (let corpo = max; corpo >= min; corpo -= 2) {
    ctx.font = `italic 500 ${corpo}px "Cormorant Garamond Variable", Georgia, serif`;
    const linhas = quebrarLinhas((t) => ctx.measureText(t).width, texto, largura);
    const entrelinha = Math.round(corpo * 1.28);
    if (linhas.length * entrelinha <= altura) return { linhas, corpo, entrelinha };
  }
  const entrelinha = Math.round(min * 1.28);
  ctx.font = `italic 500 ${min}px "Cormorant Garamond Variable", Georgia, serif`;
  const todas = quebrarLinhas((t) => ctx.measureText(t).width, texto, largura);
  const cabem = Math.max(1, Math.floor(altura / entrelinha));
  const linhas = todas.slice(0, cabem);
  if (todas.length > cabem) linhas[cabem - 1] = `${linhas[cabem - 1]!.replace(/[\s.,;:!?]+$/, '')}…`;
  return { linhas, corpo: min, entrelinha };
}

/** Espera as fontes (Cormorant e Cinzel) carregarem antes de desenhar. */
export async function esperarFontes(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('italic 500 60px "Cormorant Garamond Variable"'),
      document.fonts.load('400 30px "Cinzel Variable"'),
    ]);
    await document.fonts.ready;
  } catch {
    // sem as fontes o desenho cai na Georgia: o cartão sai menos bonito, mas sai
  }
}

const SELO_ARO = 'M100 10A90 90 0 1 1 99.99 10Z';
const SELO_LUA = 'M58 108A42 42 0 0 0 142 108A44 44 0 0 1 58 108Z';
const SELO_CENTELHA = 'M100 58L105 86L128 92L105 98L100 124L95 98L72 92L95 86Z';

function selo(ctx: CanvasRenderingContext2D, cx: number, cy: number, tamanho: number, cor: string) {
  ctx.save();
  ctx.translate(cx - tamanho / 2, cy - tamanho / 2);
  ctx.scale(tamanho / 200, tamanho / 200);
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.stroke(new Path2D(SELO_ARO));
  ctx.lineWidth = 2;
  for (let i = 0; i < 72; i++) {
    const a = (i * 5 * Math.PI) / 180;
    const dentro = i % 6 ? 84 : 77;
    ctx.beginPath();
    ctx.moveTo(100 + Math.cos(a) * 90, 100 + Math.sin(a) * 90);
    ctx.lineTo(100 + Math.cos(a) * dentro, 100 + Math.sin(a) * dentro);
    ctx.stroke();
  }
  ctx.fill(new Path2D(SELO_LUA));
  ctx.fill(new Path2D(SELO_CENTELHA));
  ctx.restore();
}

/** Número pseudoaleatório repetível (as estrelas do estilo Céu ficam iguais pro mesmo texto). */
function semente(texto: string): () => number {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function moldura(ctx: CanvasRenderingContext2D, e: EstiloCartao) {
  ctx.save();
  ctx.strokeStyle = e.destaque;
  // gravada: uma linha clara deslocada 1px por baixo da linha do tom
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 2;
  ctx.strokeRect(57, 57, LARGURA - 108, ALTURA - 108);
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 54, LARGURA - 108, ALTURA - 108);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.strokeRect(78, 78, LARGURA - 156, ALTURA - 156);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = e.destaque;
  const cantos: [number, number][] = [
    [54, 54],
    [LARGURA - 54, 54],
    [54, ALTURA - 54],
    [LARGURA - 54, ALTURA - 54],
  ];
  for (const [x, y] of cantos) {
    ctx.beginPath();
    if (e.moldura === 'cantos') {
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
    } else ctx.arc(x, y, e.moldura === 'estrelas' ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Desenha o cartão inteiro no canvas (1080×1350). Espera as fontes antes. */
export async function desenharCartao(canvas: HTMLCanvasElement, d: DadosDoCartao, e: EstiloCartao): Promise<void> {
  await esperarFontes();
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O navegador não deixou criar o desenho do cartão (canvas indisponível).');

  // fundo e uma luz suave no alto
  ctx.fillStyle = e.papel;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  const luz = ctx.createRadialGradient(LARGURA / 2, 260, 40, LARGURA / 2, 260, 900);
  luz.addColorStop(0, `${e.destaque}2e`);
  luz.addColorStop(1, `${e.destaque}00`);
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  if (e.moldura === 'estrelas') {
    const r = semente(d.trecho + d.livro);
    ctx.fillStyle = e.destaque;
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.15 + r() * 0.5;
      ctx.beginPath();
      ctx.arc(100 + r() * (LARGURA - 200), 100 + r() * (ALTURA - 200), 0.8 + r() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  moldura(ctx, e);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // aspas grandes
  ctx.fillStyle = e.destaque;
  ctx.globalAlpha = 0.85;
  ctx.font = '300 220px "Cormorant Garamond Variable", Georgia, serif';
  ctx.fillText('“', LARGURA / 2, 330);
  ctx.globalAlpha = 1;

  // a citação, no maior corpo que cabe
  const trecho = d.trecho.trim();
  const area = { topo: 360, altura: 600, largura: LARGURA - 260 };
  const t = ajustarTexto(ctx, trecho, area.largura, area.altura);
  ctx.fillStyle = e.tinta;
  ctx.font = `italic 500 ${t.corpo}px "Cormorant Garamond Variable", Georgia, serif`;
  const alto = t.linhas.length * t.entrelinha;
  let y = area.topo + (area.altura - alto) / 2 + t.corpo * 0.9;
  for (const linha of t.linhas) {
    ctx.fillText(linha, LARGURA / 2, y);
    y += t.entrelinha;
  }

  // filete com um losango e a fonte
  const yFio = 1010;
  ctx.strokeStyle = e.destaque;
  ctx.fillStyle = e.destaque;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(LARGURA / 2 - 150, yFio);
  ctx.lineTo(LARGURA / 2 - 18, yFio);
  ctx.moveTo(LARGURA / 2 + 18, yFio);
  ctx.lineTo(LARGURA / 2 + 150, yFio);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(LARGURA / 2, yFio - 7);
  ctx.lineTo(LARGURA / 2 + 7, yFio);
  ctx.lineTo(LARGURA / 2, yFio + 7);
  ctx.lineTo(LARGURA / 2 - 7, yFio);
  ctx.fill();
  ctx.globalAlpha = 1;

  const comEspaco = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  ctx.fillStyle = e.tinta;
  let yFonte = yFio + 70;
  if (d.autor.trim()) {
    ctx.font = '600 38px "Cinzel Variable", Georgia, serif';
    comEspaco.letterSpacing = '4px';
    ctx.fillText(ajustarLinha(ctx, d.autor.trim().toUpperCase(), area.largura), LARGURA / 2, yFonte);
    yFonte += 56;
  }
  if (d.livro.trim()) {
    ctx.globalAlpha = 0.8;
    ctx.font = '400 28px "Cinzel Variable", Georgia, serif';
    comEspaco.letterSpacing = '3px';
    ctx.fillText(ajustarLinha(ctx, d.livro.trim(), area.largura), LARGURA / 2, yFonte);
    ctx.globalAlpha = 1;
  }

  // rodapé: selo e "Fierium", discretos
  comEspaco.letterSpacing = '0px';
  ctx.globalAlpha = 0.7;
  selo(ctx, LARGURA / 2 - 78, ALTURA - 118, 44, e.destaque);
  ctx.textAlign = 'left';
  ctx.fillStyle = e.tinta;
  ctx.font = '500 26px "Cinzel Variable", Georgia, serif';
  comEspaco.letterSpacing = '6px';
  ctx.fillText('FIERIUM', LARGURA / 2 - 44, ALTURA - 109);
  comEspaco.letterSpacing = '0px';
  ctx.globalAlpha = 1;
}

/** Encurta com reticências uma linha que não cabe. */
function ajustarLinha(ctx: CanvasRenderingContext2D, texto: string, largura: number): string {
  if (ctx.measureText(texto).width <= largura) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > largura) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** O canvas em PNG (rejeita com mensagem em português se o navegador não gerar). */
export function canvasParaPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não consegui gerar a imagem do cartão.'))), 'image/png'),
  );
}

/** Nome de arquivo seguro: "citacao-dom-casmurro.png". */
export function nomeDoArquivo(livro: string): string {
  const base = livro
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `citacao${base ? `-${base}` : ''}.png`;
}
