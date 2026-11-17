// Descobrir (D30): a busca no catálogo inteiro, as coleções prontas e a ficha de um item do catálogo.
// O que a pessoa já tem aparece colorido (item com obraId); o resto, em cinza, com "Baixar".
import type { ItemCatalogo, Obra } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import { criarBaixador, criarVigia } from '../../compartilhado/catalogo';
import type { Servicos } from '../../nucleo/servicos';

export interface ColecaoPronta {
  id: string;
  titulo: string;
  itens: ItemCatalogo[];
}

type Busca = { assunto?: string; autor?: string; idioma?: string };

/** Quantos livros cabem numa linha pronta. */
export const POR_LINHA = 24;

// Os assuntos e as estantes do Gutenberg são em inglês ("Poetry", "Science-Fiction & Fantasy"): é por eles que as
// coleções buscam, não por palavras em português. `tema` põe primeiro o que existe em português e completa com o resto.
const tema = (...assuntos: string[]): Busca[] => [
  ...assuntos.map((assunto) => ({ assunto, idioma: 'pt' })),
  ...assuntos.map((assunto) => ({ assunto })),
];
const BRASILEIROS = [
  'Machado de Assis',
  'José Alencar',
  'Aluísio Azevedo',
  'Lima Barreto',
  'Euclides da Cunha',
  'Castro Alves',
  'Gonçalves Dias',
  'Olavo Bilac',
  'Escragnolle Taunay',
  'Júlia Lopes de Almeida',
  'Casimiro de Abreu',
  'Álvares de Azevedo',
  'Bernardo Guimarães',
  'Joaquim Manuel de Macedo',
  'Raul Pompéia',
  'Simões Lopes Neto',
  'José de Anchieta',
  'Joaquim Nabuco',
  'Coelho Netto',
  'Adolfo Caminha',
];

/** As linhas prontas. Cada uma é uma lista de buscas no catálogo, na ordem (junta, tira repetidos, para quando enche). */
export const COLECOES: { id: string; titulo: string; buscas: Busca[] }[] = [
  { id: 'brasileiros', titulo: 'Clássicos brasileiros', buscas: BRASILEIROS.map((autor) => ({ autor, idioma: 'pt' })) },
  { id: 'portugues', titulo: 'Em português', buscas: [{ idioma: 'pt' }] },
  { id: 'melhores', titulo: 'Os melhores de todos os tempos', buscas: [{ assunto: 'Best Books Ever Listings' }] },
  { id: 'fantasia', titulo: 'Fantasia e aventura', buscas: tema('Fantasy', 'Adventure') },
  { id: 'ficcao-cientifica', titulo: 'Ficção científica', buscas: tema('Science Fiction') },
  { id: 'filosofia', titulo: 'Filosofia', buscas: tema('Philosophy') },
  { id: 'poesia', titulo: 'Poesia', buscas: tema('Poetry') },
  {
    id: 'ciencia',
    titulo: 'Ciência',
    buscas: tema('Science - Physics', 'Science - Biology', 'Science - Chemistry', 'Science - Earth', 'Mathematics'),
  },
  { id: 'misterio', titulo: 'Mistério e detetives', buscas: tema('Detective Fiction', 'Crime, Thrillers and Mystery') },
  { id: 'terror', titulo: 'Terror e gótico', buscas: tema('Horror', 'Gothic Fiction') },
  { id: 'mitologia', titulo: 'Mitos, lendas e contos de fadas', buscas: tema('Mythology', 'Fairy tales') },
  { id: 'teatro', titulo: 'Teatro', buscas: tema('Plays/Films/Dramas', 'Drama') },
  { id: 'historia', titulo: 'História', buscas: tema('History - Ancient', 'History - Medieval', 'History') },
  { id: 'infantil', titulo: 'Infantil e juvenil', buscas: tema('Children & Young Adult Reading') },
  { id: 'harvard', titulo: 'Clássicos de Harvard', buscas: [{ assunto: 'Harvard Classics' }] },
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
  // o catálogo chegou (primeira abertura, ou "Tentar de novo"): monta as linhas
  const vigia = criarVigia(s, () => void carregar().catch(() => undefined));
  let pedido = 0;

  async function carregarObras() {
    const lista = await s.chamar('obras.listar', {});
    store.setState({ obras: Object.fromEntries(lista.map((o) => [o.id, o])) });
  }
  async function carregar() {
    store.setState({ carregando: true });
    try {
      await Promise.all([carregarObras(), vigia.olhar()]);
      // sem catálogo não há o que buscar: a tela mostra o andamento (ou o erro) no lugar das linhas
      if (vigia.store.getState().estado?.fase !== 'pronto') {
        store.setState({ colecoes: [] });
        return;
      }
      const colecoes = await Promise.all(
        COLECOES.map(async (c) => {
          const vistos = new Map<string, ItemCatalogo>();
          for (const b of c.buscas) {
            if (vistos.size >= POR_LINHA) break;
            const r = await s.chamar('catalogo.buscar', { ...b, limite: POR_LINHA });
            for (const i of r.itens) if (vistos.size < POR_LINHA) vistos.set(i.id, i);
          }
          return { id: c.id, titulo: c.titulo, itens: [...vistos.values()] };
        }),
      );
      // linha sem nenhum livro não aparece
      store.setState({ colecoes: colecoes.filter((c) => c.itens.length > 0) });
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
  return { store, baixador, vigia, carregar, buscar, abrirItem };
}
export type Descobrir = ReturnType<typeof criarDescobrir>;
