// Adaptador em memória (D4/D5): imita os comandos que o núcleo Rust vai ter, com a biblioteca de exemplo. É o que o
// `pnpm dev` e os testes usam. Guarda as mudanças no localStorage (se der) pra sobreviverem a um recarregar.
// Cada comando devolve uma CÓPIA (a tela nunca mexe no estado daqui por engano).
import type {
  ArgsDe,
  Config,
  ConteudoDemo,
  FiltroObras,
  Limiar,
  Marcacao,
  NomeComando,
  Obra,
  ResultadoBusca,
  RespostaDe,
} from '@fierium/contratos';
import { ErroFierium, type Cliente } from '../cliente';
import { bibliotecaDeExemplo, CORES_PADRAO, novoId, type Estado } from './dados-exemplo';
import { resumo } from './estatisticas';
import { combina } from './normalizar';
import { DOM_CASMURRO, textoDeExemplo } from './texto-demo';

export interface OpcoesMemoria {
  /** relógio (os testes passam um fixo) */
  agora?: () => number;
  /** onde guardar entre recarregamentos; null = só na memória */
  guardar?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  /** atraso artificial em ms (pra ver os estados de carregando) */
  atraso?: number;
  /** começa como na primeira vez (abertura) */
  primeiraVez?: boolean;
}

const CHAVE = 'fierium.memoria.v1';

export const CONFIG_PADRAO: Config = {
  tema: 'noite',
  movimento: 'normal',
  leitura: { fonte: 'literata', tamanho: 20, entrelinha: 1.7, largura: 66, tema: 'noite' },
  cores: CORES_PADRAO,
  primeiraVez: true,
};

interface Guardado {
  estado: Estado;
  config: Config;
}

