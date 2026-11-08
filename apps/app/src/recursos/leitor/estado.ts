// O que está aberto no leitor: a obra, a fonte (texto ou arquivo), as marcações, a posição e o tempo lido.
// O tempo só conta com a janela visível e a pessoa mexendo nos últimos 2 minutos (regra do KOFlibrary); a casca chama
// `tique()` a cada segundo (os testes chamam na mão).
import type { Ancora, FonteLeitura, Marcacao, Obra } from '@fierium/contratos';
import { createStore } from 'zustand/vanilla';
import type { Servicos } from '../../nucleo/servicos';

export interface EstadoLeitor {
  obra: Obra | null;
  fonte: FonteLeitura | null;
  marcacoes: Marcacao[];
  /** marcação aberta no balão */
  selecionada: string | null;
  fracao: number;
}

const INATIVO_MS = 120_000;

export function criarLeitor(s: Servicos, visivel: () => boolean = () => !document.hidden) {
  const store = createStore<EstadoLeitor>(() => ({
    obra: null,
    fonte: null,
    marcacoes: [],
    selecionada: null,
    fracao: 0,
  }));
  const sessao = { edicaoId: '', segundos: 0, fracaoInicio: 0, fracaoMax: 0, ultimoMovimento: 0 };
  let gravar: ReturnType<typeof setTimeout> | undefined;
  let pendente: (() => Promise<unknown>) | null = null;

  async function abrir(obraId: string, edicaoId: string) {
    store.setState({ obra: null, fonte: null, marcacoes: [], selecionada: null, fracao: 0 });
    const [obra, fonte, marcacoes] = await Promise.all([
      s.chamar('obra.obter', { id: obraId }),
      s.chamar('edicao.abrir', { edicaoId }),
      s.chamar('marcacoes.listar', { obraId }),
    ]);
    const f = obra.edicoes.find((e) => e.id === edicaoId)?.progresso?.fracao ?? 0;
    Object.assign(sessao, { edicaoId, segundos: 0, fracaoInicio: f, fracaoMax: f, ultimoMovimento: s.agora() });
    store.setState({ obra, fonte, marcacoes, fracao: f });
    s.log.registrar('info', 'leitor', `abriu ${obra.titulo}`, { edicaoId, fonte: fonte.tipo });
    return { obra, fonte };
  }

  /** Grava a posição com um atraso curto (rolar não vira cem gravações). */
  function posicaoMudou(posicao: string, fracao: number) {
    sessao.fracaoMax = Math.max(sessao.fracaoMax, fracao);
    store.setState({ fracao });
    clearTimeout(gravar);
    pendente = () => s.chamar('progresso.salvar', { edicaoId: sessao.edicaoId, posicao, fracao });
    gravar = setTimeout(() => {
      const p = pendente;
      pendente = null;
      void p?.().catch(() => undefined);
    }, 800);
  }

  async function fechar() {
    const { obra } = store.getState();
    clearTimeout(gravar);
    if (pendente) await pendente().catch(() => undefined);
    pendente = null;
    if (!obra) return;
    const paginas = obra.edicoes.find((e) => e.id === sessao.edicaoId)?.paginas ?? 0;
    const lidas = Math.max(0, Math.round((sessao.fracaoMax - sessao.fracaoInicio) * paginas));
    if (sessao.segundos >= 5) {
      await s.chamar('sessao.registrar', { edicaoId: sessao.edicaoId, segundos: sessao.segundos, paginas: lidas });
      s.eventos.emitir('sessao-registrada', { obraId: obra.id, segundos: sessao.segundos });
    }
    s.eventos.emitir('obra-mudou', { obraId: obra.id });
    store.setState({ obra: null, fonte: null, marcacoes: [], selecionada: null });
  }

  async function marcar(ancora: Ancora, trecho: string, cor: string) {
    const { obra } = store.getState();
    if (!obra) return null;
    const m = await s.chamar('marcacao.criar', {
      obraId: obra.id,
      edicaoId: sessao.edicaoId,
      tipo: 'destaque',
      ancora,
      trecho,
      cor,
      etiquetas: [],
      ligacoes: [],
    });
    store.setState((e) => ({ marcacoes: [m, ...e.marcacoes], selecionada: m.id }));
    s.eventos.emitir('marcacoes-mudaram', { obraId: obra.id });
    return m;
  }

  async function mudarMarcacao(id: string, m: { cor?: string; nota?: string }) {
    const nova = await s.chamar('marcacao.atualizar', { id, ...m });
    store.setState((e) => ({ marcacoes: e.marcacoes.map((x) => (x.id === id ? nova : x)) }));
    s.eventos.emitir('marcacoes-mudaram', { obraId: nova.obraId });
  }

  async function apagarMarcacao(id: string) {
    const obraId = store.getState().obra?.id ?? '';
    await s.chamar('marcacao.apagar', { id });
    store.setState((e) => ({ marcacoes: e.marcacoes.filter((x) => x.id !== id), selecionada: null }));
    s.eventos.emitir('marcacoes-mudaram', { obraId });
  }

  return {
    store,
    abrir,
    fechar,
    posicaoMudou,
    marcar,
    mudarMarcacao,
    apagarMarcacao,
    selecionar: (id: string | null) => store.setState({ selecionada: id }),
    mexeu: () => void (sessao.ultimoMovimento = s.agora()),
    tique() {
      if (visivel() && s.agora() - sessao.ultimoMovimento < INATIVO_MS) sessao.segundos++;
    },
    /** só pros testes e pro inspetor */
    sessao: () => ({ ...sessao }),
  };
}
export type Leitor = ReturnType<typeof criarLeitor>;
