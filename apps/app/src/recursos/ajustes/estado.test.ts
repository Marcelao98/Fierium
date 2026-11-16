import { describe, expect, it } from 'vitest';
import { servicosDeTeste } from '../../testes/apoio';
import { criarPastas } from './estado';

describe('pastas (estado)', () => {
  it('adicionar já varre e avisa a biblioteca; remover tira da lista', async () => {
    const { s } = servicosDeTeste();
    let mudou = 0;
    s.eventos.ouvir('biblioteca-mudou', () => mudou++);
    const p = criarPastas(s);
    expect(await p.adicionar('/home/x/Livros')).toBe(true);
    expect(p.store.getState().pastas.map((x) => x.caminho)).toEqual(['/home/x/Livros']);
    expect(p.store.getState().resultado).toMatchObject({ total: 0 });
    expect(p.store.getState().varrendo).toBe(false);
    expect(mudou).toBe(1);
    await p.remover('/home/x/Livros');
    expect(p.store.getState().pastas).toEqual([]);
  });
  it('caminho inválido mostra o erro em português e não varre', async () => {
    const { s, avisos } = servicosDeTeste();
    const p = criarPastas(s);
    expect(await p.adicionar('livros')).toBe(false);
    expect(p.store.getState().erro).toContain('não é um caminho');
    expect(p.store.getState().resultado).toBeNull();
    expect(avisos).toHaveLength(1);
  });
  it('escolher usa o seletor injetado e adiciona cada pasta; sem seletor não faz nada', async () => {
    const { s } = servicosDeTeste();
    const sem = criarPastas(s);
    expect(sem.podeEscolher).toBe(false);
    await sem.escolher();
    expect(sem.store.getState().pastas).toEqual([]);

    const { s: s2 } = servicosDeTeste();
    s2.escolherPastas = async () => ['/home/x/Livros', '/home/x/Books'];
    const p = criarPastas(s2);
    expect(p.podeEscolher).toBe(true);
    await p.escolher();
    expect(p.store.getState().pastas.map((x) => x.caminho)).toEqual(['/home/x/Livros', '/home/x/Books']);
  });
  it('cancelar o seletor (lista vazia) não muda nada', async () => {
    const { s } = servicosDeTeste();
    s.escolherPastas = async () => [];
    const p = criarPastas(s);
    await p.escolher();
    expect(p.store.getState().pastas).toEqual([]);
  });
});
