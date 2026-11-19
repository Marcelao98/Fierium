// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { avisar, useAvisos } from '../nucleo/avisos';
import { Avisos } from './Avisos';

afterEach(() => {
  cleanup();
  useAvisos.setState({ lista: [] });
});

describe('avisos', () => {
  it('aviso de erro com detalhes tem "Copiar detalhes"; sem detalhes, não', () => {
    const escrever = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText: escrever } });
    render(<Avisos />);
    act(() => avisar('Falhou (X)', 'erro', 'Comando: a.b\nCódigo: X'));
    act(() => avisar('Tudo certo'));
    expect(screen.getAllByRole('button', { name: 'Copiar detalhes' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar detalhes' }));
    expect(escrever).toHaveBeenCalledWith('Comando: a.b\nCódigo: X');
  });
});
