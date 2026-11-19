import { describe, expect, it } from 'vitest';
import { ajustarTexto, estilosDoCartao, nomeDoArquivo, quebrarLinhas } from './cartaoCitacao';

// medir falso: cada letra tem 10 px (o canvas de verdade só existe no navegador; o e2e confere o PNG)
const medir = (t: string) => t.length * 10;

describe('cartão de citação', () => {
  it('quebra em linhas que cabem na largura', () => {
    expect(quebrarLinhas(medir, 'uma duas tres quatro', 90)).toEqual(['uma duas', 'tres', 'quatro']);
    expect(quebrarLinhas(medir, '', 90)).toEqual([]);
  });
  it('palavra maior que a largura fica sozinha numa linha', () => {
    expect(quebrarLinhas(medir, 'a supercalifragilistico b', 50)).toEqual(['a', 'supercalifragilistico', 'b']);
  });
  it('os três estilos: o da página, o Céu antigo e o Pergaminho', () => {
    const e = estilosDoCartao({ papel: '#101010', tinta: '#eeeeee', nome: 'Noite' });
    expect(e.map((x) => x.id)).toEqual(['pagina', 'ceu', 'pergaminho']);
    expect(e[0]).toMatchObject({ papel: '#101010', tinta: '#eeeeee', nome: 'Da página (Noite)' });
    expect(estilosDoCartao({ papel: '#fff', tinta: '#000' })[0]!.nome).toBe('Da página');
  });
  it('texto curto usa o maior corpo; texto enorme encolhe e, no mínimo, corta com reticências', () => {
    const ctx = { font: '', measureText: (t: string) => ({ width: medir(t) }) } as unknown as CanvasRenderingContext2D;
    const curto = ajustarTexto(ctx, 'Capitu', 800, 600);
    expect(curto.corpo).toBe(78);
    const enorme = ajustarTexto(ctx, 'palavra '.repeat(2000), 800, 600);
    expect(enorme.corpo).toBe(34);
    expect(enorme.linhas.at(-1)!.endsWith('…')).toBe(true);
    expect(enorme.linhas.length * enorme.entrelinha).toBeLessThanOrEqual(600);
  });
  it('nome do arquivo sem acento nem símbolo', () => {
    expect(nomeDoArquivo('Memórias Póstumas de Brás Cubas')).toBe('citacao-memorias-postumas-de-bras-cubas.png');
    expect(nomeDoArquivo('')).toBe('citacao.png');
  });
});
