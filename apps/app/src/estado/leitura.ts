// O que está aberto no leitor: o conteúdo, as marcações desta obra, a posição e o tempo de leitura (sessão).
// O tempo só conta com a janela visível e a pessoa mexendo nos últimos 2 minutos (regra do KOFlibrary).
import type { Ancora, ConteudoDemo, Marcacao, Obra } from '@fierium/contratos';
import { create } from 'zustand';
import { atualizarDepoisDeLer } from './biblioteca';
import { chamar } from './servicos';

interface EstadoLeitura {
  obra: Obra | null;
  conteudo: ConteudoDemo | null;
  marcacoes: Marcacao[];
  /** marcação aberta no balão (editar cor, nota, apagar) */
  selecionada: string | null;
}

export const useLeitura = create<EstadoLeitura>(() => ({
  obra: null,
  conteudo: null,
  marcacoes: [],
  selecionada: null,
}));

const sessao = { edicaoId: '', segundos: 0, fracaoInicio: 0, fracao: 0, ultimoMovimento: 0, relogio: 0 };

export async function abrirConteudo(obraId: string, edicaoId: string) {
  useLeitura.setState({ obra: null, conteudo: null, marcacoes: [], selecionada: null });
  const [obra, conteudo, marcacoes] = await Promise.all([
    chamar('obra.obter', { id: obraId }),
    chamar('leitura.conteudo', { edicaoId }),
    chamar('marcacoes.listar', { obraId }),
  ]);
  useLeitura.setState({ obra, conteudo, marcacoes });
  const f = obra.edicoes.find((e) => e.id === edicaoId)?.progresso?.fracao ?? 0;
  Object.assign(sessao, { edicaoId, segundos: 0, fracaoInicio: f, fracao: f, ultimoMovimento: Date.now() });
  clearInterval(sessao.relogio);
  sessao.relogio = window.setInterval(() => {
    if (!document.hidden && Date.now() - sessao.ultimoMovimento < 120_000) sessao.segundos++;
  }, 1000);
  return obra;
}

export function mexeu() {
  sessao.ultimoMovimento = Date.now();
}

let gravar = 0;
/** Posição atual ("capitulo:paragrafo:0") e fração lida; grava com um atraso curto. */
export function posicaoMudou(edicaoId: string, posicao: string, fracao: number) {
  sessao.fracao = Math.max(sessao.fracao, fracao);
  clearTimeout(gravar);
  gravar = window.setTimeout(() => void chamar('progresso.salvar', { edicaoId, posicao, fracao }), 800);
}

export async function fecharConteudo() {
  clearInterval(sessao.relogio);
  const { obra } = useLeitura.getState();
  if (!obra) return;
  const paginas = obra.edicoes.find((e) => e.id === sessao.edicaoId)?.paginas ?? 0;
  const lidas = Math.max(0, Math.round((sessao.fracao - sessao.fracaoInicio) * paginas));
  if (sessao.segundos >= 5) await chamar('sessao.registrar', { edicaoId: sessao.edicaoId, segundos: sessao.segundos, paginas: lidas });
  await atualizarDepoisDeLer(obra.id);
}

export async function marcar(ancora: Ancora, trecho: string, cor: string) {
  const { obra } = useLeitura.getState();
  if (!obra) return null;
  const m = await chamar('marcacao.criar', {
    obraId: obra.id,
    edicaoId: sessao.edicaoId,
    tipo: 'destaque',
    ancora,
    trecho,
    cor,
    etiquetas: [],
    ligacoes: [],
  });
  useLeitura.setState((s) => ({ marcacoes: [m, ...s.marcacoes], selecionada: m.id }));
  return m;
}

export async function mudarMarcacao(id: string, m: { cor?: string; nota?: string }) {
  const nova = await chamar('marcacao.atualizar', { id, ...m });
  useLeitura.setState((s) => ({ marcacoes: s.marcacoes.map((x) => (x.id === id ? nova : x)) }));
}

export async function apagarMarcacao(id: string) {
  await chamar('marcacao.apagar', { id });
  useLeitura.setState((s) => ({ marcacoes: s.marcacoes.filter((x) => x.id !== id), selecionada: null }));
}

export function selecionarMarcacao(id: string | null) {
  useLeitura.setState({ selecionada: id });
}
