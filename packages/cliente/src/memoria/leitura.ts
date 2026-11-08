// Área "leitura": abrir uma edição, guardar a posição e registrar o tempo lido.
import type { FonteLeitura } from '@fierium/contratos';
import { ErroFierium } from '../cliente';
import { novoId } from './dados-exemplo';
import { autorDe, type Base, type Tratadores } from './base';
import { DOM_CASMURRO, textoDeExemplo } from './texto-demo';

export const ESCREVEM_LEITURA = ['progresso.salvar', 'sessao.registrar'] as const;

export function comandosLeitura(b: Base): Tratadores<'edicao.abrir' | 'progresso.salvar' | 'sessao.registrar'> {
  return {
    // o exemplo só tem texto embutido; o Rust (M3/M4) devolve { tipo: 'arquivo', url } pros arquivos de verdade
    'edicao.abrir': ({ edicaoId }): FonteLeitura => {
      const { o } = b.edicao(edicaoId);
      return {
        tipo: 'texto',
        edicaoId,
        capitulos: o.titulo === 'Dom Casmurro' ? DOM_CASMURRO : textoDeExemplo(o.titulo, autorDe(o)),
      };
    },
    'progresso.salvar': ({ edicaoId, posicao, fracao }) => {
      if (!(fracao >= 0 && fracao <= 1)) throw new ErroFierium('ARGUMENTO_INVALIDO', 'a fração vai de 0 a 1');
      const { o, e } = b.edicao(edicaoId);
      e.progresso = { posicao, fracao, quando: b.agora() };
      o.relacao.ultimaLeitura = b.agora();
      if (o.relacao.estado === 'nao-lida' || o.relacao.estado === 'deixada') o.relacao.estado = 'lendo';
      return null;
    },
    'sessao.registrar': ({ edicaoId, segundos, paginas }) => {
      const { o } = b.edicao(edicaoId);
      if (segundos < 1) return null;
      b.estado.sessoes.push({
        id: novoId(b.agora()),
        obraId: o.id,
        edicaoId,
        inicio: b.agora() - segundos * 1000,
        segundos: Math.round(segundos),
        paginas,
        aparelho: 'navegador',
      });
      return null;
    },
  };
}
