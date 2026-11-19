// Aviso de versão nova. A procura roda em segundo plano ao abrir; a tela só lê esta store e chama `instalar`.
// Quem fala com o Tauri é a camada de plataforma (plataforma/atualizador.ts), nunca a tela.
import type { Log } from '@fierium/diagnostico';
import { create } from 'zustand';

export interface Atualizador {
  /** procura uma versão nova; null se já está na última */
  procurar(): Promise<{ versao: string; instalar: () => Promise<void> } | null>;
}

interface Estado {
  versao: string | null;
  fase: 'nenhuma' | 'disponivel' | 'instalando';
  instalar: (() => Promise<void>) | null;
}

export const useAtualizacao = create<Estado>(() => ({ versao: null, fase: 'nenhuma', instalar: null }));

/** Procura em segundo plano; falha de rede ou de assinatura só vai pro log (a pessoa não precisa ser incomodada). */
export async function procurarAtualizacao(atualizador: Atualizador | null, log: Log): Promise<void> {
  if (!atualizador) return;
  try {
    const nova = await atualizador.procurar();
    if (!nova) {
      log.registrar('info', 'atualizador', 'o Fierium já está na versão mais nova');
      return;
    }
    log.registrar('info', 'atualizador', `versão ${nova.versao} disponível`);
    useAtualizacao.setState({ versao: nova.versao, fase: 'disponivel', instalar: nova.instalar });
  } catch (e) {
    log.registrar('aviso', 'atualizador', 'não consegui procurar atualização', { erro: String(e) });
  }
}

export async function instalarAtualizacao(log: Log, avisar: (t: string, tipo?: 'info' | 'erro') => void) {
  const { instalar, fase } = useAtualizacao.getState();
  if (!instalar || fase !== 'disponivel') return;
  useAtualizacao.setState({ fase: 'instalando' });
  try {
    await instalar();
  } catch (e) {
    log.registrar('erro', 'atualizador', 'a atualização falhou', { erro: String(e) });
    avisar('Não consegui atualizar agora. Tente de novo mais tarde.', 'erro');
    useAtualizacao.setState({ fase: 'disponivel' });
  }
}
