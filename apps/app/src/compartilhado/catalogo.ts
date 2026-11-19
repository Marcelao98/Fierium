// O catálogo público dentro da biblioteca (D30): o baixador (um por funcionalidade, cada um com o seu estado) e
// pequenas funções de apoio. Sem React aqui; as peças visuais estão em Catalogo.tsx.
import type { EstadoCatalogo, ItemCatalogo, Obra } from '@fierium/contratos';
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

/** Vigia o catálogo enquanto ele baixa: a tela nunca fica vazia sem dizer por quê. */
export interface Vigia {
  store: StoreApi<{ estado: EstadoCatalogo | null }>;
  /** pergunta ao núcleo como o catálogo está; enquanto baixa, pergunta de novo sozinho */
  olhar(): Promise<void>;
  /** manda baixar o catálogo do Gutenberg (de novo) */
  tentarDeNovo(): void;
  parar(): void;
}

const ANDANDO = ['baixando', 'importando'];

/** `aoChegar` roda quando o catálogo fica pronto depois de ter sido visto sem estar (pra tela buscar de novo). */
export function criarVigia(s: Servicos, aoChegar: () => void, espera = 1000): Vigia {
  const store = createStore<{ estado: EstadoCatalogo | null }>(() => ({ estado: null }));
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const depois = () => {
    clearTimeout(relogio);
    relogio = setTimeout(() => void olhar(), espera);
  };
  async function olhar() {
    const antes = store.getState().estado;
    let estado: EstadoCatalogo;
    try {
      estado = await s.chamar('catalogo.estado', {});
    } catch (e) {
      // o aviso já saiu; a tela mostra o motivo e o botão de tentar de novo
      estado = { fase: 'erro', itens: 0, mensagem: mensagemDeBaixa(e) };
    }
    store.setState({ estado });
    if (ANDANDO.includes(estado.fase)) depois();
    else if (estado.fase === 'pronto' && antes && antes.fase !== 'pronto') aoChegar();
  }
  return {
    store,
    olhar,
    tentarDeNovo() {
      store.setState({ estado: { fase: 'baixando', itens: 0 } });
      // a resposta só vem no fim (minutos); o andamento vem do olhar. Se falhar, o olhar mostra o motivo.
      void s
        .chamar('catalogo.atualizar', { fonte: 'gutenberg' })
        .catch(() => undefined)
        .finally(() => void olhar());
      depois();
    },
    parar: () => clearTimeout(relogio),
  };
}

/** "Baixando o catálogo do Gutenberg… 12.000 livros": o que dizer em cada fase (nada quando está pronto). */
export function fraseDoCatalogo(e: EstadoCatalogo): string {
  const mb = (b: number) => (b / 1_048_576).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  switch (e.fase) {
    case 'pronto':
      return '';
    case 'baixando':
      if (e.bytes && e.total)
        return `Baixando o catálogo do Gutenberg… ${Math.min(100, Math.floor((e.bytes / e.total) * 100))}% (${mb(e.bytes)} de ${mb(e.total)} MB)`;
      return e.bytes ? `Baixando o catálogo do Gutenberg… ${mb(e.bytes)} MB` : 'Baixando o catálogo do Gutenberg…';
    case 'importando':
      return `Baixando o catálogo do Gutenberg… ${e.itens.toLocaleString('pt-BR')} livros`;
    case 'sem-rede':
      return 'A internet está desligada, então o catálogo do Gutenberg não foi baixado. Pra ligar: Ajustes → Internet.';
    case 'erro':
      return `O catálogo do Gutenberg não baixou. ${e.mensagem ?? ''}`.trim();
    case 'vazio':
      return 'O catálogo do Gutenberg ainda não foi baixado.';
  }
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
