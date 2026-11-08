import { describe, expect, it } from 'vitest';
import { criarLog, relatorio, textoDoErro } from './index';

describe('log', () => {
  it('guarda só os últimos N, em ordem, e avisa quem assinou', () => {
    const vistos: string[] = [];
    const log = criarLog({ max: 3, agora: () => 1 });
    const parar = log.assinar((r) => vistos.push(r.mensagem));
    for (const m of ['a', 'b', 'c', 'd']) log.registrar('info', 'teste', m);
    parar();
    log.registrar('info', 'teste', 'e');
    expect(log.recentes().map((r) => r.mensagem)).toEqual(['c', 'd', 'e']);
    expect(log.recentes().map((r) => r.n)).toEqual([3, 4, 5]);
    expect(vistos).toEqual(['a', 'b', 'c', 'd']);
  });
  it('uma saída com defeito não derruba o log', () => {
    const log = criarLog({
      saidas: [
        () => {
          throw new Error('disco cheio');
        },
      ],
    });
    log.registrar('erro', 'teste', 'continua');
    expect(log.recentes()).toHaveLength(1);
  });
  it('texto do erro mantém o código', () => {
    expect(textoDoErro({ codigo: 'NAO_ENCONTRADO', mensagem: 'sumiu' })).toBe('NAO_ENCONTRADO: sumiu');
    expect(textoDoErro(new TypeError('x'))).toBe('TypeError: x');
    expect(JSON.parse(relatorio(criarLog(), { versao: '0.1' })).info.versao).toBe('0.1');
  });
});
