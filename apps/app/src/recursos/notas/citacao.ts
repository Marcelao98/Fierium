// Funções puras das Notas: filtrar, ordenar pela posição no livro e montar a citação pronta pra copiar.
import type { Marcacao, Obra } from '@fierium/contratos';

export type FormatoCitacao = 'simples' | 'abnt';
export type AbaNotas = 'todas' | 'citacoes';
export const TIPOS: { id: Marcacao['tipo']; nome: string }[] = [
  { id: 'destaque', nome: 'Marca-texto' },
  { id: 'nota', nome: 'Nota' },
  { id: 'marcador', nome: 'Marcador' },
];

export interface FiltroNotas {
  obraId?: string | undefined;
  cor?: string | undefined;
  tipo?: Marcacao['tipo'] | undefined;
  texto?: string | undefined;
}

/** minúsculas e sem acento, pra comparar texto */
export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function filtrar(
  ms: Marcacao[],
  f: FiltroNotas,
  obras: Map<string, Obra>,
  ignorar?: keyof FiltroNotas,
): Marcacao[] {
  const q = f.texto?.trim() ? semAcento(f.texto.trim()) : '';
  return ms.filter(
    (m) =>
      (ignorar === 'obraId' || !f.obraId || m.obraId === f.obraId) &&
      (ignorar === 'cor' || !f.cor || m.cor === f.cor) &&
      (ignorar === 'tipo' || !f.tipo || m.tipo === f.tipo) &&
      (!q || semAcento(`${m.trecho} ${m.nota ?? ''} ${obras.get(m.obraId)?.titulo ?? ''}`).includes(q)),
  );
}

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

export interface Grupo {
  obra: Obra | undefined;
  obraId: string;
  marcacoes: Marcacao[];
}

/** agrupa por livro (ordem alfabética) e ordena cada grupo pela posição no livro */
export function agrupar(ms: Marcacao[], obras: Map<string, Obra>): Grupo[] {
  const por = new Map<string, Marcacao[]>();
  for (const m of ms) por.set(m.obraId, [...(por.get(m.obraId) ?? []), m]);
  return [...por]
    .map(([obraId, lista]) => ({ obraId, obra: obras.get(obraId), marcacoes: lista.sort(porPosicao) }))
    .sort((a, b) => (a.obra?.titulo ?? '').localeCompare(b.obra?.titulo ?? '', 'pt-BR'));
}

/** "p. 37" (PDF) ou "cap. 4" (texto); vazio quando não há como dizer (EPUB só tem o CFI) */
export function ondeCurto(m: Marcacao): string {
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
export function citacao(m: Marcacao, obra: Obra | undefined, formato: FormatoCitacao): string {
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
