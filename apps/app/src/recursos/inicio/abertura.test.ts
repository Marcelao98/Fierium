import { describe, expect, it } from 'vitest';
import { servicosDeTeste } from '../../testes/apoio';
import { criarAbertura, QUANTOS_CLASSICOS } from './abertura';

describe('abertura (estado)', () => {
  it('começa nas boas-vindas e anda pelos passos', () => {
    const a = criarAbertura(servicosDeTeste().s);
    expect(a.store.getState().passo).toBe('boas-vindas');
    a.irPara('pasta');
    expect(a.store.getState().passo).toBe('pasta');
  });
  it('o andamento sugere até 3 clássicos do catálogo, sem repetir', async () => {
    const a = criarAbertura(servicosDeTeste().s);
    a.comecarAndamento();
    await a.buscarClassicos();
    await new Promise((r) => setTimeout(r, 0));
    const { classicos, buscou, passo } = a.store.getState();
    a.parar();
    expect(passo).toBe('andamento');
    expect(buscou).toBe(true);
    expect(classicos.length).toBeGreaterThan(0);
    expect(classicos.length).toBeLessThanOrEqual(QUANTOS_CLASSICOS);
    expect(new Set(classicos.map((i) => i.id)).size).toBe(classicos.length);
  });
  it('usar uma pasta vai pro andamento, varre e conta os livros', async () => {
    const { s } = servicosDeTeste();
    let mudou = 0;
    s.eventos.ouvir('biblioteca-mudou', () => mudou++);
    const a = criarAbertura(s);
    await a.usarPastas(['/home/x/Livros']);
    a.parar();
    const e = a.store.getState();
    expect(e).toMatchObject({ passo: 'andamento', usouPasta: true, varrendo: false, livros: 0, erroPasta: null });
    expect(mudou).toBe(1);
  });
  it('pasta inválida mostra o motivo em português e não deixa a tela esperando', async () => {
    const { s } = servicosDeTeste();
    const a = criarAbertura(s);
    await a.usarPastas(['livros']);
    a.parar();
    expect(a.store.getState().erroPasta).toContain('não é um caminho');
    expect(a.store.getState().varrendo).toBe(false);
  });
  it('sem pastas escolhidas nada muda', async () => {
    const a = criarAbertura(servicosDeTeste().s);
    await a.usarPastas([]);
    expect(a.store.getState().passo).toBe('boas-vindas');
  });
});
