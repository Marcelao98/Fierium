import type { Marcacao, Obra } from '@fierium/contratos';
import { create } from 'zustand';
import { chamar } from './servicos';

interface Marginalia {
  marcacoes: Marcacao[];
  obras: Map<string, Obra>;
  cor: string | undefined;
  texto: string;
}

export const useMarginalia = create<Marginalia>(() => ({ marcacoes: [], obras: new Map(), cor: undefined, texto: '' }));

let pedido = 0;
export async function carregarMarginalia(m: { cor?: string | undefined; texto?: string } = {}) {
  const s = { ...useMarginalia.getState(), ...m };
  useMarginalia.setState({ cor: s.cor, texto: s.texto });
  const meu = ++pedido;
  const [marcacoes, obras] = await Promise.all([
    chamar('marcacoes.listar', { ...(s.cor ? { cor: s.cor } : {}), ...(s.texto ? { texto: s.texto } : {}) }),
    chamar('obras.listar', {}),
  ]);
  if (meu === pedido) useMarginalia.setState({ marcacoes, obras: new Map(obras.map((o) => [o.id, o])) });
}

export async function anotar(id: string, nota: string) {
  const nova = await chamar('marcacao.atualizar', { id, nota });
  useMarginalia.setState((s) => ({ marcacoes: s.marcacoes.map((x) => (x.id === id ? nova : x)) }));
}

/** Markdown com as marcações (por obra), pra levar pro Obsidian, Logseq ou onde quiser. */
export function paraMarkdown(marcacoes: Marcacao[], obras: Map<string, Obra>, nomeDaCor: (id: string) => string): string {
  const porObra = new Map<string, Marcacao[]>();
  for (const m of marcacoes) porObra.set(m.obraId, [...(porObra.get(m.obraId) ?? []), m]);
  const partes = ['# Marginália — Fierium', ''];
  for (const [obraId, ms] of porObra) {
    const o = obras.get(obraId);
    partes.push(`## ${o?.titulo ?? 'Obra'}${o?.criadores[0] ? ` — ${o.criadores[0].nome}` : ''}`, '');
    for (const m of ms) {
      const onde = m.ancora.tipo === 'pdf' ? ` (p. ${m.ancora.pagina})` : m.ancora.tipo === 'texto' ? ` (cap. ${m.ancora.capitulo + 1})` : '';
      partes.push(`> ${m.trecho}`, '', `— *${nomeDaCor(m.cor)}*${onde}`);
      if (m.nota) partes.push('', m.nota);
      partes.push('');
    }
  }
  return partes.join('\n');
}
