// Eventos entre funcionalidades. Uma funcionalidade nunca importa outra: quando algo muda que interessa às outras,
// ela emite um evento aqui (ex.: o leitor fecha → 'obra-mudou' → o Início e a Biblioteca se atualizam).
// Tipado: emitir um evento que não existe, ou com os dados errados, não compila.

export interface EventosApp {
  /** progresso, favorita ou estado de leitura de uma obra mudou */
  'obra-mudou': { obraId: string };
  /** marcações de uma obra foram criadas, mudadas ou apagadas */
  'marcacoes-mudaram': { obraId: string };
  /** uma sessão de leitura foi registrada (estatísticas) */
  'sessao-registrada': { obraId: string; segundos: number };
  /** a varredura das pastas mudou o que há na biblioteca (ou uma pasta saiu) */
  'biblioteca-mudou': Record<string, never>;
  /** coleções criadas ou mudadas */
  'colecoes-mudaram': Record<string, never>;
}

export type NomeEvento = keyof EventosApp;

export interface Eventos {
  emitir<E extends NomeEvento>(e: E, dados: EventosApp[E]): void;
  /** devolve a função de parar de ouvir */
  ouvir<E extends NomeEvento>(e: E, f: (dados: EventosApp[E]) => void): () => void;
}

export function criarEventos(aoEmitir?: (e: NomeEvento, dados: unknown) => void): Eventos {
  const ouvintes = new Map<NomeEvento, Set<(d: unknown) => void>>();
  return {
    emitir(e, dados) {
      aoEmitir?.(e, dados);
      for (const f of ouvintes.get(e) ?? []) f(dados);
    },
    ouvir(e, f) {
      const s = ouvintes.get(e) ?? new Set();
      s.add(f as (d: unknown) => void);
      ouvintes.set(e, s);
      return () => s.delete(f as (d: unknown) => void);
    },
  };
}
