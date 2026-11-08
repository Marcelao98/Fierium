// Rastro de cada comando (o "inspetor" mostra): nome, argumentos resumidos, tempo, e o código do erro quando falha.
// É um invólucro: funciona igual com qualquer adaptador (memória, Tauri, HTTP).
import type { Log } from '@fierium/diagnostico';
import { paraErroFierium, type Cliente } from './cliente';

function resumir(v: unknown): unknown {
  const t = JSON.stringify(v) ?? '';
  return t.length > 300 ? t.slice(0, 300) + '…' : v;
}

export function rastrear(cliente: Cliente, log: Log, agora: () => number = () => performance.now()): Cliente {
  return {
    async chamar(cmd, args) {
      const t0 = agora();
      try {
        const r = await cliente.chamar(cmd, args);
        log.registrar('debug', 'comando', cmd, { args: resumir(args), ms: Math.round((agora() - t0) * 10) / 10 });
        return r;
      } catch (e) {
        const erro = paraErroFierium(e);
        log.registrar('erro', 'comando', `${cmd} falhou: ${erro.codigo}`, {
          args: resumir(args),
          ms: Math.round((agora() - t0) * 10) / 10,
          codigo: erro.codigo,
          mensagem: erro.mensagem,
        });
        throw erro;
      }
    },
  };
}
