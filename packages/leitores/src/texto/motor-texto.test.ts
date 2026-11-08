// @vitest-environment jsdom
import type { Marcacao } from '@fierium/contratos';
import { describe, expect, it, vi } from 'vitest';
import { escolherMotor, ErroLeitor, type EventosMotor } from '../motor';
import { deslocamento, motorTexto, pedacos } from './motor-texto';

const marca = (id: string, inicio: number, fim: number, paragrafo = 0): Marcacao => ({
  id,
  obraId: 'o',
  edicaoId: 'e',
  tipo: 'destaque',
  ancora: { tipo: 'texto', capitulo: 0, paragrafo, inicio, fim },
  trecho: '',
  cor: 'ideia',
  etiquetas: [],
  ligacoes: [],
  criadaEm: 0,
  editadaEm: 0,
});

const eventos = (): EventosMotor => ({
  posicao: vi.fn(),
  selecao: vi.fn(),
  marcacaoClicada: vi.fn(),
  toque: vi.fn(),
  erro: vi.fn(),
});

const fonte = {
  tipo: 'texto' as const,
  edicaoId: 'e',
  capitulos: [{ titulo: 'I', paragrafos: ['Uma noite destas, vindo da cidade.', 'Segundo parágrafo.'] }],
};
const aparencia = { fonte: 'literata' as const, tamanho: 20, entrelinha: 1.7, largura: 66, tema: 'noite' as const };

describe('motor de texto', () => {
  it('pedaços: marcação sobreposta não duplica texto', () => {
    const p = pedacos('abcdefghij', [marca('a', 2, 6), marca('b', 4, 8)]);
    expect(p.map((x) => x.texto).join('')).toBe('abcdefghij');
    expect(p.map((x) => ('marca' in x ? x.marca.id : '-'))).toEqual(['-', 'a', 'b', '-']);
  });

  it('desenha as marcações e avisa o clique nelas', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const ev = eventos();
    const s = await motorTexto.montar(el, {
      fonte,
      aparencia,
      marcacoes: [marca('m1', 0, 10)],
      cores: [],
      eventos: ev,
    });
    const mk = el.querySelector('mark[data-id="m1"]')!;
    expect(mk.textContent).toBe('Uma noite ');
    (mk as HTMLElement).click();
    expect(ev.marcacaoClicada).toHaveBeenCalledWith('m1', expect.any(Object));
    el.querySelectorAll('p')[1]!.click();
    expect(ev.toque).toHaveBeenCalled();
    s.mostrarMarcacoes([], []);
    expect(el.querySelector('mark')).toBeNull();
    s.desmontar();
    expect(el.children).toHaveLength(0);
  });

  it('o deslocamento conta o texto antes da seleção, atravessando marcações', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    await motorTexto.montar(el, { fonte, aparencia, marcacoes: [marca('m', 4, 9)], cores: [], eventos: eventos() });
    const p = el.querySelector('p[data-par="0"]')!;
    const depois = p.lastChild!; // o texto depois da marcação
    expect(deslocamento(p, depois, 2)).toBe(11);
  });

  it('formato sem motor dá erro com código', () => {
    expect(() =>
      escolherMotor([motorTexto], { tipo: 'arquivo', edicaoId: 'e', formato: 'cbr', url: '', tamanho: 0 }),
    ).toThrow(ErroLeitor);
  });
});
