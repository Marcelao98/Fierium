// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizarCapitulo } from './sanitizar';

const XHTML = (corpo: string, cabeca = '') =>
  `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Cap</title>${cabeca}</head><body onload="roubar()">${corpo}</body></html>`;
const abrir = (xhtml: string) => new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');

describe('limpeza do capítulo (DOMPurify)', () => {
  it('tira script, on*, javascript: e iframe do livro', () => {
    const d = abrir(
      XHTML(
        '<p onclick="y()" onmouseover="z()">oi</p><a href="javascript:z()">a</a><a href="c2.xhtml">b</a><iframe src="https://mal.example/"></iframe><object data="x.swf"></object><embed src="y"/><form action="https://mal.example/"><input name="a"/></form><svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>alert(1)</script><a xlink:href="javascript:bad()" xmlns:xlink="http://www.w3.org/1999/xlink"><text>t</text></a></svg>',
        '<script>alert(1)</script><script type="text/javascript" src="https://mal.example/x.js"></script><base href="https://mal.example/"/><meta http-equiv="refresh" content="0;url=https://mal.example/"/>',
      ),
    );
    sanitizarCapitulo(d);
    const html = new XMLSerializer().serializeToString(d);
    expect(html).not.toMatch(
      /<script|<iframe|<object|<embed|<form|<base|<meta|onclick|onmouseover|onload|javascript:/i,
    );
    expect(d.querySelectorAll('a')[1]!.getAttribute('href')).toBe('c2.xhtml');
    expect(d.querySelector('p')!.textContent).toBe('oi');
  });

  it('mantém texto, imagens, estilos e notas de rodapé', () => {
    const d = abrir(
      XHTML(
        '<h1 id="t" class="titulo" style="color:red">Capítulo</h1><p>Texto com nota<a href="#n1" id="r1" epub:type="noteref">1</a> e <em>ênfase</em>.</p><img src="img/capa.png" alt="capa"/><figure><img src="fig.jpg" alt=""/><figcaption>Legenda</figcaption></figure><aside id="n1" epub:type="footnote"><p>Nota de rodapé.</p></aside>',
        '<link rel="stylesheet" type="text/css" href="estilo.css"/><link rel="prefetch" href="https://mal.example/"/><style>p { margin: 0 }</style>',
      ),
    );
    sanitizarCapitulo(d);
    expect(d.querySelector('h1')!.textContent).toBe('Capítulo');
    expect(d.querySelector('h1')!.getAttribute('style')).toContain('color');
    expect(d.querySelector('h1')!.getAttribute('class')).toBe('titulo');
    expect(d.querySelectorAll('img')).toHaveLength(2);
    expect(d.querySelector('img')!.getAttribute('src')).toBe('img/capa.png');
    expect(d.querySelector('figcaption')!.textContent).toBe('Legenda');
    const ref = d.querySelector('a[href="#n1"]')!;
    expect(ref.getAttribute('epub:type')).toBe('noteref');
    expect(d.querySelector('aside')!.getAttribute('epub:type')).toBe('footnote');
    expect(d.querySelector('aside')!.getAttribute('id')).toBe('n1');
    expect(d.querySelector('aside p')!.textContent).toBe('Nota de rodapé.');
    expect(d.querySelector('style')!.textContent).toContain('margin');
    const links = d.querySelectorAll('link');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe('estilo.css');
  });
});
