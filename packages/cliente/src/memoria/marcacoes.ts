// Área "marcações": destaques, notas e ligações entre trechos.
import type { Marcacao } from '@fierium/contratos';
import { ErroFierium } from '../cliente';
import { novoId } from './dados-exemplo';
import type { Base, Tratadores } from './base';
import { combina } from './normalizar';

export const ESCREVEM_MARCACOES = ['marcacao.criar', 'marcacao.atualizar', 'marcacao.apagar'] as const;

export function comandosMarcacoes(
  b: Base,
): Tratadores<'marcacoes.listar' | 'marcacao.criar' | 'marcacao.atualizar' | 'marcacao.apagar'> {
  return {
    'marcacoes.listar': ({ obraId, cor, texto }) =>
      b.estado.marcacoes
        .filter(
          (m) =>
            (!obraId || m.obraId === obraId) &&
            (!cor || m.cor === cor) &&
            (!texto || combina(texto, m.trecho, m.nota, b.obra(m.obraId).titulo)),
        )
        .sort((x, y) => y.criadaEm - x.criadaEm),
    'marcacao.criar': (a) => {
      b.edicao(a.edicaoId);
      if (!a.trecho.trim() && a.tipo === 'destaque') throw new ErroFierium('ARGUMENTO_INVALIDO', 'marcação sem trecho');
      const m: Marcacao = { ...a, id: novoId(b.agora()), criadaEm: b.agora(), editadaEm: b.agora() };
      b.estado.marcacoes.push(m);
      return m;
    },
    'marcacao.atualizar': ({ id, ...mud }) => {
      const m = b.marcacao(id);
      if (mud.cor !== undefined) m.cor = mud.cor;
      if (mud.nota !== undefined) {
        if (mud.nota.trim()) m.nota = mud.nota;
        else delete m.nota;
      }
      if (mud.etiquetas) m.etiquetas = mud.etiquetas;
      if (mud.ligacoes) m.ligacoes = mud.ligacoes;
      m.editadaEm = b.agora();
      return m;
    },
    'marcacao.apagar': ({ id }) => {
      b.marcacao(id);
      b.estado.marcacoes = b.estado.marcacoes.filter((m) => m.id !== id);
      for (const m of b.estado.marcacoes) m.ligacoes = m.ligacoes.filter((l) => l !== id);
      return null;
    },
  };
}
