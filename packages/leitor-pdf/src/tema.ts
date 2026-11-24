// O tema da página no PDF: o pintor (a partir dos pixels crus do pdf.js) e o fundo em volta das páginas.
import type { ConfigLeitura } from '@fierium/contratos';
import { criarPintor, parametrosDaPagina, rgbParaHex } from '@fierium/leitor-base';
import { pintar } from './render';
import type { Contexto } from './tipos';

/** O fundo em volta das páginas: o papel um tom mais escuro. */
export function fundoAoRedor(papel: { r: number; g: number; b: number }, escuro: boolean): string {
  const f = escuro ? 0.7 : 0.88;
  return rgbParaHex({ r: papel.r * f, g: papel.g * f, b: papel.b * f });
}

export function aplicarTema(c: Contexto, a: ConfigLeitura): void {
  c.aparencia = a;
  const params = parametrosDaPagina(a.pagina, a.temasMeus);
  const chave = JSON.stringify(params);
  if (chave === c.chavePintor) return;
  c.chavePintor = chave;
  c.pintor = criarPintor(params);
  const papel = rgbParaHex(c.pintor.papel);
  c.rolagem.dataset['tema'] = a.pagina.tema;
  c.rolagem.style.background = fundoAoRedor(c.pintor.papel, c.pintor.escuro);
  for (const p of c.paginas) {
    p.el.style.background = papel;
    pintar(c, p);
  }
}
