// Área "obras" (no Rust: fierium-biblioteca + fierium-dados): Início, listar com filtros, obter e atualizar.
import type { FiltroObras, Limiar, Obra } from '@fierium/contratos';
import { autorDe, type Base, type Tratadores } from './base';
import { combina } from './normalizar';

export const ESCREVEM_OBRAS = ['obra.atualizar'] as const;

const fracao = (o: Obra) => Math.max(0, ...o.edicoes.map((e) => e.progresso?.fracao ?? 0));

export function filtrarObras(obras: Obra[], f: FiltroObras): Obra[] {
  const l = obras.filter(
    (o) =>
      (!f.texto || combina(f.texto, o.titulo, autorDe(o), o.assuntos.join(' '), o.serie?.nome, o.reino)) &&
      (!f.estado || o.relacao.estado === f.estado) &&
      (!f.formato || o.edicoes.some((e) => e.formato === f.formato)) &&
      (!f.colecaoId || o.colecaoIds.includes(f.colecaoId)) &&
      (!f.reino || o.reino === f.reino) &&
      (!f.favoritas || o.relacao.favorita),
  );
  const ordem = f.ordem ?? 'recentes';
  const titulo = (o: Obra) => (o.serie ? `${o.serie.nome} ${String(o.serie.volume).padStart(4, '0')}` : o.titulo);
  return [...l].sort((a, b) =>
    ordem === 'titulo'
      ? titulo(a).localeCompare(titulo(b), 'pt-BR')
      : ordem === 'autor'
        ? autorDe(a).localeCompare(autorDe(b), 'pt-BR') || titulo(a).localeCompare(titulo(b), 'pt-BR')
        : ordem === 'progresso'
          ? fracao(b) - fracao(a)
          : (b.relacao.ultimaLeitura ?? b.relacao.adicionadaEm) - (a.relacao.ultimaLeitura ?? a.relacao.adicionadaEm),
  );
}

export function comandosObras(
  b: Base,
): Tratadores<'biblioteca.limiar' | 'obras.listar' | 'obra.obter' | 'obra.atualizar'> {
  const DIA = 86_400_000;
  return {
    'biblioteca.limiar': (): Limiar => {
      const { obras, marcacoes } = b.estado;
      const lendo = obras
        .filter((o) => o.relacao.estado === 'lendo')
        .sort((x, y) => (y.relacao.ultimaLeitura ?? 0) - (x.relacao.ultimaLeitura ?? 0));
      const antigas = marcacoes.filter((m) => b.agora() - m.criadaEm > 30 * DIA && m.tipo === 'destaque');
      // a marcação antiga que volta muda uma vez por dia, mas é a mesma o dia inteiro
      const eco = antigas.length ? antigas[Math.floor(b.agora() / DIA) % antigas.length]! : null;
      return {
        ultimo: lendo[0] ?? null,
        emAndamento: lendo.slice(1, 7),
        eco: eco ? { marcacao: eco, obra: b.obra(eco.obraId) } : null,
        novidades: [...obras].sort((x, y) => y.relacao.adicionadaEm - x.relacao.adicionadaEm).slice(0, 8),
        esquecidas: obras
          .filter((o) => o.relacao.estado === 'nao-lida' && b.agora() - o.relacao.adicionadaEm > 60 * DIA)
          .sort((x, y) => x.relacao.adicionadaEm - y.relacao.adicionadaEm)
          .slice(0, 3),
        totalObras: obras.length,
      };
    },
    'obras.listar': (f) => filtrarObras(b.estado.obras, f),
    'obra.obter': ({ id }) => b.obra(id),
    'obra.atualizar': ({ id, favorita, estado }) => {
      const o = b.obra(id);
      if (favorita !== undefined) o.relacao.favorita = favorita;
      if (estado) {
        o.relacao.estado = estado;
        if (estado === 'lida') o.relacao.terminadaEm = b.agora();
      }
      return o;
    },
  };
}
