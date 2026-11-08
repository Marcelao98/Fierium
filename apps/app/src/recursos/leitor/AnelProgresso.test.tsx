// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnelProgresso } from './AnelProgresso';

afterEach(cleanup);

describe('anel de progresso do pergaminho', () => {
  it('mostra a porcentagem do livro e o tempo no capítulo', () => {
    render(<AnelProgresso fracao={0.625} segundos={540} />);
    expect(screen.getByText('63%')).toBeTruthy();
    expect(screen.getByText(/9 min no cap\./)).toBeTruthy();
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('63% lido, 9 min no capítulo');
  });
  it('com menos de um minuto, diz "menos de 1 min"', () => {
    render(<AnelProgresso fracao={0} segundos={30} />);
    expect(screen.getByText(/menos de 1 min no cap\./)).toBeTruthy();
  });
  it('o arco acompanha a fração lida', () => {
    const { container } = render(<AnelProgresso fracao={0.5} segundos={120} />);
    const arco = container.querySelector('.anel-arco')!;
    const volta = 2 * Math.PI * Number(arco.getAttribute('r'));
    expect(Number(arco.getAttribute('stroke-dashoffset'))).toBeCloseTo(volta / 2);
  });
});
