// A posição de leitura que o motor entrega → a âncora de um marcador de página (sem trecho).
import type { Ancora } from '@fierium/contratos';
import type { Caixa, Selecao } from '@fierium/leitor-base';

/** O balão de marcação: onde abrir, a seleção nova (ou a marcação existente) e se o campo da nota pega o foco. */
export type EstadoBalao = { caixa: Caixa; nova: Selecao | null; marcacaoId: string | null; focar?: boolean };

export function ancoraDaPosicao(formato: string, posicao: string): Ancora | null {
  if (!posicao) return null;
  if (formato === 'pdf') {
    const pagina = Number(posicao.split(':')[0]);
    return Number.isInteger(pagina) && pagina >= 1 ? { tipo: 'pdf', pagina, retangulos: [] } : null;
  }
  if (formato === 'epub') return { tipo: 'epub', cfiInicio: posicao, cfiFim: posicao };
  const [capitulo, paragrafo] = posicao.split(':').map(Number);
  return Number.isInteger(capitulo) && Number.isInteger(paragrafo)
    ? { tipo: 'texto', capitulo: capitulo!, paragrafo: paragrafo!, inicio: 0, fim: 0 }
    : null;
}
