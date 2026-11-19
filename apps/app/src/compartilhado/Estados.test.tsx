// @vitest-environment jsdom
import { ErroFierium } from '@fierium/cliente';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detalhesDoErro, ErroDaTela, useCarregar } from './Estados';

afterEach(cleanup);

function Tela({ carregar }: { carregar: () => Promise<unknown> }) {
  const { erro, tentar } = useCarregar(carregar, []);
  return erro ? <ErroDaTela erro={erro} onde="Teste" aoTentar={tentar} /> : <p>carregou</p>;
}

describe('estados da tela', () => {
  it('um erro ao carregar mostra a mensagem do núcleo, o código e "Tentar de novo"', async () => {
    let n = 0;
    const carregar = vi.fn(() =>
      n++ === 0 ? Promise.reject(new ErroFierium('NAO_ENCONTRADO', 'a obra sumiu')) : Promise.resolve(),
    );
    render(<Tela carregar={carregar} />);
    expect(await screen.findByText(/a obra sumiu \(NAO_ENCONTRADO\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByText('carregou')).toBeTruthy());
    expect(carregar).toHaveBeenCalledTimes(2);
  });
  it('"Copiar detalhes" leva tela, código e mensagem', async () => {
    const escrever = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText: escrever } });
    render(<Tela carregar={() => Promise.reject(new ErroFierium('SEM_REDE', 'sem internet'))} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar detalhes' }));
    expect(escrever).toHaveBeenCalledWith('Tela: Teste\nCódigo: SEM_REDE\nMensagem: sem internet');
    expect(detalhesDoErro(new ErroFierium('X', 'y'), 'Z')).toContain('Código: X');
  });
});
