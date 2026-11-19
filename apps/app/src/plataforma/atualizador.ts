// Atualização automática (só no app). O Rust diz se está ligada: sem a chave pública de verdade na configuração
// (tauri.conf.json → plugins.updater.pubkey) fica desligada, sem erro. Ver ferramentas/chave-atualizacao.md.
import type { Atualizador } from '../nucleo/atualizacao';

export async function criarAtualizador(invocar: (cmd: string) => Promise<unknown>): Promise<Atualizador | null> {
  if ((await invocar('atualizador_ativo')) !== true) return null;
  return {
    async procurar() {
      const { check } = await import('@tauri-apps/plugin-updater');
      const u = await check();
      if (!u) return null;
      return {
        versao: u.version,
        instalar: async () => {
          await u.downloadAndInstall();
          const { relaunch } = await import('@tauri-apps/plugin-process');
          await relaunch();
        },
      };
    },
  };
}
