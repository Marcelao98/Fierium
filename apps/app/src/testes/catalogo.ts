// Apoio pros testes do catálogo: o exemplo em memória, mas com o download funcionando (o de verdade só existe no Rust).
import { criarClienteMemoria, type Cliente } from '@fierium/cliente';
import { AGORA } from './apoio';

export function clienteComBaixa(): { cliente: Cliente; baixados: string[] } {
  const mem = criarClienteMemoria({ agora: () => AGORA });
  const baixados: string[] = [];
  const cliente: Cliente = {
    chamar: ((cmd: string, args: unknown) => {
      if (cmd === 'catalogo.baixar') {
        baixados.push((args as { id: string }).id);
        return Promise.resolve({ obraId: 'obra-nova', edicaoId: 'edicao-nova' });
      }
      return mem.chamar(cmd as never, args as never);
    }) as Cliente['chamar'],
  };
  return { cliente, baixados };
}
