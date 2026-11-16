// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MOTORES } from '../index';
import { escolherMotor } from '../motor';
import { coresDoEpub, estiloDoCorpo, familiaDe } from './aparencia';
import { PAGINA_PADRAO } from '../pintor/pintor';
import { motorEpub, tirarScripts } from './motor-epub';

const arq = (formato: 'epub' | 'pdf') => ({ tipo: 'arquivo' as const, edicaoId: 'e1', formato, url: 'x', tamanho: 1 });

describe('motor de EPUB', () => {
  it('aceita só arquivo EPUB', () => {
    expect(motorEpub.aceita(arq('epub'))).toBe(true);
    expect(motorEpub.aceita(arq('pdf'))).toBe(false);
    expect(motorEpub.aceita({ tipo: 'texto', edicaoId: 'e', capitulos: [] })).toBe(false);
  });
  it('está registrado antes do de texto', () => {
    expect(escolherMotor(MOTORES, arq('epub')).nome).toBe('epub');
  });
  it('mapeia as fontes', () => {
    expect(familiaDe('literata')).toContain('Literata Variable');
    expect(familiaDe('inter')).toContain('Inter Variable');
    expect(familiaDe('fraunces')).toContain('Cormorant Garamond Variable');
    expect(familiaDe('cormorant')).toContain('Cormorant Garamond Variable');
  });
  it('mapeia o tema da página e as medidas', () => {
    const base = { fonte: 'inter' as const, tema: 'pergaminho' as const, tamanho: 20, entrelinha: 1.7, largura: 60 };
    const noite = { ...base, pagina: { ...PAGINA_PADRAO, tema: 'noite' }, temasMeus: [] };
    const e = estiloDoCorpo(noite);
    expect(e.background).toBe('#141414');
    expect(e.color).toBe('#d6d6d6');
    expect(e['font-size']).toBe('20px');
    expect(e['line-height']).toBe('1.7');
    expect(e['max-width']).toBe('60ch');
  });
  it('cores livres, "meus temas" e luz quente', () => {
    const base = { fonte: 'inter' as const, tema: 'noite' as const, tamanho: 20, entrelinha: 1.7, largura: 60 };
    const livre = { ...PAGINA_PADRAO, tema: 'personalizado', papel: '#102030', tinta: '#f0e0c0' };
    expect(coresDoEpub({ ...base, pagina: livre, temasMeus: [] })).toEqual({ fundo: '#102030', texto: '#f0e0c0' });
    const meu = { id: 'meu-1', nome: 'X', papel: '#ffffff', tinta: '#000000' };
    expect(coresDoEpub({ ...base, pagina: { ...PAGINA_PADRAO, tema: 'meu-1' }, temasMeus: [meu] })).toEqual({
      fundo: '#ffffff',
      texto: '#000000',
    });
    const quente = coresDoEpub({ ...base, pagina: { ...PAGINA_PADRAO, tema: 'meu-1', quente: 100 }, temasMeus: [meu] });
    expect(quente.fundo).not.toBe('#ffffff');
  });
  it('arranca os scripts do livro antes de montar o capítulo', () => {
    const d = document.implementation.createHTMLDocument('capítulo');
    d.head.innerHTML = '<script>alert(1)</script>';
    d.body.setAttribute('onload', 'x()');
    d.body.innerHTML =
      '<p onclick="y()">oi</p><a href="javascript:z()">a</a><a href="c2.xhtml">b</a><img src="capa.png"/>';
    tirarScripts(d);
    expect(d.querySelector('script')).toBeNull();
    expect(d.body.hasAttribute('onload')).toBe(false);
    expect(d.querySelector('p')!.hasAttribute('onclick')).toBe(false);
    expect(d.querySelectorAll('a')[0]!.hasAttribute('href')).toBe(false);
    expect(d.querySelectorAll('a')[1]!.getAttribute('href')).toBe('c2.xhtml');
    expect(d.querySelector('img')!.getAttribute('src')).toBe('capa.png');
    expect(d.querySelector('p')!.textContent).toBe('oi');
  });
});
