// Área "busca" (Ctrl+K): obras, coleções, autores e marcações de uma vez.
import type { ResultadoBusca } from '@fierium/contratos';
import { autorDe, type Base, type Tratadores } from './base';
import { combina } from './normalizar';
import { filtrarObras } from './obras';

export function comandosBusca(b: Base): Tratadores<'busca.tudo'> {
  return {
    'busca.tudo': ({ texto }) => {
      if (!texto.trim()) return [];
      const { obras, colecoes, marcacoes } = b.estado;
      const r: ResultadoBusca[] = [];
      for (const o of filtrarObras(obras, { texto, ordem: 'titulo' }).slice(0, 8))
        r.push({ tipo: 'obra', id: o.id, titulo: o.titulo, detalhe: `${autorDe(o)} · ${o.reino}`, obraId: o.id });
      for (const c of colecoes.filter((c) => combina(texto, c.nome, c.descricao)).slice(0, 3))
        r.push({ tipo: 'colecao', id: c.id, titulo: c.nome, detalhe: `Coleção · ${c.obraIds.length} obras` });
      for (const a of [...new Set(obras.map(autorDe))].filter((a) => combina(texto, a)).slice(0, 3))
        r.push({ tipo: 'criador', id: a, titulo: a, detalhe: `${obras.filter((o) => autorDe(o) === a).length} obras` });
      for (const m of marcacoes.filter((m) => combina(texto, m.trecho, m.nota)).slice(0, 5))
        r.push({
          tipo: 'marcacao',
          id: m.id,
          titulo: `“${m.trecho}”`,
          detalhe: b.obra(m.obraId).titulo,
          obraId: m.obraId,
        });
      return r;
    },
  };
}
