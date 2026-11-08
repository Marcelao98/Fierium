// O que toda tela pode pegar sem receber por props: os serviços e as preferências.
import type { Config } from '@fierium/contratos';
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { ConfigApp } from './config';
import type { Servicos } from './servicos';

interface Nucleo {
  servicos: Servicos;
  config: ConfigApp;
}

const Contexto = createContext<Nucleo | null>(null);

export function ProvedorNucleo({ valor, children }: { valor: Nucleo; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

function useNucleo(): Nucleo {
  const n = useContext(Contexto);
  if (!n) throw new Error('tela fora do ProvedorNucleo (o main.tsx monta o provedor em volta do App)');
  return n;
}

export const useServicos = () => useNucleo().servicos;
export const useConfigApp = () => useNucleo().config;
export function useConfig(): Config | null {
  return useStore(useNucleo().config.store, (s) => s.config);
}

/** Lê um pedaço de uma store de funcionalidade (atalho do useStore do zustand). */
export function useFatia<T, R>(store: StoreApi<T>, f: (s: T) => R): R {
  return useStore(store, f);
}
