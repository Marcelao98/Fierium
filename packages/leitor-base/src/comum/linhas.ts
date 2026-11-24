// Peças comuns aos motores: juntar pedaços de texto (palavras, trechos) em linhas, e a faixa de destaque passageira.
import type { Caixa, Faixa, Linha } from '../motor';

export interface Pedaco {
  texto: string;
  caixa: Caixa;
  /** posição do pedaço na ordem de leitura do conteúdo inteiro (dá o `id` estável da linha); sem ela vale a ordem de cima pra baixo */
  ordem?: number;
}

/**
 * Agrupa pedaços de texto (cada um com sua caixa na tela) em linhas: pedaços cujo centro vertical cai dentro da mesma
 * faixa viram uma linha, ordenados da esquerda pra direita. O `id` é `${prefixo}${menor ordem do grupo}` (ou o número da linha, de cima pra baixo, se os pedaços não têm `ordem`).
 */
export function agruparLinhas(pedacos: readonly Pedaco[], prefixo = ''): Linha[] {
  // o id vem da menor `ordem` do grupo: não muda quando a rolagem tira ou põe linhas na lista
  const uteis = pedacos.filter((p) => p.texto.trim() && p.caixa.altura > 0);
  const ordenados = [...uteis].sort(
    (a, b) => a.caixa.y + a.caixa.altura / 2 - (b.caixa.y + b.caixa.altura / 2) || a.caixa.x - b.caixa.x,
  );
  const grupos: Pedaco[][] = [];
  let centro = Number.NEGATIVE_INFINITY;
  let altura = 0;
  for (const p of ordenados) {
    const cy = p.caixa.y + p.caixa.altura / 2;
    if (grupos.length && Math.abs(cy - centro) <= Math.min(altura, p.caixa.altura) * 0.6) {
      grupos[grupos.length - 1]!.push(p);
    } else {
      grupos.push([p]);
      centro = cy;
      altura = p.caixa.altura;
    }
  }
  return grupos.map((g, n) => {
    const porX = [...g].sort((a, b) => a.caixa.x - b.caixa.x);
    const x0 = Math.min(...porX.map((p) => p.caixa.x));
    const x1 = Math.max(...porX.map((p) => p.caixa.x + p.caixa.largura));
    const y0 = Math.min(...porX.map((p) => p.caixa.y));
    const y1 = Math.max(...porX.map((p) => p.caixa.y + p.caixa.altura));
    return {
      id: `${prefixo}${Math.min(...g.map((p) => p.ordem ?? n))}`,
      texto: porX
        .map((p) => p.texto)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      caixa: { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 },
    };
  });
}

/** `true` se a caixa aparece (ao menos em parte) dentro da janela retangular `area`. */
export function intersecta(caixa: Caixa, area: Caixa): boolean {
  return (
    caixa.x < area.x + area.largura &&
    caixa.x + caixa.largura > area.x &&
    caixa.y < area.y + area.altura &&
    caixa.y + caixa.altura > area.y
  );
}

/** A faixa de destaque: um elemento absoluto dentro do conteúdo (então rola junto), criado sob demanda. */
export function criarDestaque(doc: Document, pai: HTMLElement, classe = 'fl-destaque') {
  let el: HTMLDivElement | null = null;
  return {
    /** `origem` = a caixa (na tela) do pai, pra converter a faixa pras coordenadas dele */
    mostrar(faixa: Faixa | null, origem: { left: number; top: number }, deslocamento = { x: 0, y: 0 }) {
      if (!faixa) {
        el?.remove();
        el = null;
        return;
      }
      if (!el) {
        el = doc.createElement('div');
        el.className = classe;
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText =
          'position:absolute;pointer-events:none;z-index:3;border-radius:4px;background:rgba(255,214,64,.28);box-shadow:0 0 0 1px rgba(255,190,0,.45);mix-blend-mode:multiply;transition:top .12s ease-out;';
        pai.append(el);
      }
      el.style.left = `${faixa.caixa.x - origem.left + deslocamento.x}px`;
      el.style.top = `${faixa.caixa.y - origem.top + deslocamento.y}px`;
      el.style.width = `${faixa.caixa.largura}px`;
      el.style.height = `${faixa.caixa.altura}px`;
    },
    desfazer() {
      el?.remove();
      el = null;
    },
  };
}
