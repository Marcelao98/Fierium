// Interação do PDF: zoom (Ctrl + roda, Ctrl +/−/0), seleção de texto, clique numa marcação, toque e o menu de contexto.
import { disposicao, posicaoAtual, rolarPara } from './layout';
import { lerSelecao, marcaEm } from './marcacoes';
import { limitarZoom } from './posicao';
import { atualizarJanela } from './render';
import type { Contexto } from './tipos';

const dentroTela = (r: DOMRect, e: MouseEvent) =>
  e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top - 2 && e.clientY <= r.bottom + 2;

/** Liga o zoom e o ponteiro; devolve o que desfazer e o que zera a seleção lembrada (`limparSelecao` da sessão). */
export function ligarInteracao(c: Contexto): { desfazer(): void; limparSelecao(): void } {
  const { rolagem, doc, op } = c;

  // zoom: enquanto muda, os canvas velhos esticam (CSS); redesenha nítido depois de parar
  let temporizadorZoom: ReturnType<typeof setTimeout> | undefined;
  function mudarZoom(novo: number) {
    const z = limitarZoom(novo);
    if (z === c.zoom) return;
    const p = posicaoAtual(c);
    c.zoom = z;
    disposicao(c);
    rolarPara(c, p);
    clearTimeout(temporizadorZoom);
    temporizadorZoom = setTimeout(() => atualizarJanela(c), 250);
  }
  const aoRoda = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    mudarZoom(c.zoom * Math.exp(-e.deltaY * 0.002));
  };
  const aoTeclar = (e: KeyboardEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === '+' || e.key === '=') mudarZoom(c.zoom * 1.15);
    else if (e.key === '-' || e.key === '_') mudarZoom(c.zoom / 1.15);
    else if (e.key === '0') mudarZoom(1);
    else return;
    e.preventDefault();
  };

  // ponteiro: soltar depois de arrastar = seleção de texto; clique sem arrastar = marcação sob o ponto ou toque
  let inicio: { x: number; y: number } | null = null;
  let comSelecao = false;
  const aoApertar = (e: PointerEvent) => {
    if (e.button === 0) inicio = { x: e.clientX, y: e.clientY };
  };
  const aoSoltar = (e: PointerEvent) => {
    if (e.button !== 0) return; // o botão direito abre o menu (abaixo), não é clique nem seleção
    const ini = inicio;
    inicio = null;
    if (!ini) return;
    const clique = Math.hypot(e.clientX - ini.x, e.clientY - ini.y) < 6;
    // o navegador fecha a seleção depois do pointerup (duplo clique, arrastar): lê no tick seguinte
    setTimeout(() => {
      if (c.desmontada) return;
      const sel = lerSelecao(c);
      if (sel) {
        comSelecao = true;
        op.eventos.selecao(sel);
        return;
      }
      if (comSelecao) {
        comSelecao = false;
        op.eventos.selecao(null);
        return;
      }
      if (!clique) return;
      const marca = marcaEm(c, e.clientX, e.clientY);
      if (marca) op.eventos.marcacaoClicada(marca.id, marca.caixa);
      else op.eventos.toque();
    }, 0);
  };
  // botão direito: no lugar do menu do navegador, a casca desenha o dela (com a seleção, a marcação ou a página)
  const aoMenu = (e: MouseEvent) => {
    e.preventDefault();
    const sel = lerSelecao(c);
    const marca = marcaEm(c, e.clientX, e.clientY);
    const pagina = c.paginas.findIndex((p) => {
      const b = p.el.getBoundingClientRect();
      return e.clientY >= b.top && e.clientY <= b.bottom;
    });
    // o clique caiu em cima de uma marcação e a seleção está em outro lugar: vale a marcação
    const naSelecao =
      !!sel && [...(doc.getSelection()?.getRangeAt(0).getClientRects() ?? [])].some((r) => dentroTela(r, e));
    op.eventos.menu?.({
      x: e.clientX,
      y: e.clientY,
      selecao: marca && !naSelecao ? null : sel,
      marcacaoId: marca && !naSelecao ? marca.id : null,
      pagina: pagina >= 0 ? pagina + 1 : undefined,
    });
  };

  rolagem.addEventListener('wheel', aoRoda, { passive: false });
  doc.addEventListener('keydown', aoTeclar);
  rolagem.addEventListener('contextmenu', aoMenu);
  rolagem.addEventListener('pointerdown', aoApertar);
  doc.addEventListener('pointerup', aoSoltar);

  return {
    limparSelecao() {
      comSelecao = false;
      doc.getSelection()?.removeAllRanges();
    },
    desfazer() {
      clearTimeout(temporizadorZoom);
      rolagem.removeEventListener('wheel', aoRoda);
      doc.removeEventListener('keydown', aoTeclar);
      rolagem.removeEventListener('contextmenu', aoMenu);
      rolagem.removeEventListener('pointerdown', aoApertar);
      doc.removeEventListener('pointerup', aoSoltar);
    },
  };
}
