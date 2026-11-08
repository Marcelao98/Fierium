import { describe, expect, it } from 'vitest';
import { criarClienteMemoria } from './memoria/memoria';
import { criarClienteCombinado, criarClienteTauri } from './tauri';

describe('adaptador Tauri e combinado', () => {
  it('manda o comando pela porta única e traz o erro do Rust com o código', async () => {
    const pedidos: unknown[] = [];
    const c = criarClienteTauri(async (cmd, args) => {
      pedidos.push([cmd, args]);
      if ((args as { cmd: string }).cmd === 'obra.obter')
        throw { codigo: 'NAO_ENCONTRADO', mensagem: 'não encontrado: x' };
      return { versao: '0.2.0', plataforma: 'linux', adaptador: 'tauri' };
    });
    expect(await c.chamar('app.info', {})).toMatchObject({ adaptador: 'tauri' });
    expect(pedidos[0]).toEqual(['chamar', { cmd: 'app.info', args: {} }]);
    await expect(c.chamar('obra.obter', { id: 'x' })).rejects.toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    const quebrado = criarClienteTauri(async () => {
      throw 'IPC fechado';
    });
    await expect(quebrado.chamar('app.info', {})).rejects.toMatchObject({ codigo: 'NUCLEO_SEM_RESPOSTA' });
  });
  it('combinado: o que o Rust já atende vai pro Rust, o resto pro exemplo', async () => {
    const rust = criarClienteTauri(async () => ({ versao: '0.2.0', plataforma: 'linux', adaptador: 'tauri' }));
    const c = criarClienteCombinado(rust, criarClienteMemoria(), new Set(['app.info']));
    expect((await c.chamar('app.info', {})).adaptador).toBe('tauri');
    expect((await c.chamar('obras.listar', {})).length).toBe(40);
  });
});
