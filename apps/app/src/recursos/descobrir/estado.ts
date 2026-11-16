// Descobrir (D30): a busca no catálogo inteiro, as coleções prontas e a ficha de um item do catálogo.
// O que a pessoa já tem aparece colorido (item com obraId); o resto, em cinza, com "Baixar".
import type { ItemCatalogo, Obra } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import { criarBaixador } from '../../compartilhado/catalogo';
import type { Servicos } from '../../nucleo/servicos';

export interface ColecaoPronta {
  id: string;
  titulo: string;
  itens: ItemCatalogo[];
}

/** As linhas prontas. Cada uma é uma ou mais buscas no catálogo (junta e tira repetidos). */
export const COLECOES: { id: string; titulo: string; buscas: { texto?: string; idioma?: string }[] }[] = [
  { id: 'brasileiros', titulo: 'Clássicos brasileiros', buscas: [{ idioma: 'pt' }] },
  { id: 'fantasia', titulo: 'Fantasia e aventura', buscas: [{ texto: 'fantasia' }, { texto: 'aventura' }] },
  { id: 'filosofia', titulo: 'Filosofia', buscas: [{ texto: 'filosofia' }] },
  { id: 'poesia', titulo: 'Poesia', buscas: [{ texto: 'poesia' }, { texto: 'poemas' }] },
  { id: 'ciencia', titulo: 'Ciência', buscas: [{ texto: 'ciência' }, { texto: 'science' }] },
];

export interface EstadoDescobrir {
  texto: string;
  resultados: ItemCatalogo[] | null;
  total: number;
  colecoes: ColecaoPronta[];
  /** as obras da pessoa por id (pra mostrar colorido o que ela já tem) */
  obras: Record<string, Obra>;
  carregando: boolean;
  item: ItemCatalogo | null;
  /** erro ao abrir a ficha */
  erroItem: string | null;
}

export function criarDescobrir(s: Servicos) {
  const store = createStore<EstadoDescobrir>(() => ({
    texto: '',
    resultados: null,
    total: 0,
    colecoes: [],
    obras: {},
    carregando: false,
    item: null,
    erroItem: null,
  }));
  const baixador = criarBaixador(s);
  let pedido = 0;

  async function carregarObras() {
    const lista = await s.chamar('obras.listar', {});
    store.setState({ obras: Object.fromEntries(lista.map((o) => [o.id, o])) });
  }
  async function carregar() {
    store.setState({ carregando: true });
    try {
      await carregarObras();
      const colecoes = await Promise.all(
        COLECOES.map(async (c) => {
          const vistos = new Map<string, ItemCatalogo>();
          for (const b of c.buscas) {
            const r = await s.chamar('catalogo.buscar', { ...b, limite: 20 });
            for (const i of r.itens) vistos.set(i.id, i);
          }
          return { id: c.id, titulo: c.titulo, itens: [...vistos.values()] };
        }),
      );
      store.setState({ colecoes });
      const t = store.getState().texto;
      if (t) await buscar(t);
    } finally {
      store.setState({ carregando: false });
    }
  }
  async function buscar(texto: string) {
    store.setState({ texto });
    const meu = ++pedido;
    if (!texto.trim()) {
      store.setState({ resultados: null, total: 0 });
      return;
    }
    const r = await s.chamar('catalogo.buscar', { texto: texto.trim(), limite: 60 });
    if (meu === pedido) store.setState({ resultados: r.itens, total: r.total });
  }
  async function abrirItem(id: string) {
    store.setState({ item: null, erroItem: null });
    try {
      const item = await s.chamar('catalogo.item', { id });
      store.setState({ item });
    } catch (e) {
      store.setState({ erroItem: (e as { mensagem?: string }).mensagem ?? String(e) }); // o aviso já saiu
    }
  }
  s.eventos.ouvir('biblioteca-mudou', () => {
    const id = store.getState().item?.id;
    void carregar().catch(() => undefined);
    if (id) void abrirItem(id);
  });
  return { store, baixador, carregar, buscar, abrirItem };
}
export type Descobrir = ReturnType<typeof criarDescobrir>;
