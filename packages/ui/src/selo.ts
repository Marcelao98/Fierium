// Selo: a capa gerada pra obra sem imagem (§9.5). Determinístico: o mesmo título dá sempre o mesmo desenho.

/** Hash pequeno e estável (FNV-1a de 32 bits). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface FormaDoSelo {
  /** raios das órbitas (0..1 do meio da capa) */
  orbitas: number[];
  /** pontos: [ângulo em graus, órbita, tamanho] */
  astros: [number, number, number][];
  /** ângulo do arco de luz */
  arco: number;
}

export function formaDoSelo(semente: string): FormaDoSelo {
  let h = hash(semente);
  const prox = () => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    return (h % 10000) / 10000;
  };
  const n = 2 + Math.floor(prox() * 3);
  const orbitas = Array.from({ length: n }, (_, i) => 0.22 + i * (0.5 / n) + prox() * 0.05);
  const astros = Array.from({ length: 2 + Math.floor(prox() * 4) }, (): [number, number, number] => [
    Math.floor(prox() * 360),
    Math.floor(prox() * n),
    1 + prox() * 2.4,
  ]);
  return { orbitas, astros, arco: Math.floor(prox() * 360) };
}
