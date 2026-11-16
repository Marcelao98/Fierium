import { bibliotecaDeExemplo } from '@fierium/cliente';
import { describe, expect, it } from 'vitest';
import { AGORA } from '../../testes/apoio';
import { agrupar, citacao, filtrar, semAcento } from './citacao';

const ex = bibliotecaDeExemplo(AGORA);
const obras = new Map(ex.obras.map((o) => [o.id, o]));

describe('citações e filtros', () => {
  it('formata a citação simples e a ABNT', () => {
    const m = ex.marcacoes.find((x) => x.trecho.startsWith('O amor'))!;
    const o = obras.get(m.obraId);
    const autor = o!.criadores[0]!.nome;
    expect(citacao(m, o, 'simples')).toBe(`“${m.trecho}” — ${autor}, *O Banquete*, p. 77`);
    expect(citacao(m, o, 'abnt')).toMatch(/^“O amor.*” \([A-ZÀ-Ú ]+.*\. O Banquete\. p\. 77\)$/);
  });
  it('capítulo no texto corrido', () => {
    const m = ex.marcacoes.find((x) => x.trecho.startsWith('Há livros'))!;
    expect(citacao(m, obras.get(m.obraId), 'simples')).toMatch(/Machado de Assis, \*Dom Casmurro\*, cap\. 1$/);
  });
  it('busca sem acento e agrupa pela posição no livro', () => {
    expect(semAcento('Dúvida')).toBe('duvida');
    expect(filtrar(ex.marcacoes, { texto: 'ironía' }, obras).length).toBeGreaterThan(0);
    const g = agrupar(ex.marcacoes, obras).find((x) => x.obra?.titulo === 'Dom Casmurro')!;
    const caps = g.marcacoes.map((m) => (m.ancora.tipo === 'texto' ? m.ancora.capitulo : -1));
    expect(caps).toEqual([...caps].sort((a, b) => a - b));
  });
});
