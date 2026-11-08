import { describe, expect, it } from 'vitest';
import { servicosDeTeste } from '../testes/apoio';

describe('serviços', () => {
  it('erro do núcleo vira aviso com código, vai pro log e rejeita com ErroFierium', async () => {
    const { s, avisos } = servicosDeTeste();
    const e = await s.chamar('obra.obter', { id: 'nao-existe' }).catch((x: unknown) => x);
    expect(e).toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    expect(avisos[0]?.tipo).toBe('erro');
    expect(avisos[0]?.texto).toContain('NAO_ENCONTRADO');
    expect(s.log.recentes().some((r) => r.nivel === 'erro' && r.origem === 'comando')).toBe(true);
  });
  it('eventos chegam em quem ouve e param quando para de ouvir', () => {
    const { s } = servicosDeTeste();
    const vistos: string[] = [];
    const parar = s.eventos.ouvir('obra-mudou', (d) => vistos.push(d.obraId));
    s.eventos.emitir('obra-mudou', { obraId: 'a' });
    parar();
    s.eventos.emitir('obra-mudou', { obraId: 'b' });
    expect(vistos).toEqual(['a']);
  });
});
