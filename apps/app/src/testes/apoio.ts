// Apoio pros testes das funcionalidades: serviços com o adaptador em memória, relógio parado e avisos guardados.
import { criarClienteMemoria, type Cliente } from '@fierium/cliente';
import { criarLog } from '@fierium/diagnostico';
import { criarServicos } from '../nucleo/servicos';

export const AGORA = new Date(2026, 10, 7, 20, 0, 0).getTime();

export function servicosDeTeste(cliente?: Cliente) {
  const avisos: { texto: string; tipo: string | undefined }[] = [];
  let agora = AGORA;
  const s = criarServicos(cliente ?? criarClienteMemoria({ agora: () => agora }), {
    log: criarLog(),
    agora: () => agora,
    avisar: (texto, tipo) => avisos.push({ texto, tipo }),
  });
  return { s, avisos, andar: (ms: number) => (agora += ms) };
}
