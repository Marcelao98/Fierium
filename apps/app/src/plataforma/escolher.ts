// Escolhe o adaptador do núcleo (D5). No M1 só existe o de memória; o do Tauri entra no M2.
//   ?novo=1     começa do zero (como na primeira vez), apagando o que o exemplo guardou
//   ?atraso=300 atraso artificial em cada comando (pra ver os estados de carregando)
import { criarClienteMemoria, type Cliente } from '@fierium/cliente';

function armazenamento(): Storage | null {
  try {
    localStorage.setItem('fierium.teste', '1');
    localStorage.removeItem('fierium.teste');
    return localStorage;
  } catch {
    return null; // navegador sem armazenamento (aba privada, bloqueado): o exemplo vale só até fechar
  }
}

export function escolherCliente(url: URL): Cliente {
  const guardar = armazenamento();
  if (url.searchParams.get('novo') === '1') {
    guardar?.removeItem('fierium.memoria.v1');
    // tira o ?novo=1 do endereço: senão recarregar a página apagaria tudo de novo
    url.searchParams.delete('novo');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  const atraso = Number(url.searchParams.get('atraso') ?? 0);
  return criarClienteMemoria({ guardar, ...(atraso > 0 ? { atraso } : {}) });
}