export function criarClienteMemoria(op: OpcoesMemoria = {}): Cliente {
  const agora = op.agora ?? Date.now;
  const guardar = op.guardar === undefined ? null : op.guardar;
  let g: Guardado | null = null;
  try {
    const t = guardar?.getItem(CHAVE);
    if (t) g = JSON.parse(t) as Guardado;
  } catch {
    g = null; // guardado estragado ou sem acesso: começa da biblioteca de exemplo
  }
  const estado: Estado = g?.estado ?? bibliotecaDeExemplo(agora());
  let config: Config = g?.config ?? { ...CONFIG_PADRAO, primeiraVez: op.primeiraVez ?? true };
  const salvar = () => {
    try {
      guardar?.setItem(CHAVE, JSON.stringify({ estado, config } satisfies Guardado));
    } catch {
      // sem espaço ou sem acesso: as mudanças valem só até fechar (é o adaptador de demonstração)
    }
  };

  const obra = (id: string) => {
    const o = estado.obras.find((x) => x.id === id);
    if (!o) throw new ErroFierium('NAO_ENCONTRADO', `obra não encontrada: ${id}`);
    return o;
  };
  const edicao = (id: string) => {
    for (const o of estado.obras) for (const e of o.edicoes) if (e.id === id) return { o, e };
    throw new ErroFierium('NAO_ENCONTRADO', `edição não encontrada: ${id}`);
  };
  const progresso = (o: Obra) => Math.max(0, ...o.edicoes.map((e) => e.progresso?.fracao ?? 0));
  const autor = (o: Obra) => o.criadores[0]?.nome ?? '';

  const filtrar = (f: FiltroObras): Obra[] => {
    let l = estado.obras.filter(
      (o) =>
        (!f.texto || combina(f.texto, o.titulo, autor(o), o.assuntos.join(' '), o.serie?.nome, o.reino)) &&
        (!f.estado || o.relacao.estado === f.estado) &&
        (!f.formato || o.edicoes.some((e) => e.formato === f.formato)) &&
        (!f.colecaoId || o.colecaoIds.includes(f.colecaoId)) &&
        (!f.reino || o.reino === f.reino) &&
        (!f.favoritas || o.relacao.favorita),
    );
    const ordem = f.ordem ?? 'recentes';
    const titulo = (o: Obra) => (o.serie ? `${o.serie.nome} ${String(o.serie.volume).padStart(4, '0')}` : o.titulo);
    l = [...l].sort((a, b) =>
      ordem === 'titulo'
        ? titulo(a).localeCompare(titulo(b), 'pt-BR')
        : ordem === 'autor'
          ? autor(a).localeCompare(autor(b), 'pt-BR') || titulo(a).localeCompare(titulo(b), 'pt-BR')
          : ordem === 'progresso'
            ? progresso(b) - progresso(a)
            : (b.relacao.ultimaLeitura ?? b.relacao.adicionadaEm) - (a.relacao.ultimaLeitura ?? a.relacao.adicionadaEm),
    );
    return l;
  };

  const marcacao = (id: string) => {
    const m = estado.marcacoes.find((x) => x.id === id);
    if (!m) throw new ErroFierium('NAO_ENCONTRADO', `marcação não encontrada: ${id}`);
    return m;
  };

  const comandos: { [C in NomeComando]: (a: ArgsDe<C>) => RespostaDe<C> } = {
    'app.info': () => ({ versao: '0.1.0', plataforma: 'navegador', adaptador: 'memória' }),
    'biblioteca.limiar': (): Limiar => {
      const lendo = estado.obras
        .filter((o) => o.relacao.estado === 'lendo')
        .sort((a, b) => (b.relacao.ultimaLeitura ?? 0) - (a.relacao.ultimaLeitura ?? 0));
      const antigas = estado.marcacoes.filter((m) => agora() - m.criadaEm > 30 * 86_400_000 && m.tipo === 'destaque');
      // o eco muda uma vez por dia, mas é o mesmo o dia inteiro
      const eco = antigas.length ? antigas[Math.floor(agora() / 86_400_000) % antigas.length]! : null;
      return {
        ultimo: lendo[0] ?? null,
        emAndamento: lendo.slice(1, 7),
        eco: eco ? { marcacao: eco, obra: obra(eco.obraId) } : null,
        novidades: [...estado.obras].sort((a, b) => b.relacao.adicionadaEm - a.relacao.adicionadaEm).slice(0, 8),
        esquecidas: estado.obras
          .filter((o) => o.relacao.estado === 'nao-lida' && agora() - o.relacao.adicionadaEm > 60 * 86_400_000)
          .sort((a, b) => a.relacao.adicionadaEm - b.relacao.adicionadaEm)
          .slice(0, 3),
        totalObras: estado.obras.length,
      };
    },
    'obras.listar': (f) => filtrar(f),
    'obra.obter': ({ id }) => obra(id),
    'obra.atualizar': ({ id, favorita, estado: est }) => {
      const o = obra(id);
      if (favorita !== undefined) o.relacao.favorita = favorita;
      if (est) {
        o.relacao.estado = est;
        if (est === 'lida') o.relacao.terminadaEm = agora();
      }
      return o;
    },
    'colecoes.listar': () => estado.colecoes,
    'colecao.criar': ({ nome, descricao, matiz }) => {
      if (!nome.trim()) throw new ErroFierium('ARGUMENTO_INVALIDO', 'a coleção precisa de um nome');
      const c = { id: novoId(agora()), nome: nome.trim(), descricao, matiz, obraIds: [], criadaEm: agora() };
      estado.colecoes.push(c);
      return c;
    },
    'colecao.definirObras': ({ id, obraIds }) => {
      const c = estado.colecoes.find((x) => x.id === id);
      if (!c) throw new ErroFierium('NAO_ENCONTRADO', `coleção não encontrada: ${id}`);
      c.obraIds = [...new Set(obraIds)];
      for (const o of estado.obras) {
        const tem = c.obraIds.includes(o.id);
        o.colecaoIds = tem ? [...new Set([...o.colecaoIds, id])] : o.colecaoIds.filter((x) => x !== id);
      }
      return c;
    },
    'leitura.conteudo': ({ edicaoId }): ConteudoDemo => {
      const { o } = edicao(edicaoId);
      return {
        edicaoId,
        capitulos: o.titulo === 'Dom Casmurro' ? DOM_CASMURRO : textoDeExemplo(o.titulo, autor(o)),
      };
    },
    'progresso.salvar': ({ edicaoId, posicao, fracao }) => {
      if (!(fracao >= 0 && fracao <= 1)) throw new ErroFierium('ARGUMENTO_INVALIDO', 'a fração vai de 0 a 1');
      const { o, e } = edicao(edicaoId);
      e.progresso = { posicao, fracao, quando: agora() };
      o.relacao.ultimaLeitura = agora();
      if (o.relacao.estado === 'nao-lida' || o.relacao.estado === 'deixada') o.relacao.estado = 'lendo';
      return null;
    },
    'marcacoes.listar': ({ obraId, cor, texto }) =>
      estado.marcacoes
        .filter(
          (m) =>
            (!obraId || m.obraId === obraId) &&
            (!cor || m.cor === cor) &&
            (!texto || combina(texto, m.trecho, m.nota, obra(m.obraId).titulo)),
        )
        .sort((a, b) => b.criadaEm - a.criadaEm),
    'marcacao.criar': (a) => {
      edicao(a.edicaoId);
      if (!a.trecho.trim() && a.tipo === 'destaque') throw new ErroFierium('ARGUMENTO_INVALIDO', 'marcação sem trecho');
      const m: Marcacao = { ...a, id: novoId(agora()), criadaEm: agora(), editadaEm: agora() };
      estado.marcacoes.push(m);
      return m;
    },
    'marcacao.atualizar': ({ id, ...mud }) => {
      const m = marcacao(id);
      if (mud.cor !== undefined) m.cor = mud.cor;
      if (mud.nota !== undefined) {
        if (mud.nota.trim()) m.nota = mud.nota;
        else delete m.nota;
      }
      if (mud.etiquetas) m.etiquetas = mud.etiquetas;
      if (mud.ligacoes) m.ligacoes = mud.ligacoes;
      m.editadaEm = agora();
      return m;
    },
    'marcacao.apagar': ({ id }) => {
      marcacao(id);
      estado.marcacoes = estado.marcacoes.filter((m) => m.id !== id);
      for (const m of estado.marcacoes) m.ligacoes = m.ligacoes.filter((l) => l !== id);
      return null;
    },
    'sessao.registrar': ({ edicaoId, segundos, paginas }) => {
      const { o } = edicao(edicaoId);
      if (segundos < 1) return null;
      estado.sessoes.push({
        id: novoId(agora()),
        obraId: o.id,
        edicaoId,
        inicio: agora() - segundos * 1000,
        segundos: Math.round(segundos),
        paginas,
        aparelho: 'navegador',
      });
      return null;
    },
    'estatisticas.resumo': () => resumo(estado.sessoes, estado.obras, estado.metas, agora()),
    'metas.salvar': ({ metas }) => {
      for (const m of metas)
        if (!(m.alvo > 0)) throw new ErroFierium('ARGUMENTO_INVALIDO', 'a meta precisa de um alvo maior que zero');
      estado.metas = metas;
      return resumo(estado.sessoes, estado.obras, estado.metas, agora()).metas;
    },
    'config.ler': () => config,
    'config.gravar': ({ config: c }) => {
      config = c;
      return config;
    },
    'busca.tudo': ({ texto }) => {
      if (!texto.trim()) return [];
      const r: ResultadoBusca[] = [];
      for (const o of filtrar({ texto, ordem: 'titulo' }).slice(0, 8))
        r.push({ tipo: 'obra', id: o.id, titulo: o.titulo, detalhe: `${autor(o)} · ${o.reino}`, obraId: o.id });
      for (const c of estado.colecoes.filter((c) => combina(texto, c.nome, c.descricao)).slice(0, 3))
        r.push({ tipo: 'colecao', id: c.id, titulo: c.nome, detalhe: `Coleção · ${c.obraIds.length} obras` });
      const autores = [...new Set(estado.obras.map(autor))].filter((a) => combina(texto, a)).slice(0, 3);
      for (const a of autores)
        r.push({ tipo: 'criador', id: a, titulo: a, detalhe: `${estado.obras.filter((o) => autor(o) === a).length} obras` });
      for (const m of estado.marcacoes.filter((m) => combina(texto, m.trecho, m.nota)).slice(0, 5))
        r.push({ tipo: 'marcacao', id: m.id, titulo: `“${m.trecho}”`, detalhe: obra(m.obraId).titulo, obraId: m.obraId });
      return r;
    },
  };

  const ESCREVEM = new Set<NomeComando>([
    'obra.atualizar',
    'colecao.criar',
    'colecao.definirObras',
    'progresso.salvar',
    'marcacao.criar',
    'marcacao.atualizar',
    'marcacao.apagar',
    'sessao.registrar',
    'metas.salvar',
    'config.gravar',
  ]);

  return {
    async chamar<C extends NomeComando>(cmd: C, args: ArgsDe<C>): Promise<RespostaDe<C>> {
      if (op.atraso) await new Promise((ok) => setTimeout(ok, op.atraso));
      const f = comandos[cmd] as ((a: ArgsDe<C>) => RespostaDe<C>) | undefined;
      if (!f) throw new ErroFierium('COMANDO_DESCONHECIDO', `comando desconhecido: ${String(cmd)}`);
      const r = f(structuredClone(args));
      if (ESCREVEM.has(cmd)) salvar();
      return structuredClone(r);
    },
  };
}
