import { describe, expect, it } from 'vitest';
import { MOTORES } from '../index';
import { escolherMotor } from '../motor';
import { estiloDoCorpo, familiaDe, TEMAS_EPUB } from './aparencia';
import { motorEpub } from './motor-epub';

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
  it('mapeia os temas e as medidas', () => {
    expect(TEMAS_EPUB.pergaminho).toEqual({ fundo: '#f1e6c9', texto: '#2b2216' });
    const e = estiloDoCorpo({ fonte: 'inter', tema: 'noite', tamanho: 20, entrelinha: 1.7, largura: 60 });
    expect(e.background).toBe('#12101f');
    expect(e.color).toBe('#ddd6c8');
    expect(e['font-size']).toBe('20px');
    expect(e['line-height']).toBe('1.7');
    expect(e['max-width']).toBe('60ch');
  });
});
