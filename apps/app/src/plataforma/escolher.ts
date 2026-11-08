// Escolhe o adaptador do núcleo (D5): dentro do app (Tauri) fala com o Rust; no navegador (pnpm dev, testes), com o
// exemplo em memória. No Tauri, o adaptador é combinado: o que o Rust já atende vai pro Rust, o resto pro exemplo
// (a migração área por área, M3 em diante).
//   ?novo=1     começa do zero (como na primeira vez), apagando o que o exemplo guardou
//   ?atraso=300 atraso artificial em cada comando (pra ver os estados de carregando)
import {
  criarClienteCombinado,
  criarClienteMemoria,
  criarClienteTauri,
  type Cliente,
  type Invocar,
} from '@fierium/cliente';

function armazenamento(): Storage | null {
  try {
    localStorage.setItem('fierium.teste', '1');
    localStorage.removeItem('fierium.teste');
    return localStorage;
  } catch {
    return null; // navegador sem armazenamento (aba privada, bloqueado): o exemplo vale só até fechar
  }
}

export interface Plataforma {
  cliente: Cliente;
  /** manda uma linha pro log em arquivo do núcleo (só no app; no navegador não existe) */
  enviarLog: ((linha: { nivel: string; origem: string; mensagem: string; dados?: unknown }) => void) | null;
  nome: 'tauri' | 'navegador';
}

export const ehTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function escolherPlataforma(url: URL): Promise<Plataforma> {
  const guardar = armazenamento();
  if (url.searchParams.get('novo') === '1') {
    guardar?.removeItem('fierium.memoria.v1');
    // tira o ?novo=1 do endereço: senão recarregar a página apagaria tudo de novo
    url.searchParams.delete('novo');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  const atraso = Number(url.searchParams.get('atraso') ?? 0);
  const memoria = criarClienteMemoria({ guardar, ...(atraso > 0 ? { atraso } : {}) });
  if (!ehTauri()) return { cliente: memoria, enviarLog: null, nome: 'navegador' };

  const { invoke } = await import('@tauri-apps/api/core');
  const invocar: Invocar = (cmd, args) => invoke(cmd, args);
  const rust = criarClienteTauri(invocar);
  const noRust = new Set(await rust.chamar('app.comandos', {}));
  return {
    cliente: criarClienteCombinado(rust, memoria, noRust),
    enviarLog: (l) => void invocar('chamar', { cmd: 'log.escrever', args: l }).catch(() => undefined), // o log não pode gerar log
    nome: 'tauri',
  };
}
