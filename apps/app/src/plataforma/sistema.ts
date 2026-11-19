// O que só o sistema sabe fazer: abrir um link no navegador padrão e pôr a janela em tela cheia. Cada função tenta
// o jeito do app (Tauri) e, se não der, o do navegador. Nada aqui lança: devolve se conseguiu.

const noApp = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invocar(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(cmd, args);
}

/** Abre o link no navegador do sistema. `false` = não consegui (quem chamou avisa a pessoa e oferece copiar). */
export async function abrirLinkNoSistema(url: string): Promise<boolean> {
  if (!/^https:\/\//.test(url)) return false; // só links https (nada de file:, javascript:…)
  if (noApp()) {
    try {
      // o plugin opener, quando o app o traz (precisa da permissão `opener:allow-open-url` na capability)
      await invocar('plugin:opener|open_url', { url });
      return true;
    } catch {
      return false; // sem o plugin ou sem permissão: a janela do app não abre link por conta própria
    }
  }
  return window.open(url, '_blank', 'noopener,noreferrer') !== null;
}

/** Liga ou desliga a tela cheia da janela. Devolve se ficou como pedido. */
export async function telaCheiaDoSistema(ligar: boolean): Promise<boolean> {
  if (noApp()) {
    try {
      // precisa da permissão `core:window:allow-set-fullscreen` na capability
      await invocar('plugin:window|set_fullscreen', { label: 'principal', value: ligar });
      return true;
    } catch {
      // cai na API do navegador logo abaixo (o WebView2 e o WebKit também a atendem)
    }
  }
  try {
    if (ligar) await document.documentElement.requestFullscreen();
    else if (document.fullscreenElement) await document.exitFullscreen();
    return true;
  } catch {
    return false; // o navegador negou (sem gesto da pessoa): o modo mergulho segue sem tela cheia
  }
}
