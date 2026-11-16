// O catálogo público dentro da biblioteca (D30): o baixador (um por funcionalidade, cada um com o seu estado) e
// pequenas funções de apoio. Sem React aqui; as peças visuais estão em Catalogo.tsx.
import type { ItemCatalogo, Obra } from '@fierium/contratos';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Servicos } from '../nucleo/servicos';

export type FaseBaixa =
  { fase: 'baixando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; obraId: string; edicaoId: string };

export interface Baixador {
  store: StoreApi<Record<string, FaseBaixa>>;
  /** baixa o item; devolve a obra/edição prontas (ou null se falhou: o estado do item guarda a mensagem) */
  baixar(id: string): Promise<{ obraId: string; edicaoId: string } | null>;
}

/** Mensagem em português; erro de rede aponta o caminho pra ligar a internet. */
export function mensagemDeBaixa(e: unknown): string {
  const { codigo, mensagem } = e as { codigo?: string; mensagem?: string };
  const texto = mensagem ?? String(e);
  return codigo === 'SEM_REDE' ? `${texto} Pra ligar a internet: Ajustes → Internet.` : texto;
}

export function criarBaixador(s: Servicos): Baixador {
  const store = createStore<Record<string, FaseBaixa>>(() => ({}));
  const pôr = (id: string, f: FaseBaixa) => store.setState({ [id]: f });
  return {
    store,
    async baixar(id) {
      if (store.getState()[id]?.fase === 'baixando') return null;
      pôr(id, { fase: 'baixando' });
      try {
        const r = await s.chamar('catalogo.baixar', { id });
        pôr(id, { fase: 'pronto', ...r });
        s.eventos.emitir('biblioteca-mudou', {});
        return r;
      } catch (e) {
        pôr(id, { fase: 'erro', mensagem: mensagemDeBaixa(e) });
        return null;
      }
    },
  };
}

/** "Machado de Assis" == "machado de assis " (sem acento, sem caixa). */
export function simples(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export const autorDoItem = (i: ItemCatalogo) => i.pessoas[0]?.nome ?? '';
export const licencaDoItem = (i: ItemCatalogo) => i.ofertas[0]?.licenca ?? 'Domínio público';

/** O que a pessoa ainda não tem (cinza). */
export const aindaNaoTem = (itens: ItemCatalogo[]) => itens.filter((i) => !i.obraId);

/** Obras e itens do catálogo juntos, do mais antigo pro mais novo (sem ano, no fim). */
export type Peca = { tipo: 'obra'; obra: Obra } | { tipo: 'item'; item: ItemCatalogo };
export function ordenarPorAno(pecas: Peca[]): Peca[] {
  const ano = (p: Peca) => (p.tipo === 'obra' ? p.obra.ano : p.item.ano) ?? Infinity;
  const titulo = (p: Peca) => (p.tipo === 'obra' ? p.obra.titulo : p.item.titulo);
  return [...pecas].sort(
    (a, b) => (ano(a) === ano(b) ? 0 : ano(a) < ano(b) ? -1 : 1) || titulo(a).localeCompare(titulo(b), 'pt-BR'),
  );
}
