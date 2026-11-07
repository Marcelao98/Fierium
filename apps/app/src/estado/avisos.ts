import { create } from 'zustand';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'info' | 'erro';
}

export const useAvisos = create<{ lista: Aviso[] }>(() => ({ lista: [] }));

let n = 0;
export function avisar(texto: string, tipo: Aviso['tipo'] = 'info', ms = 3200) {
  const id = ++n;
  useAvisos.setState((s) => ({ lista: [...s.lista, { id, texto, tipo }] }));
  setTimeout(() => useAvisos.setState((s) => ({ lista: s.lista.filter((a) => a.id !== id) })), ms);
}
