// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MOTORES } from '../index';
import { escolherMotor } from '../motor';
import { classificarErro, motorPdf } from './motor-pdf';
import { escalaBase, filtroDoTema, formatarPosicao, lerPosicao, limitarZoom, paginaEm } from './posicao';

const pdf = { tipo: 'arquivo' as const, edicaoId: 'e', formato: 'pdf' as const, url: 'x', tamanho: 10 };

describe('motor de PDF', () => {
  it('aceita só arquivo PDF e vem antes do texto', () => {
    expect(motorPdf.aceita(pdf)).toBe(true);
    expect(motorPdf.aceita({ ...pdf, formato: 'epub' })).toBe(false);
    expect(motorPdf.aceita({ tipo: 'texto', edicaoId: 'e', capitulos: [] })).toBe(false);
    expect(escolherMotor(MOTORES, pdf).nome).toBe('pdf');
  });

  it('formata e lê a posição', () => {
    expect(formatarPosicao({ pagina: 37, fracao: 0.42 })).toBe('37:0.42');
    expect(formatarPosicao({ pagina: 2, fracao: 0 })).toBe('2:0');
    expect(formatarPosicao({ pagina: 2, fracao: 3 })).toBe('2:1');
    expect(lerPosicao('37:0.42')).toEqual({ pagina: 37, fracao: 0.42 });
    expect(lerPosicao('5')).toEqual({ pagina: 5, fracao: 0 });
    expect(lerPosicao('0:0.1')).toBeNull();
    expect(lerPosicao('1:0:0')).toBeNull();
    expect(lerPosicao('abc')).toBeNull();
  });

  it('tema, zoom, escala e página pela rolagem', () => {
    expect(filtroDoTema('noite')).toContain('invert(0.88)');
    expect(filtroDoTema('sepia')).toContain('sepia');
    expect(filtroDoTema('pergaminho')).toContain('sepia');
    expect(filtroDoTema('papel')).toBe('none');
    expect(filtroDoTema('tinta')).toBe('none');
    expect(limitarZoom(100)).toBe(5);
    expect(limitarZoom(0)).toBe(0.4);
    expect(escalaBase(2000, 500)).toBe(2); // máx. 1000 px
    expect(escalaBase(524, 500)).toBe(1);
    const topos = [12, 812, 1612];
    expect(paginaEm(topos, 0)).toBe(0);
    expect(paginaEm(topos, 812)).toBe(1);
    expect(paginaEm(topos, 5000)).toBe(2);
  });

  it('erros têm código estável e mensagem em português', () => {
    expect(classificarErro({ name: 'PasswordException' }).codigo).toBe('PDF_PROTEGIDO');
    const e = classificarErro(new Error('x'));
    expect(e.codigo).toBe('PDF_ILEGIVEL');
    expect(e.mensagem).toContain('PDF');
  });
});
