// A primeira abertura em três passos: boas-vindas → "Onde estão seus livros?" → andamento (a varredura, o catálogo que
// chega e três clássicos pra abrir já). Esta store guarda o passo e faz o trabalho; a tela (Abertura.tsx) só desenha.
import type { FiltroCatalogo, ItemCatalogo } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import { criarBaixador, criarVigia, type Baixador, type Vigia } from '../../compartilhado/catalogo';
import type { Servicos } from '../../nucleo/servicos';

export type PassoAbertura = 'boas-vindas' | 'pasta' | 'andamento' | 'formando';

export interface EstadoAbertura {
  passo: PassoAbertura;
  /** os clássicos sugeridos ("Comece por…"); vazio até o catálogo chegar */
  classicos: ItemCatalogo[];
  /** já tentou buscar os clássicos (pra distinguir "ainda não" de "não achei") */
  buscou: boolean;
  /** a pessoa escolheu (ou aceitou) pelo menos uma pasta */
  usouPasta: boolean;
  /** pastas comuns que existem neste computador (~/Livros…) e ainda dá pra sugerir */
  sugestoes: string[];
  /** a varredura das pastas está andando / já terminou (com quantos livros) / falhou (mensagem) */
  varrendo: boolean;
  livros: number | null;
  erroPasta: string | null;
}

/** O que sugerir primeiro: um de cada, na ordem, até juntar 3. Os do português vêm antes. */
export const CLASSICOS: FiltroCatalogo[] = [
  { texto: 'Dom Casmurro', idioma: 'pt' },
  { texto: "Alice's Adventures in Wonderland" },
  { texto: 'Os Lusíadas', idioma: 'pt' },
  { texto: 'Frankenstein' },
  { texto: 'Memórias Póstumas de Brás Cubas', idioma: 'pt' },
  { texto: 'Pride and Prejudice' },
  { texto: 'The Adventures of Sherlock Holmes' },
];
export const QUANTOS_CLASSICOS = 3;

export function criarAbertura(s: Servicos) {
  const store = createStore<EstadoAbertura>(() => ({
    passo: 'boas-vindas',
    classicos: [],
    buscou: false,
    usouPasta: false,
    sugestoes: [],
    varrendo: false,
    livros: null,
    erroPasta: null,
  }));
  const baixador: Baixador = criarBaixador(s);
  let buscando = false;

  async function buscarClassicos() {
    if (buscando || store.getState().classicos.length >= QUANTOS_CLASSICOS) return;
    buscando = true;
    try {
      const achados: ItemCatalogo[] = [];
      const jaTem = new Set<string>();
      const por = async (f: FiltroCatalogo, quantos: number) => {
        const r = await s.chamar('catalogo.buscar', { ...f, limite: quantos });
        for (const i of r.itens) {
          if (achados.length >= QUANTOS_CLASSICOS) return;
          if (!jaTem.has(i.id)) {
            jaTem.add(i.id);
            achados.push(i);
          }
        }
      };
      for (const f of CLASSICOS) {
        if (achados.length >= QUANTOS_CLASSICOS) break;
        await por(f, 1);
      }
      // faltou: completa com os mais lidos de todos os tempos
      if (achados.length < QUANTOS_CLASSICOS)
        await por({ assunto: 'Best Books Ever Listings' }, QUANTOS_CLASSICOS - achados.length);
      store.setState({ classicos: achados, buscou: true });
    } catch {
      // o aviso (com os detalhes) já saiu; a tela diz que não achou e oferece o Descobrir
      store.setState({ buscou: true });
    } finally {
      buscando = false;
    }
  }

  /** o catálogo chegando faz buscar os clássicos de novo (a primeira busca pode ter achado menos que 3) */
  const vigia: Vigia = criarVigia(s, () => void buscarClassicos());

  function comecarAndamento() {
    store.setState({ passo: 'andamento' });
    void vigia.olhar();
    void buscarClassicos();
  }

  /** as pastas escolhidas entram, a varredura anda e a tela já mostra o andamento */
  async function usarPastas(caminhos: string[]) {
    if (!caminhos.length) return;
    store.setState({ usouPasta: true });
    comecarAndamento();
    store.setState({ varrendo: true, livros: null, erroPasta: null });
    try {
      for (const caminho of caminhos) await s.chamar('pastas.adicionar', { caminho: caminho.trim() });
      await s.chamar('biblioteca.varrer', {});
      const lista = await s.chamar('pastas.listar', {});
      store.setState({ livros: lista.reduce((n, p) => n + p.arquivos, 0) });
      s.eventos.emitir('biblioteca-mudou', {});
    } catch (e) {
      // chamar() já avisou (com os detalhes); a tela mostra o motivo e oferece escolher outra pasta
      store.setState({ erroPasta: (e as { mensagem?: string }).mensagem ?? String(e) });
    } finally {
      store.setState({ varrendo: false });
    }
  }

  /** as sugestões de um clique (pastas comuns que existem); sem elas a pessoa escolhe no seletor */
  async function carregarSugestoes() {
    try {
      store.setState({ sugestoes: await s.chamar('pastas.sugestoes', {}) });
    } catch {
      store.setState({ sugestoes: [] }); // sugestão é só conforto
    }
  }

  return {
    store,
    baixador,
    vigia,
    irPara: (passo: PassoAbertura) => store.setState({ passo }),
    comecarAndamento,
    usarPastas,
    /** abre o seletor do sistema; cancelar não muda nada */
    async escolherPasta() {
      if (!s.escolherPastas) return;
      let escolhidas: string[];
      try {
        escolhidas = await s.escolherPastas();
      } catch (e) {
        s.avisar(`Não consegui abrir o seletor de pastas: ${(e as Error)?.message ?? String(e)}`, 'erro');
        return;
      }
      await usarPastas(escolhidas);
    },
    buscarClassicos,
    carregarSugestoes,
    parar: () => vigia.parar(),
  };
}
export type Abertura = ReturnType<typeof criarAbertura>;
