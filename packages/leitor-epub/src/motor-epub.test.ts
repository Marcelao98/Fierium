// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { escolherMotor, PAGINA_PADRAO } from '@fierium/leitor-base';
import { coresDoEpub, estiloDoCorpo, familiaDe } from './aparencia';
import { dividirCfi, juntarCfi } from './cfi';
import { motorEpub } from './motor-epub';

const arq = (formato: 'epub' | 'pdf') => ({ tipo: 'arquivo' as const, edicaoId: 'e1', formato, url: 'x', tamanho: 1 });

describe('motor de EPUB', () => {
  it('aceita só arquivo EPUB', () => {
    expect(motorEpub.aceita(arq('epub'))).toBe(true);
    expect(motorEpub.aceita(arq('pdf'))).toBe(false);
    expect(motorEpub.aceita({ tipo: 'texto', edicaoId: 'e', capitulos: [] })).toBe(false);
  });
  it('é escolhido pelo formato', () => {
    expect(escolherMotor([motorEpub], arq('epub')).nome).toBe('epub');
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
  it('divide e junta o CFI de um trecho', () => {
    const cfi = 'epubcfi(/6/4!/4/2,/1:0,/1:10)';
    const partes = dividirCfi(cfi)!;
    expect(partes).toEqual({ cfiInicio: 'epubcfi(/6/4!/4/2/1:0)', cfiFim: 'epubcfi(/6/4!/4/2/1:10)' });
    expect(juntarCfi(partes.cfiInicio, partes.cfiFim)).toBe(cfi);
    expect(dividirCfi('epubcfi(/6/4)')).toBeNull();
  });
});
