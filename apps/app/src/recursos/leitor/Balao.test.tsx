// @vitest-environment jsdom
import { CORES_PADRAO, bibliotecaDeExemplo } from '@fierium/cliente';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGORA } from '../../testes/apoio';
import { Balao } from './Balao';

afterEach(cleanup);
const caixa = { x: 300, y: 300, largura: 40, altura: 20 };
const fns = () => ({ aoEscolherCor: vi.fn(), aoSalvarNota: vi.fn(), aoApagar: vi.fn(), aoFechar: vi.fn() });

describe('balão de marcação', () => {
  it('seleção nova: só as cores; escolher a cor marca', () => {
    const f = fns();
    render(<Balao caixa={caixa} cores={CORES_PADRAO} marcacao={null} largura={1000} {...f} />);
    expect(screen.queryByLabelText('Nota da marcação')).toBeNull();
    fireEvent.click(screen.getByText('Dúvida'));
    expect(f.aoEscolherCor).toHaveBeenCalledWith('duvida');
  });
  it('marcação existente: mostra a cor atual, edita a nota e apaga', () => {
    const f = fns();
    const m = bibliotecaDeExemplo(AGORA).marcacoes.find((x) => x.nota)!;
    render(<Balao caixa={caixa} cores={CORES_PADRAO} marcacao={m} largura={1000} {...f} />);
    expect(
      screen
        .getByText(CORES_PADRAO.find((c) => c.id === m.cor)!.nome)
        .closest('button')!
        .getAttribute('aria-pressed'),
    ).toBe('true');
    const campo = screen.getByLabelText('Nota da marcação') as HTMLTextAreaElement;
    expect(campo.value).toBe(m.nota);
    fireEvent.change(campo, { target: { value: 'nova nota' } });
    fireEvent.click(screen.getByText('Pronto'));
    expect(f.aoSalvarNota).toHaveBeenCalledWith('nova nota');
    fireEvent.click(screen.getByText('Apagar'));
    expect(f.aoApagar).toHaveBeenCalled();
  });
});
