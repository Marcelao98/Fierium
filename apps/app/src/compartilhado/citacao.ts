// Citação pronta pra copiar e a ordem das marcações no livro: usadas pelas Notas e pelo leitor.
import type { Marcacao, Obra } from '@fierium/contratos';

export type FormatoCitacao = 'simples' | 'abnt';

const CHAVE_FORMATO = 'fierium.notas.formato';

/** O formato que a pessoa escolheu nas Notas (vale também pro leitor). */
export function formatoLembrado(): FormatoCitacao {
  try {
    return localStorage.getItem(CHAVE_FORMATO) === 'abnt' ? 'abnt' : 'simples';
  } catch {
    return 'simples'; // sem armazenamento (janela privada): fica no padrão
  }
}

/** minúsculas e sem acento, pra comparar texto */
export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** O que a citação precisa de uma marcação (o leitor também cita uma seleção que ainda não virou marcação). */
export type TrechoCitavel = Pick<Marcacao, 'trecho' | 'ancora'>;

function chave(m: Marcacao): [number, number, number, string] {
  const a = m.ancora;
  if (a.tipo === 'texto') return [a.capitulo, a.paragrafo, a.inicio, ''];
  if (a.tipo === 'pdf') return [a.pagina, a.retangulos[0]?.[1] ?? 0, a.retangulos[0]?.[0] ?? 0, ''];
  return [0, 0, 0, a.cfiInicio];
}

/** posição no livro: capítulo/parágrafo, página/linha ou o CFI do EPUB */
export function porPosicao(x: Marcacao, y: Marcacao): number {
  const a = chave(x);
  const b = chave(y);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return (a[i] as number) - (b[i] as number);
  return a[3].localeCompare(b[3], undefined, { numeric: true }) || x.criadaEm - y.criadaEm;
}

/** "p. 37" (PDF) ou "cap. 4" (texto); vazio quando não há como dizer (EPUB só tem o CFI) */
export function ondeCurto(m: TrechoCitavel): string {
  if (m.ancora.tipo === 'pdf') return `p. ${m.ancora.pagina}`;
  if (m.ancora.tipo === 'texto') return `cap. ${m.ancora.capitulo + 1}`;
  return '';
}

function abnt(nome: string): string {
  const p = nome.trim().split(/\s+/);
  if (p.length < 2) return nome.trim().toUpperCase();
  return `${p[p.length - 1]!.toUpperCase()}, ${p.slice(0, -1).join(' ')}`;
}

/** simples: “trecho” — Autor, *Título*, p. 37 · ABNT: “trecho” (SOBRENOME, Nome. Título. p. 37) */
export function citacao(m: TrechoCitavel, obra: Obra | undefined, formato: FormatoCitacao): string {
  const autor = obra?.criadores[0]?.nome ?? '';
  const titulo = obra?.titulo ?? '';
  const onde = ondeCurto(m);
  const trecho = `“${m.trecho}”`;
  if (formato === 'abnt') {
    const partes = [autor ? `${abnt(autor)}.` : '', titulo ? `${titulo}.` : '', onde].filter(Boolean);
    return partes.length ? `${trecho} (${partes.join(' ')})` : trecho;
  }
  const fonte = [autor, titulo ? `*${titulo}*` : '', onde].filter(Boolean).join(', ');
  return fonte ? `${trecho} — ${fonte}` : trecho;
}
