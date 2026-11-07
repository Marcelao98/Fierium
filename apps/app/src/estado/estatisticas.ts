import type { Meta, ResumoEstatisticas } from '@fierium/contratos';
import { create } from 'zustand';
import { chamar } from './servicos';

export const useEstatisticas = create<{ resumo: ResumoEstatisticas | null }>(() => ({ resumo: null }));

export async function carregarEstatisticas() {
  useEstatisticas.setState({ resumo: await chamar('estatisticas.resumo', {}) });
}

export async function salvarMetas(metas: Meta[]) {
  await chamar('metas.salvar', { metas });
  await carregarEstatisticas();
}

export function novaMetaId(): string {
  return crypto.randomUUID();
}
