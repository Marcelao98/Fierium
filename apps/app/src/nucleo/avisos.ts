// Avisos curtos na tela (erro com código, confirmação). A store é da casca; as funcionalidades avisam por Servicos.
// Erro do núcleo leva os `detalhes` (comando, código, mensagem): o aviso mostra "Copiar detalhes" e fica mais tempo.
import { create } from 'zustand';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'info' | 'erro';
  detalhes?: string | undefined;
}

export const useAvisos = create<{ lista: Aviso[] }>(() => ({ lista: [] }));

let n = 0;
export function avisar(texto: string, tipo: Aviso['tipo'] = 'info', detalhes?: string, ms?: number) {
  const id = ++n;
  const duracao = ms ?? (detalhes ? 12_000 : tipo === 'erro' ? 6_000 : 3_200);
  useAvisos.setState((s) => ({ lista: [...s.lista, { id, texto, tipo, detalhes }] }));
  setTimeout(() => useAvisos.setState((s) => ({ lista: s.lista.filter((a) => a.id !== id) })), duracao);
}
