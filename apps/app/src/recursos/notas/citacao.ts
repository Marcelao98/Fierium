// Funções puras das Notas: filtrar, ordenar pela posição no livro e montar a citação pronta pra copiar.
import type { Marcacao, Obra } from '@fierium/contratos';
import { porPosicao, semAcento } from '../../compartilhado/citacao';

// a citação e a ordem no livro moraram aqui; agora são compartilhadas com o leitor
export { citacao, ondeCurto, porPosicao, semAcento, type FormatoCitacao } from '../../compartilhado/citacao';

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
