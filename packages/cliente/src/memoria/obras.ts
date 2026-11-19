// Área "obras" (no Rust: fierium-biblioteca + fierium-dados): Início, listar com filtros, obter e atualizar.
import type { FiltroObras, Limiar, Obra } from '@fierium/contratos';
import { ErroFierium } from '../cliente';
import { autorDe, type Base, type Tratadores } from './base';
import { novoId } from './dados-exemplo';
import { combina } from './normalizar';

export const ESCREVEM_OBRAS = ['obra.atualizar', 'obra.juntar', 'edicao.separar', 'capa.salvar'] as const;

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
): Tratadores<
  | 'biblioteca.limiar'
  | 'obras.listar'
  | 'obra.obter'
  | 'obra.atualizar'
  | 'obra.juntar'
  | 'edicao.separar'
  | 'capa.salvar'
> {
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
    'obra.juntar': ({ ids }) => {
      const unicos = [...new Set(ids)];
      if (unicos.length < 2) throw new ErroFierium('ARGUMENTO_INVALIDO', 'preciso de duas obras diferentes pra juntar');
      const [alvo, ...outras] = unicos.map((id) => b.obra(id)) as [Obra, ...Obra[]];
      for (const o of outras) {
        for (const e of o.edicoes) alvo.edicoes.push({ ...e, obraId: alvo.id });
        for (const m of b.estado.marcacoes) if (m.obraId === o.id) m.obraId = alvo.id;
        for (const c of b.estado.colecoes)
          if (c.obraIds.includes(o.id)) c.obraIds = [...new Set(c.obraIds.map((x) => (x === o.id ? alvo.id : x)))];
        alvo.colecaoIds = [...new Set([...alvo.colecaoIds, ...o.colecaoIds])];
        alvo.relacao.favorita ||= o.relacao.favorita;
        alvo.relacao.adicionadaEm = Math.min(alvo.relacao.adicionadaEm, o.relacao.adicionadaEm);
        if ((o.relacao.ultimaLeitura ?? 0) > (alvo.relacao.ultimaLeitura ?? 0)) {
          alvo.relacao.ultimaLeitura = o.relacao.ultimaLeitura!;
          alvo.relacao.estado = o.relacao.estado;
        }
        b.estado.obras = b.estado.obras.filter((x) => x.id !== o.id);
      }
      // a lida por último primeiro (é a que "Continuar" abre)
      alvo.edicoes.sort((x, y) => (y.progresso?.quando ?? 0) - (x.progresso?.quando ?? 0));
      return alvo;
    },
    'capa.salvar': ({ edicaoId, imagem }) => {
      const { e } = b.edicao(edicaoId);
      e.capa = `data:image/webp;base64,${imagem}`;
      return { capa: e.capa };
    },
    'edicao.separar': ({ edicaoId }) => {
      const { o, e } = b.edicao(edicaoId);
      if (o.edicoes.length < 2)
        throw new ErroFierium('ARGUMENTO_INVALIDO', 'esta é a única edição da obra: não há do que separar');
      o.edicoes = o.edicoes.filter((x) => x.id !== edicaoId);
      const nova: Obra = {
        ...structuredClone(o),
        id: novoId(b.agora()),
        colecaoIds: [],
        edicoes: [e],
        relacao: {
          estado: e.progresso ? 'lendo' : 'nao-lida',
          favorita: false,
          adicionadaEm: b.agora(),
          ...(e.progresso ? { ultimaLeitura: e.progresso.quando } : {}),
        },
      };
      e.obraId = nova.id;
      for (const m of b.estado.marcacoes) if (m.edicaoId === edicaoId) m.obraId = nova.id;
      b.estado.obras.push(nova);
      return nova;
    },
  };
}
