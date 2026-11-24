// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { linhasVisiveisEpub, pecasComuns } from './pecas';
import { avisarInteracao, type CtxEpub } from './tipos';

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/**
 * Um capítulo de mentira: 3 parágrafos de 20 px, um por "linha" (y = 0, 20, 40). O jsdom não faz layout, então as
 * caixas vêm daqui: cada palavra tem 30 px de largura, na ordem em que aparece no parágrafo.
 */
function contexto() {
  const d = document.implementation.createHTMLDocument('cap');
  const textos = ['Era uma vez', 'um dragão', 'que dormia'];
  textos.forEach((t, i) => {
    const p = d.createElement('p');
    p.textContent = t;
    p.getBoundingClientRect = () => rect(0, i * 20 - topo, 300, 20);
    d.body.append(p);
  });
  let topo = 0;
  const container = document.createElement('div');
  container.getBoundingClientRect = () => rect(0, 100, 300, 45); // enxerga ~2 linhas
  Object.defineProperty(container, 'clientHeight', { value: 45 });
  Object.defineProperty(container, 'scrollHeight', { value: 100 });
  Object.defineProperty(container, 'scrollTop', { get: () => topo, set: (v: number) => void (topo = v) });
  // o "iframe": a posição do documento na tela é (0, 100)
  Object.defineProperty(d, 'defaultView', {
    value: { frameElement: { getBoundingClientRect: () => rect(0, 100, 300, 100) } },
  });
  // o jsdom não tem Range.getClientRects: a palavra fica 30 px à direita da anterior, na altura do parágrafo
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value(this: Range) {
      const p = (this.startContainer.parentElement as HTMLElement).getBoundingClientRect();
      const antes = this.startContainer.textContent!.slice(0, this.startOffset).split(' ').length - 1;
      return [rect(p.left + antes * 30, p.top, 28, 18)];
    },
  });
  const interessados = new Set<() => void>();
  const c = {
    doc: document,
    palco: document.createElement('div'),
    rendition: { manager: { container }, getContents: () => [{ document: d }], next: vi.fn(), prev: vi.fn() },
    book: { spine: { length: 5 } },
    ultimoIndice: 2,
    interessados,
  } as unknown as CtxEpub;
  return { c, container, d };
}

describe('peças comuns do EPUB', () => {
  afterEach(() => Reflect.deleteProperty(Range.prototype, 'getClientRects'));

  it('lê as linhas visíveis do capítulo (uma por parágrafo), com id estável e posição na tela', () => {
    const { c, container } = contexto();
    const ls = linhasVisiveisEpub(c);
    // o documento começa em y=100 na tela e a área visível vai de 100 a 145: o 3º parágrafo (140..160) tem o centro (150) fora
    expect(ls.map((l) => l.texto)).toEqual(['Era uma vez', 'um dragão']);
    expect(ls[0]!.caixa).toEqual({ x: 0, y: 100, largura: 88, altura: 18 });
    expect(ls[0]!.id.startsWith('2:')).toBe(true);
    const idDoSegundo = ls[1]!.id;
    container.scrollTop = 20; // rolou uma linha: a que era a segunda é a primeira, com o mesmo id
    const depois = linhasVisiveisEpub(c);
    expect(depois[0]!.texto).toBe('um dragão');
    expect(depois[0]!.id).toBe(idDoSegundo);
  });

  it('rola por código, diz onde está, vira o capítulo e avisa a interação', () => {
    const { c, container } = contexto();
    const p = pecasComuns(c);
    expect(p.capacidades).toEqual({ paginar: true, linhas: true, rolar: true, destacar: true });
    p.rolarPor!(30);
    expect(container.scrollTop).toBe(30);
    expect(p.rolagem!()).toEqual({ atual: 30, total: 55, area: { x: 0, y: 100, largura: 300, altura: 45 } });
    expect(p.paginaAtual!()).toEqual({ atual: 3, total: 5 });
    p.paginar!(1);
    p.paginar!(-1);
    expect(c.rendition.next).toHaveBeenCalledTimes(1);
    expect(c.rendition.prev).toHaveBeenCalledTimes(1);
    let n = 0;
    const desfaz = p.aoInteragir!(() => n++);
    avisarInteracao(c);
    desfaz();
    avisarInteracao(c);
    expect(n).toBe(1);
    p.desfazerDestaque();
  });

  it('o destaque passageiro vai pro documento do capítulo (rola junto) e some com null', () => {
    const { c, d } = contexto();
    const p = pecasComuns(c);
    p.destacarTrecho!({ caixa: { x: 10, y: 120, largura: 80, altura: 18 } });
    const el = d.body.querySelector<HTMLElement>('.fl-destaque')!;
    expect(el.style.top).toBe('20px'); // 120 (tela) - 100 (topo do iframe)
    expect(el.style.left).toBe('10px');
    p.destacarTrecho!(null);
    expect(d.body.querySelector('.fl-destaque')).toBeNull();
  });
});
