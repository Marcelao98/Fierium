// Área "coleções".
import { ErroFierium } from '../cliente';
import { novoId } from './dados-exemplo';
import type { Base, Tratadores } from './base';

export const ESCREVEM_COLECOES = ['colecao.criar', 'colecao.definirObras'] as const;

export function comandosColecoes(b: Base): Tratadores<'colecoes.listar' | 'colecao.criar' | 'colecao.definirObras'> {
  return {
    'colecoes.listar': () => b.estado.colecoes,
    'colecao.criar': ({ nome, descricao, matiz }) => {
      if (!nome.trim()) throw new ErroFierium('ARGUMENTO_INVALIDO', 'a coleção precisa de um nome');
      const c = { id: novoId(b.agora()), nome: nome.trim(), descricao, matiz, obraIds: [], criadaEm: b.agora() };
      b.estado.colecoes.push(c);
      return c;
    },
    'colecao.definirObras': ({ id, obraIds }) => {
      const c = b.estado.colecoes.find((x) => x.id === id);
      if (!c) throw new ErroFierium('NAO_ENCONTRADO', `coleção não encontrada: ${id}`);
      c.obraIds = [...new Set(obraIds)];
      for (const o of b.estado.obras) {
        const tem = c.obraIds.includes(o.id);
        o.colecaoIds = tem ? [...new Set([...o.colecaoIds, id])] : o.colecaoIds.filter((x) => x !== id);
      }
      return c;
    },
  };
}
