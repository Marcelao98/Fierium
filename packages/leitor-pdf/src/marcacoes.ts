// Marcações do PDF: retângulos coloridos numa camada própria por página (em %, então acompanham o zoom sozinhos),
// o clique sobre elas e a leitura da seleção do navegador como âncora.
import type { Marcacao } from '@fierium/contratos';
import { caixaDe, type Caixa, type Selecao } from '@fierium/leitor-base';
import { dentro, dividirPorPagina, enxugar, juntarPartes, type Parte, type Ret } from './marcas';
import type { Contexto } from './tipos';

export const partesDe = (m: Marcacao): Parte[] =>
  m.ancora.tipo === 'pdf' ? dividirPorPagina(m.ancora.pagina, m.ancora.retangulos as Ret[]) : [];

export function desenharMarcas(c: Contexto): void {
  const e = c.marcas;
  const corDe = (id: string) => e.cores.find((x) => x.id === id)?.cor ?? '#a99be6';
  for (const p of c.paginas) p.marcas?.replaceChildren();
  for (const m of e.marcacoes) {
    for (const { pagina: pg, ret } of partesDe(m)) {
      const p = c.paginas[pg - 1];
      if (!p) continue;
      if (!p.marcas) {
        p.marcas = c.doc.createElement('div');
        p.marcas.className = 'fl-pdf-marcas';
        p.el.append(p.marcas);
      }
      const r = c.doc.createElement('i');
      r.className = 'fl-pdf-marca';
      r.dataset.id = m.id;
      r.dataset.nota = String(!!m.nota);
      r.dataset.selecionada = String(e.selecionada === m.id);
      r.style.cssText = `left:${ret[0] * 100}%;top:${ret[1] * 100}%;width:${ret[2] * 100}%;height:${ret[3] * 100}%;--cor-marca:${corDe(m.cor)}`;
      p.marcas.append(r);
    }
  }
}

/** A marcação sob um ponto da tela, se houver (o clique é resolvido aqui porque a camada de texto fica por cima). */
export function marcaEm(c: Contexto, cx: number, cy: number): { id: string; caixa: Caixa } | null {
  const e = c.marcas;
  for (let i = e.marcacoes.length - 1; i >= 0; i--) {
    const m = e.marcacoes[i]!;
    for (const { pagina: pg, ret } of partesDe(m)) {
      const b = c.paginas[pg - 1]?.el.getBoundingClientRect();
      if (!b?.width) continue;
      if (dentro(ret, (cx - b.left) / b.width, (cy - b.top) / b.height))
        return {
          id: m.id,
          caixa: caixaDe({
            left: b.left + ret[0] * b.width,
            top: b.top + ret[1] * b.height,
            width: ret[2] * b.width,
            height: ret[3] * b.height,
          }),
        };
    }
  }
  return null;
}

/** A seleção atual do navegador como âncora: um retângulo por linha, uma marcação só mesmo cruzando páginas. */
export function lerSelecao(c: Contexto): Selecao | null {
  const s = c.doc.getSelection();
  if (!s || s.isCollapsed || !s.rangeCount) return null;
  const rg = s.getRangeAt(0);
  if (!c.rolagem.contains(rg.commonAncestorContainer)) return null;
  const trecho = s.toString().replace(/\s+/g, ' ').trim();
  if (!trecho) return null;
  const brutos = [...rg.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
  const partes: Parte[] = [];
  let primeiro: DOMRect | null = null;
  c.paginas.forEach((p, i) => {
    if (!p.texto) return;
    const b = p.el.getBoundingClientRect();
    if (!b.width) return;
    const meus = brutos.filter((r) => {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom;
    });
    if (!meus.length) return;
    primeiro ??= meus[0]!;
    const norm = meus.map((r): Ret => [
      (r.left - b.left) / b.width,
      (r.top - b.top) / b.height,
      r.width / b.width,
      r.height / b.height,
    ]);
    for (const ret of enxugar(norm)) partes.push({ pagina: i + 1, ret });
  });
  const ancora = juntarPartes(partes);
  if (!ancora || !primeiro) return null;
  return { ancora: { tipo: 'pdf', ...ancora }, trecho, caixa: caixaDe(primeiro) };
}
