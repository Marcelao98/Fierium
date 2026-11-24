// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { disposicao } from './layout';
import { aoInteragirPdf, linhasVisiveis, paginaDe, paginarPdf, pecasComuns, rolagemDe } from './pecas';
import type { Contexto, Pagina } from './tipos';

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

/** um contexto de mentira: 3 páginas de 100x200, a área visível tem 250 px de altura, começa em y=50 da tela */
function contexto() {
  const rolagem = document.createElement('div');
  const lista = document.createElement('div');
  rolagem.append(lista);
  document.body.append(rolagem);
  let topo = 0;
  Object.defineProperty(rolagem, 'clientHeight', { value: 250 });
  Object.defineProperty(rolagem, 'scrollHeight', { value: 700 });
  rolagem.getBoundingClientRect = () => rect(0, 50, 400, 250);
  lista.getBoundingClientRect = () => rect(0, 50 - topo, 400, 700);
  Object.defineProperty(rolagem, 'scrollTop', { get: () => topo, set: (v: number) => void (topo = v) });
  const paginas: Pagina[] = [];
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div');
    const texto = document.createElement('div');
    // duas linhas por página: y = 10 e 40 dentro da página (a página começa em 12 + i*212 da lista)
    const itens = [
      ['Era uma vez', 10],
      ['um dragão', 10],
      ['que dormia', 40],
    ] as const;
    itens.forEach(([t, y], k) => {
      const s = document.createElement('span');
      s.textContent = t;
      s.getBoundingClientRect = () => rect(10 + (k === 1 ? 100 : 0), 50 - topo + 12 + i * 212 + y, 80, 16);
      texto.append(s);
    });
    el.getBoundingClientRect = () => rect(0, 50 - topo + 12 + i * 212, 100, 200);
    lista.append(el);
    paginas.push({ el, w: 100, h: 200, texto } as unknown as Pagina);
  }
  const c = {
    doc: document,
    rolagem,
    lista,
    paginas,
    n: 3,
    zoom: 1,
    base: 1,
    topos: [12, 224, 436],
    cache: new Map(),
    visiveis: new Set(),
    desmontada: false,
  } as unknown as Contexto;
  disposicao(c);
  return c;
}

describe('peças comuns do PDF', () => {
  it('lê as linhas visíveis pela camada de texto, juntando itens da mesma linha, com id estável', () => {
    const c = contexto();
    const ls = linhasVisiveis(c);
    // a área vai de y=50 a 300: a página 1 inteira (62..262) e a de 2 começa em 274 (a linha 1 dela está dentro)
    expect(ls.map((l) => l.texto)).toEqual(['Era uma vez um dragão', 'que dormia', 'Era uma vez um dragão']);
    expect(ls[0]!.id).toBe('1:0');
    expect(ls[1]!.id).toBe('1:2');
    expect(ls[2]!.id).toBe('2:0');
    expect(ls[0]!.caixa.x).toBe(10);
    // rolando, a linha que continua visível mantém o id
    c.rolagem.scrollTop = 30;
    const depois = linhasVisiveis(c);
    expect(depois.find((l) => l.texto === 'que dormia')?.id).toBe('1:2');
  });

  it('rola por código, diz onde está e a área visível', () => {
    const c = contexto();
    const p = pecasComuns(c);
    expect(p.capacidades).toEqual({ paginar: true, linhas: true, rolar: true, destacar: true });
    p.rolarPor!(40);
    p.rolarPor!(-10);
    expect(c.rolagem.scrollTop).toBe(30);
    expect(rolagemDe(c)).toEqual({ atual: 30, total: 450, area: { x: 0, y: 50, largura: 400, altura: 250 } });
    p.desfazerDestaque();
  });

  it('vira a página e diz a página atual', () => {
    const c = contexto();
    expect(paginaDe(c)).toEqual({ atual: 1, total: 3 });
    paginarPdf(c, 1);
    expect(c.rolagem.scrollTop).toBe(224);
    expect(paginaDe(c).atual).toBe(2);
    c.rolagem.scrollTop = 224 + 50; // no meio da página 2
    paginarPdf(c, -1);
    expect(c.rolagem.scrollTop).toBe(224); // volta ao começo da própria página
    paginarPdf(c, -1);
    expect(c.rolagem.scrollTop).toBe(12);
    paginarPdf(c, -1);
    expect(c.rolagem.scrollTop).toBe(12); // não passa da primeira
  });

  it('avisa quando a pessoa mexe, e deixa de avisar ao desfazer', () => {
    const c = contexto();
    let n = 0;
    const desfaz = aoInteragirPdf(c, () => n++);
    c.rolagem.dispatchEvent(new Event('wheel'));
    c.rolagem.dispatchEvent(new Event('pointerdown'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(n).toBe(3);
    c.rolagem.scrollTop = 99; // rolar por código não avisa
    expect(n).toBe(3);
    desfaz();
    c.rolagem.dispatchEvent(new Event('wheel'));
    expect(n).toBe(3);
  });

  it('o destaque passageiro fica dentro do conteúdo e some com null', () => {
    const c = contexto();
    const p = pecasComuns(c);
    p.destacarTrecho!({ caixa: { x: 20, y: 100, largura: 50, altura: 16 } });
    const el = c.lista.querySelector<HTMLElement>('.fl-destaque')!;
    expect(el.style.top).toBe('50px'); // 100 (tela) - 50 (topo da lista na tela)
    expect(el.style.left).toBe('20px');
    p.destacarTrecho!(null);
    expect(c.lista.querySelector('.fl-destaque')).toBeNull();
  });
});
