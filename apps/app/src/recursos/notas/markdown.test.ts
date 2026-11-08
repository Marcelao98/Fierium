import { bibliotecaDeExemplo } from '@fierium/cliente';
import { describe, expect, it } from 'vitest';
import { AGORA } from '../../testes/apoio';
import { paraMarkdown } from './markdown';

describe('exportar Markdown', () => {
  it('agrupa por obra, com citação, cor, onde está e a nota', () => {
    const ex = bibliotecaDeExemplo(AGORA);
    const md = paraMarkdown(ex.marcacoes, new Map(ex.obras.map((o) => [o.id, o])), (id) => id.toUpperCase());
    expect(md).toContain('## Dom Casmurro — Machado de Assis');
    expect(md).toContain('> O meu fim evidente era atar as duas pontas da vida');
    expect(md).toContain('— *IMPORTANTE* (cap. 2)');
    expect(md).toContain('O livro inteiro está nesta frase.');
    expect(md).toContain('(p. 58)');
  });
});
