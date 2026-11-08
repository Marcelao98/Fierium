// @fierium/diagnostico — o log central da interface. Tudo o que acontece de importante (comandos pro núcleo, erros,
// eventos entre funcionalidades) passa por aqui: fica num anel dos últimos N registros (o inspetor mostra, o
// "relatório de problema" copia) e, a partir do M2, também vai pro log em arquivo do Rust (como o log.write do
// KOFstation). Sem React, sem DOM: roda no navegador, no Tauri e nos testes.

export type Nivel = 'debug' | 'info' | 'aviso' | 'erro';

export interface Registro {
  /** número crescente (ordem exata, mesmo com relógio igual) */
  n: number;
  quando: number;
  nivel: Nivel;
  /** quem registrou: "comando", "tela", "leitor", "evento"… */
  origem: string;
  mensagem: string;
  dados?: Record<string, unknown>;
}

export interface Log {
  registrar(nivel: Nivel, origem: string, mensagem: string, dados?: Record<string, unknown>): void;
  /** os últimos registros, do mais antigo pro mais novo */
  recentes(): readonly Registro[];
  /** avisa a cada registro novo; devolve a função de cancelar */
  assinar(f: (r: Registro) => void): () => void;
  limpar(): void;
}

export interface OpcoesLog {
  /** quantos registros guardar (padrão 500) */
  max?: number;
  agora?: () => number;
  /** além do anel, mandar pra outro lugar (console em desenvolvimento, arquivo do Rust no M2) */
  saidas?: ((r: Registro) => void)[];
}

export function criarLog(op: OpcoesLog = {}): Log {
  const max = op.max ?? 500;
  const agora = op.agora ?? Date.now;
  let anel: Registro[] = [];
  let n = 0;
  const assinantes = new Set<(r: Registro) => void>();
  return {
    registrar(nivel, origem, mensagem, dados) {
      const r: Registro = { n: ++n, quando: agora(), nivel, origem, mensagem, ...(dados ? { dados } : {}) };
      anel.push(r);
      if (anel.length > max) anel = anel.slice(anel.length - max);
      for (const s of op.saidas ?? []) {
        try {
          s(r);
        } catch {
          // uma saída com defeito (arquivo cheio, console fechado) não pode derrubar o app nem o log
        }
      }
      for (const a of assinantes) a(r);
    },
    recentes: () => anel,
    assinar(f) {
      assinantes.add(f);
      return () => assinantes.delete(f);
    },
    limpar() {
      anel = [];
    },
  };
}

/** Texto de um erro qualquer, sem perder o código quando tiver. */
export function textoDoErro(e: unknown): string {
  if (e && typeof e === 'object' && 'codigo' in e && 'mensagem' in e)
    return `${String(e.codigo)}: ${String(e.mensagem)}`;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

/** O relatório pra mandar quando algo der errado: versão, aparelho e os últimos registros. */
export function relatorio(log: Log, info: Record<string, unknown>): string {
  return JSON.stringify({ info, registros: log.recentes().slice(-200) }, null, 2);
}
