// O estado do adaptador em memória e o que todas as áreas usam (achar obra/edição/marcação, relógio, guardar).
import type { ArgsDe, Config, NomeComando, RespostaDe } from '@fierium/contratos';
import { ErroFierium } from '../cliente';
import { bibliotecaDeExemplo, CORES_PADRAO, type Estado } from './dados-exemplo';

/** Os tratadores de um grupo de comandos (cada área do adaptador implementa os seus). */
export type Tratadores<K extends NomeComando> = { [C in K]: (a: ArgsDe<C>) => RespostaDe<C> };

export interface Guardar {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const CONFIG_PADRAO: Config = {
  tema: 'noite',
  movimento: 'normal',
  leitura: { fonte: 'literata', tamanho: 20, entrelinha: 1.7, largura: 66, tema: 'noite' },
  cores: CORES_PADRAO,
  primeiraVez: true,
};

const CHAVE = 'fierium.memoria.v1';

export interface Base {
  estado: Estado;
  config: Config;
  agora: () => number;
  obra(id: string): Estado['obras'][number];
  edicao(id: string): { o: Estado['obras'][number]; e: Estado['obras'][number]['edicoes'][number] };
  marcacao(id: string): Estado['marcacoes'][number];
  salvar(): void;
}

export function criarBase(agora: () => number, guardar: Guardar | null, primeiraVez: boolean): Base {
  let g: { estado: Estado; config: Config } | null = null;
  try {
    const t = guardar?.getItem(CHAVE);
    if (t) g = JSON.parse(t) as { estado: Estado; config: Config };
  } catch {
    g = null; // guardado estragado ou sem acesso: começa da biblioteca de exemplo
  }
  const b: Base = {
    estado: g?.estado ?? bibliotecaDeExemplo(agora()),
    config: g?.config ?? { ...CONFIG_PADRAO, primeiraVez },
    agora,
    obra(id) {
      const o = b.estado.obras.find((x) => x.id === id);
      if (!o) throw new ErroFierium('NAO_ENCONTRADO', `obra não encontrada: ${id}`);
      return o;
    },
    edicao(id) {
      for (const o of b.estado.obras) for (const e of o.edicoes) if (e.id === id) return { o, e };
      throw new ErroFierium('NAO_ENCONTRADO', `edição não encontrada: ${id}`);
    },
    marcacao(id) {
      const m = b.estado.marcacoes.find((x) => x.id === id);
      if (!m) throw new ErroFierium('NAO_ENCONTRADO', `marcação não encontrada: ${id}`);
      return m;
    },
    salvar() {
      try {
        guardar?.setItem(CHAVE, JSON.stringify({ estado: b.estado, config: b.config }));
      } catch {
        // sem espaço ou sem acesso: as mudanças valem só até fechar (é o adaptador de demonstração)
      }
    },
  };
  return b;
}

export const autorDe = (o: { criadores: { nome: string }[] }) => o.criadores[0]?.nome ?? '';
