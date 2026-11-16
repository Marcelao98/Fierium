// Página do autor (D30): as obras dele que a pessoa tem (coloridas) e as dos catálogos abertos (cinza), juntas e
// em ordem de ano.
import { createStore } from 'zustand/vanilla';
import { criarBaixador, ordenarPorAno, simples, type Peca } from '../../compartilhado/catalogo';
import type { Servicos } from '../../nucleo/servicos';

export function criarAutor(s: Servicos) {
  const store = createStore<{ nome: string; pecas: Peca[]; carregando: boolean }>(() => ({
    nome: '',
    pecas: [],
    carregando: false,
  }));
  const baixador = criarBaixador(s);
  let atual = '';

  async function abrir(nome: string) {
    atual = nome;
    store.setState({ nome, pecas: [], carregando: true });
    try {
      const alvo = simples(nome);
      const [obras, cat] = await Promise.all([
        s.chamar('obras.listar', { texto: nome }),
        s.chamar('catalogo.buscar', { autor: nome, limite: 100 }),
      ]);
      if (atual !== nome) return;
      const minhas: Peca[] = obras
        .filter((o) => o.criadores.some((c) => simples(c.nome) === alvo))
        .map((obra) => ({ tipo: 'obra', obra }));
      // item com obraId: a obra colorida já está na lista acima
      const cinza: Peca[] = cat.itens.filter((i) => !i.obraId).map((item) => ({ tipo: 'item', item }));
      store.setState({ pecas: ordenarPorAno([...minhas, ...cinza]) });
    } finally {
      if (atual === nome) store.setState({ carregando: false });
    }
  }
  s.eventos.ouvir('biblioteca-mudou', () => {
    if (atual) void abrir(atual).catch(() => undefined);
  });
  return { store, baixador, abrir };
}
export type Autor = ReturnType<typeof criarAutor>;
