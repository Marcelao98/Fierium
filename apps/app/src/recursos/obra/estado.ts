// Página da obra: a obra, as marcações dela, as coleções e as obras parecidas ("da mesma constelação").
import type { Colecao, EstadoLeitura, Marcacao, Obra } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

export interface EstadoObra {
  obra: Obra | null;
  marcacoes: Marcacao[];
  colecoes: Colecao[];
  parecidas: Obra[];
}

const autor = (o: Obra) => o.criadores[0]?.nome ?? '';

/** Mesmo autor ou série pesa mais; mesma área e assuntos em comum somam. */
export function parecidas(obra: Obra, todas: Obra[], max = 10): Obra[] {
  return todas
    .filter((o) => o.id !== obra.id)
    .map((o) => ({
      o,
      pontos:
        (autor(o) === autor(obra) ? 3 : 0) +
        (o.serie && o.serie.nome === obra.serie?.nome ? 3 : 0) +
        (o.reino === obra.reino ? 1 : 0) +
        o.assuntos.filter((a) => obra.assuntos.includes(a)).length,
    }))
    .filter((x) => x.pontos >= 2)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, max)
    .map((x) => x.o);
}

export function criarObra(s: Servicos) {
  const store = createStore<EstadoObra>(() => ({ obra: null, marcacoes: [], colecoes: [], parecidas: [] }));
  let atual: string | null = null;

  async function abrir(id: string) {
    if (atual !== id) store.setState({ obra: null, marcacoes: [] });
    atual = id;
    const [obra, marcacoes, colecoes, todas] = await Promise.all([
      s.chamar('obra.obter', { id }),
      s.chamar('marcacoes.listar', { obraId: id }),
      s.chamar('colecoes.listar', {}),
      s.chamar('obras.listar', {}),
    ]);
    if (atual === id) store.setState({ obra, marcacoes, colecoes, parecidas: parecidas(obra, todas) });
  }
  async function atualizar(m: { favorita?: boolean; estado?: EstadoLeitura }) {
    const o = store.getState().obra;
    if (!o) return;
    const obra = await s.chamar('obra.atualizar', { id: o.id, ...m });
    store.setState({ obra });
    s.eventos.emitir('obra-mudou', { obraId: o.id });
  }
  const recarregar = (d?: { obraId?: string }) => {
    if (atual && (!d?.obraId || d.obraId === atual)) void abrir(atual).catch(() => undefined);
  };
  s.eventos.ouvir('marcacoes-mudaram', recarregar);
  s.eventos.ouvir('colecoes-mudaram', () => recarregar());
  /** Junta outra obra nesta (as edições, as marcações e o progresso da outra vêm pra cá). */
  async function juntar(outraId: string) {
    const o = store.getState().obra;
    if (!o) return;
    const obra = await s.chamar('obra.juntar', { ids: [o.id, outraId] });
    store.setState({ obra });
    s.eventos.emitir('biblioteca-mudou', {});
    await abrir(obra.id);
  }
  /** Separa uma edição: ela vira uma obra própria. Devolve o id da obra nova. */
  async function separar(edicaoId: string): Promise<string> {
    const nova = await s.chamar('edicao.separar', { edicaoId });
    s.eventos.emitir('biblioteca-mudou', {});
    if (atual) await abrir(atual);
    return nova.id;
  }
  return {
    store,
    abrir,
    juntar,
    separar,
    todas: () => s.chamar('obras.listar', { ordem: 'titulo' }),
    favoritar: (favorita: boolean) => atualizar({ favorita }),
    marcarComoLida: () => atualizar({ estado: 'lida' }),
  };
}
export type PaginaObraEstado = ReturnType<typeof criarObra>;
