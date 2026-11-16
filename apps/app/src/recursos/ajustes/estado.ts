// Pastas de livros (M3): lista, adicionar, remover e "procurar livros agora". Depois de cada varredura emite
// 'biblioteca-mudou' pro Início e a Biblioteca recarregarem.
import type { PastaBiblioteca, ResultadoVarredura } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

interface EstadoPastas {
  pastas: PastaBiblioteca[];
  varrendo: boolean;
  resultado: ResultadoVarredura | null;
  /** mensagem em português do último erro ao adicionar/remover/procurar */
  erro: string | null;
  /** pastas comuns que existem e ainda não estão na lista */
  sugestoes: string[];
}

export function criarPastas(s: Servicos) {
  const store = createStore<EstadoPastas>(() => ({
    pastas: [],
    varrendo: false,
    resultado: null,
    erro: null,
    sugestoes: [],
  }));
  // chamar() sempre rejeita com ErroFierium (mensagem em português)
  const falhou = (e: unknown) => store.setState({ erro: (e as { mensagem?: string }).mensagem ?? String(e) }); // o aviso e o log já saíram

  async function carregar() {
    try {
      store.setState({ pastas: await s.chamar('pastas.listar', {}) });
      await sugerir();
    } catch (e) {
      falhou(e);
    }
  }
  async function sugerir() {
    try {
      const todas = await s.chamar('pastas.sugestoes', {});
      const ja = new Set(store.getState().pastas.map((p) => p.caminho));
      store.setState({ sugestoes: todas.filter((c) => !ja.has(c)) });
    } catch {
      store.setState({ sugestoes: [] }); // sugestão é só conforto: sem ela, a pessoa digita ou escolhe
    }
  }
  /** abre o seletor do sistema e adiciona cada pasta escolhida (cada uma já procura os livros) */
  async function escolher() {
    if (!s.escolherPastas) return;
    let escolhidas: string[];
    try {
      escolhidas = await s.escolherPastas();
    } catch (e) {
      falhou({ mensagem: `Não consegui abrir o seletor de pastas: ${(e as Error)?.message ?? String(e)}` });
      return;
    }
    for (const c of escolhidas) await adicionar(c);
  }
  async function varrer() {
    if (store.getState().varrendo) return;
    store.setState({ varrendo: true, erro: null });
    try {
      const resultado = await s.chamar('biblioteca.varrer', {});
      store.setState({ resultado, pastas: await s.chamar('pastas.listar', {}) });
      s.eventos.emitir('biblioteca-mudou', {});
    } catch (e) {
      falhou(e);
    } finally {
      store.setState({ varrendo: false });
    }
  }
  async function adicionar(caminho: string): Promise<boolean> {
    store.setState({ erro: null });
    try {
      store.setState({ pastas: await s.chamar('pastas.adicionar', { caminho: caminho.trim() }) });
      await sugerir();
    } catch (e) {
      falhou(e);
      return false;
    }
    await varrer();
    return true;
  }
  async function remover(caminho: string) {
    store.setState({ erro: null });
    try {
      store.setState({ pastas: await s.chamar('pastas.remover', { caminho }) });
      await sugerir();
      s.eventos.emitir('biblioteca-mudou', {});
    } catch (e) {
      falhou(e);
    }
  }
  return { store, carregar, adicionar, escolher, podeEscolher: s.escolherPastas !== null, remover, varrer };
}
export type Pastas = ReturnType<typeof criarPastas>;
