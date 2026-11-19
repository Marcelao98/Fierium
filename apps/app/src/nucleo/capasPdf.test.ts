import { criarClienteMemoria, type Cliente } from '@fierium/cliente';
import { criarLog } from '@fierium/diagnostico';
import { describe, expect, it } from 'vitest';
import { criarEventos } from './eventos';
import { criarFilaDeCapas } from './capasPdf';

/** O exemplo em memória só tem texto: aqui toda edição abre como PDF de mentira. */
function clienteComPdf(): { cliente: Cliente; salvas: string[] } {
  const base = criarClienteMemoria({ agora: () => 0 });
  const salvas: string[] = [];
  const chamar = (cmd: string, args: { edicaoId?: string }) => {
    if (cmd === 'edicao.abrir')
      return Promise.resolve({ tipo: 'arquivo', edicaoId: args.edicaoId, formato: 'pdf', url: 'x', tamanho: 1 });
    if (cmd === 'capa.salvar') salvas.push(args.edicaoId ?? '');
    return (base.chamar as (c: string, a: unknown) => Promise<unknown>)(cmd, args);
  };
  return { cliente: { chamar } as Cliente, salvas };
}

describe('fila de capas dos PDFs', () => {
  it('desenha uma capa por PDF sem capa, uma por vez, e avisa a tela', async () => {
    const { cliente, salvas } = clienteComPdf();
    const eventos = criarEventos();
    let mudou = 0;
    eventos.ouvir('biblioteca-mudou', () => mudou++);
    let simultaneas = 0;
    let maxSimultaneas = 0;
    const fila = criarFilaDeCapas({
      cliente,
      eventos,
      log: criarLog(),
      lendo: () => false,
      esperar: () => Promise.resolve(),
      desenhar: async () => {
        maxSimultaneas = Math.max(maxSimultaneas, ++simultaneas);
        await Promise.resolve();
        simultaneas--;
        return 'UklGRgQAAABXRUJQVlA4IA==';
      },
    });
    const total = (await cliente.chamar('obras.listar', {})).flatMap((o) =>
      o.edicoes.filter((e) => e.formato === 'pdf' && !e.capa),
    ).length;
    expect(total).toBeGreaterThan(3);
    expect(await fila.varrer()).toBe(total);
    expect(salvas.length).toBe(total);
    expect(maxSimultaneas).toBe(1);
    expect(mudou).toBe(total);
    // tudo já tem capa: nada a fazer
    expect(await fila.varrer()).toBe(0);
    const obras = await cliente.chamar('obras.listar', {});
    expect(obras.flatMap((o) => o.edicoes).filter((e) => e.formato === 'pdf' && !e.capa)).toEqual([]);
  });

  it('pausa enquanto a pessoa lê e não tenta de novo o que falhou', async () => {
    const { cliente } = clienteComPdf();
    let lendo = 3;
    let chamadas = 0;
    const fila = criarFilaDeCapas({
      cliente,
      eventos: criarEventos(),
      log: criarLog(),
      lendo: () => lendo-- > 0,
      esperar: () => Promise.resolve(),
      desenhar: () => {
        chamadas++;
        return Promise.reject(new Error('PDF quebrado'));
      },
    });
    expect(await fila.varrer()).toBe(0);
    expect(lendo).toBeLessThan(0);
    const falhas = chamadas;
    expect(falhas).toBeGreaterThan(3);
    expect(await fila.varrer()).toBe(0);
    expect(chamadas).toBe(falhas);
  });
});
