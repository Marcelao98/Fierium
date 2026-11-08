import type { Marcacao, Obra } from '@fierium/contratos';

/** Markdown com as marcações (por obra), pra levar pro Obsidian, Logseq ou onde quiser. */
export function paraMarkdown(
  marcacoes: Marcacao[],
  obras: Map<string, Obra>,
  nomeDaCor: (id: string) => string,
): string {
  const porObra = new Map<string, Marcacao[]>();
  for (const m of marcacoes) porObra.set(m.obraId, [...(porObra.get(m.obraId) ?? []), m]);
  const partes = ['# Notas — Fierium', ''];
  for (const [obraId, ms] of porObra) {
    const o = obras.get(obraId);
    partes.push(`## ${o?.titulo ?? 'Obra'}${o?.criadores[0] ? ` — ${o.criadores[0].nome}` : ''}`, '');
    for (const m of ms) {
      const onde =
        m.ancora.tipo === 'pdf'
          ? ` (p. ${m.ancora.pagina})`
          : m.ancora.tipo === 'texto'
            ? ` (cap. ${m.ancora.capitulo + 1})`
            : '';
      partes.push(`> ${m.trecho}`, '', `— *${nomeDaCor(m.cor)}*${onde}`);
      if (m.nota) partes.push('', m.nota);
      partes.push('');
    }
  }
  return partes.join('\n');
}
