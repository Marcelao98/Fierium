import { criarLog } from '@fierium/diagnostico';
import { describe, expect, it } from 'vitest';
import { criarClienteMemoria } from './memoria/memoria';
import { rastrear } from './rastreado';

describe('rastro dos comandos', () => {
  it('registra o comando que deu certo e o que falhou, com o código', async () => {
    const log = criarLog();
    let t = 0;
    const c = rastrear(criarClienteMemoria({ agora: () => 0 }), log, () => (t += 5));
    await c.chamar('app.info', {});
    await c.chamar('obra.obter', { id: 'nao-existe' }).catch(() => undefined);
    const [ok, erro] = log.recentes();
    expect(ok).toMatchObject({ nivel: 'debug', origem: 'comando', mensagem: 'app.info', dados: { ms: 5 } });
    expect(erro).toMatchObject({ nivel: 'erro', dados: { codigo: 'NAO_ENCONTRADO' } });
  });
});
