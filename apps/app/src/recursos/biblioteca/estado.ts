// Biblioteca: todas as obras (o mapa precisa de todas), a lista filtrada da grade e os filtros (voltar pra
// Biblioteca mantém onde estava). Só a resposta da última busca vale (digitar rápido não embaralha a lista).
import type { FiltroObras, ItemCatalogo, Obra } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import { aindaNaoTem, criarBaixador } from '../../compartilhado/catalogo';
import type { Servicos } from '../../nucleo/servicos';

export interface EstadoBiblioteca {
  todas: Obra[];
  lista: Obra[];
  filtro: FiltroObras;
  visao: 'grade' | 'lista';
  carregando: boolean;
  /** o que existe nos catálogos abertos e a pessoa ainda não tem (cinza) */
  paraBaixar: ItemCatalogo[];
  /** mostrar o cinza mesmo sem busca (lembrado) */
  mostrarCatalogo: boolean;
}

const CHAVE_CATALOGO = 'fierium.mostrarCatalogo';
function lerMostrar(): boolean {
  try {
    return localStorage.getItem(CHAVE_CATALOGO) === '1';
  } catch {
    return false; // sem armazenamento (janela privada): fica desligado
  }
}

export type MudancaFiltro = { [K in keyof FiltroObras]?: FiltroObras[K] | undefined };

export function criarBiblioteca(s: Servicos) {
  const store = createStore<EstadoBiblioteca>(() => ({
    todas: [],
    lista: [],
    filtro: { ordem: 'recentes' },
    visao: 'grade',
    carregando: false,
    paraBaixar: [],
    mostrarCatalogo: lerMostrar(),
  }));
  const baixador = criarBaixador(s);
  let pedido = 0;

  /** O cinza só vale pra busca por texto (ou com o interruptor ligado) e sem filtros que só fazem sentido pro que a pessoa tem. */
  async function buscarCinza(f: FiltroObras): Promise<ItemCatalogo[]> {
    const so = f.estado || f.favoritas || f.formato || f.colecaoId || f.reino;
    if (so || (!f.texto && !store.getState().mostrarCatalogo)) return [];
    try {
      const r = await s.chamar('catalogo.buscar', { ...(f.texto ? { texto: f.texto } : {}), limite: 48 });
      return aindaNaoTem(r.itens);
    } catch {
      return []; // o catálogo é um extra: sem ele a biblioteca continua inteira (o aviso já saiu)
    }
  }
  function mostrarCatalogo(v: boolean) {
    try {
      localStorage.setItem(CHAVE_CATALOGO, v ? '1' : '0');
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
    store.setState({ mostrarCatalogo: v });
    return filtrar();
  }

  /** Muda filtros; `undefined` tira o filtro. */
  async function filtrar(m: MudancaFiltro = {}) {
    const filtro = Object.fromEntries(
      Object.entries({ ...store.getState().filtro, ...m }).filter(([, v]) => v !== undefined),
    ) as FiltroObras;
    store.setState({ filtro, carregando: true });
    const meu = ++pedido;
    try {
      const lista = await s.chamar('obras.listar', filtro);
      if (meu === pedido) store.setState({ lista });
      const paraBaixar = await buscarCinza(filtro);
      if (meu === pedido) store.setState({ paraBaixar });
    } finally {
      if (meu === pedido) store.setState({ carregando: false });
    }
  }
  async function carregar() {
    const [todas] = await Promise.all([s.chamar('obras.listar', { ordem: 'titulo' }), filtrar()]);
    store.setState({ todas });
  }
  const recarregar = () => void carregar().catch(() => undefined);
  s.eventos.ouvir('obra-mudou', recarregar);
  s.eventos.ouvir('biblioteca-mudou', recarregar);
  s.eventos.ouvir('colecoes-mudaram', recarregar);
  return {
    store,
    baixador,
    mostrarCatalogo,
    carregar,
    filtrar,
    mudarVisao: (visao: 'grade' | 'lista') => store.setState({ visao }),
  };
}
export type Biblioteca = ReturnType<typeof criarBiblioteca>;
