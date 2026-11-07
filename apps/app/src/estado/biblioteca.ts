// A biblioteca vista pela interface: o Limiar, todas as obras (o Atlas precisa de todas), a lista filtrada do Índice,
// as coleções e a obra aberta. Os filtros do Índice ficam guardados aqui (voltar pra Biblioteca mantém onde estava).
import type { Colecao, EstadoLeitura, FiltroObras, Limiar, Marcacao, Obra } from '@fierium/contratos';
import { create } from 'zustand';
import { chamar } from './servicos';

interface Biblioteca {
  limiar: Limiar | null;
  todas: Obra[];
  lista: Obra[];
  filtro: FiltroObras;
  visao: 'grade' | 'lista';
  colecoes: Colecao[];
  obra: Obra | null;
  marcacoesDaObra: Marcacao[];
  carregando: boolean;
}

export const useBiblioteca = create<Biblioteca>(() => ({
  limiar: null,
  todas: [],
  lista: [],
  filtro: { ordem: 'recentes' },
  visao: 'grade',
  colecoes: [],
  obra: null,
  marcacoesDaObra: [],
  carregando: false,
}));

export async function carregarLimiar() {
  const limiar = await chamar('biblioteca.limiar', {});
  useBiblioteca.setState({ limiar });
}

export async function carregarTudo() {
  const [todas, colecoes] = await Promise.all([
    chamar('obras.listar', { ordem: 'titulo' }),
    chamar('colecoes.listar', {}),
  ]);
  useBiblioteca.setState({ todas, colecoes });
}

let pedido = 0;
export async function filtrar(m: Partial<FiltroObras>) {
  const filtro = { ...useBiblioteca.getState().filtro, ...m };
  for (const k of Object.keys(filtro) as (keyof FiltroObras)[]) if (filtro[k] === undefined) delete filtro[k];
  useBiblioteca.setState({ filtro, carregando: true });
  const meu = ++pedido;
  const lista = await chamar('obras.listar', filtro);
  if (meu === pedido) useBiblioteca.setState({ lista, carregando: false }); // só a resposta da última busca vale
}

export function mudarVisao(visao: 'grade' | 'lista') {
  useBiblioteca.setState({ visao });
}

export async function abrirObra(id: string) {
  useBiblioteca.setState({ obra: null, marcacoesDaObra: [] });
  const [obra, marcacoesDaObra] = await Promise.all([
    chamar('obra.obter', { id }),
    chamar('marcacoes.listar', { obraId: id }),
  ]);
  useBiblioteca.setState({ obra, marcacoesDaObra });
}

async function trocarObra(o: Obra) {
  useBiblioteca.setState((s) => ({
    obra: s.obra?.id === o.id ? o : s.obra,
    todas: s.todas.map((x) => (x.id === o.id ? o : x)),
    lista: s.lista.map((x) => (x.id === o.id ? o : x)),
  }));
  await carregarLimiar();
}

export async function favoritar(id: string, favorita: boolean) {
  await trocarObra(await chamar('obra.atualizar', { id, favorita }));
}

export async function mudarEstado(id: string, estado: EstadoLeitura) {
  await trocarObra(await chamar('obra.atualizar', { id, estado }));
}

export async function criarColecao(nome: string, descricao: string, matiz: number) {
  const c = await chamar('colecao.criar', { nome, descricao, matiz });
  useBiblioteca.setState((s) => ({ colecoes: [...s.colecoes, c] }));
  return c;
}

export async function definirObrasDaColecao(id: string, obraIds: string[]) {
  await chamar('colecao.definirObras', { id, obraIds });
  await carregarTudo();
}

/** Depois de ler: progresso e Limiar mudaram. */
export async function atualizarDepoisDeLer(obraId: string) {
  const o = await chamar('obra.obter', { id: obraId });
  await trocarObra(o);
}
