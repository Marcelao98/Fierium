// @vitest-environment jsdom
import { CORES_PADRAO } from '@fierium/cliente';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuContexto, posicionar } from './MenuContexto';
import { itensDoMenu, type AcoesMenu, type CasoMenu, type ItemMenu } from './menuItens';

afterEach(cleanup);

const acoes = (): AcoesMenu => ({
  marcarCor: vi.fn(),
  anotar: vi.fn(),
  salvarCitacao: vi.fn(),
  copiar: vi.fn(),
  copiarCitacao: vi.fn(),
  editarNota: vi.fn(),
  trocarCor: vi.fn(),
  apagar: vi.fn(),
  marcarPagina: vi.fn(),
  abrirNotas: vi.fn(),
  abrirTema: vi.fn(),
  copiarPagina: vi.fn(),
});
const rotulos = (itens: ItemMenu[]) => itens.flatMap((i) => (i.tipo === 'acao' ? [i.rotulo] : []));
const montar = (caso: CasoMenu, formato: 'pdf' | 'epub' | 'texto' = 'pdf', a = acoes()) =>
  itensDoMenu({ caso, cores: CORES_PADRAO, corAtual: 'duvida', formato, acoes: a });

describe('itens do menu', () => {
  it('com texto selecionado: cores, anotar, citação, copiar (sem pesquisa enquanto não houver busca)', () => {
    const itens = montar('selecao');
    expect(itens[0]).toMatchObject({ tipo: 'cores' });
    expect(rotulos(itens)).toEqual(['Anotar…', 'Salvar como citação', 'Copiar', 'Copiar como citação']);
  });
  it('mostra "Pesquisar no livro" só quando existe busca', () => {
    const itens = itensDoMenu({
      caso: 'selecao',
      cores: CORES_PADRAO,
      formato: 'epub',
      acoes: { ...acoes(), pesquisar: vi.fn() },
    });
    expect(rotulos(itens)).toContain('Pesquisar no livro');
  });
  it('em cima de uma marcação: editar, trocar cor, copiar, apagar', () => {
    const itens = montar('marcacao');
    expect(rotulos(itens)).toEqual(['Editar nota', 'Copiar trecho', 'Copiar como citação', 'Apagar marcação']);
    expect(itens.find((i) => i.tipo === 'cores')).toMatchObject({ atual: 'duvida' });
  });
  it('sem seleção: página, notas, tema; o número da página só no PDF', () => {
    expect(rotulos(montar('pagina', 'pdf'))).toEqual([
      'Marcar esta página',
      'Notas deste livro',
      'Tema da página…',
      'Copiar o número da página',
    ]);
    expect(rotulos(montar('pagina', 'epub'))).not.toContain('Copiar o número da página');
  });
});

describe('posição', () => {
  it('cabe: fica onde foi pedido', () => {
    expect(posicionar(100, 100, 200, 150, 1000, 800)).toEqual({ left: 100, top: 100 });
  });
  it('perto da borda: vira pro outro lado e nunca sai da tela', () => {
    expect(posicionar(950, 780, 200, 150, 1000, 800)).toEqual({ left: 750, top: 630 });
    const p = posicionar(5, 5, 400, 900, 300, 300); // maior que a janela: gruda na margem
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.top).toBeGreaterThanOrEqual(8);
  });
});

describe('menu', () => {
  it('é um menu acessível; clicar numa cor e num item chama a ação e Esc fecha', () => {
    const a = acoes();
    const aoFechar = vi.fn();
    render(
      <MenuContexto x={50} y={50} itens={montar('selecao', 'pdf', a)} aoFechar={aoFechar} largura={800} altura={600} />,
    );
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dúvida' }));
    expect(a.marcarCor).toHaveBeenCalledWith('duvida');
    fireEvent.click(screen.getByRole('menuitem', { name: /Salvar como citação/ }));
    expect(a.salvarCitacao).toHaveBeenCalled();
    expect(screen.getByText('Ctrl+C')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(aoFechar).toHaveBeenCalled();
  });
  it('setas movem o foco, dando a volta; começa no primeiro item', () => {
    render(<MenuContexto x={10} y={10} itens={montar('pagina')} aoFechar={vi.fn()} largura={800} altura={600} />);
    const itens = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(itens[0]);
    fireEvent.keyDown(itens[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(itens[1]);
    fireEvent.keyDown(itens[1]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(itens[0]);
    fireEvent.keyDown(itens[0]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(itens[itens.length - 1]);
    fireEvent.keyDown(itens[0]!, { key: 'Home' });
    expect(document.activeElement).toBe(itens[0]);
  });
  it('na fileira de cores as setas laterais andam entre as cores', () => {
    render(<MenuContexto x={10} y={10} itens={montar('selecao')} aoFechar={vi.fn()} largura={800} altura={600} />);
    const cores = screen.getAllByRole('menuitemradio');
    expect(document.activeElement).toBe(cores[0]);
    fireEvent.keyDown(cores[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cores[1]);
  });
});
