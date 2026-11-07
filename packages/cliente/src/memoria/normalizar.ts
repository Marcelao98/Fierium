// Busca sem acento e com as palavras em qualquer ordem (o que o KOFlibrary fazia no Busca.kf). No M3 isto vai pro
// Rust (FTS5); aqui é a imitação do adaptador em memória.

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Todas as palavras da busca aparecem no texto (em qualquer ordem, sem acento, começo de palavra). */
export function combina(busca: string, ...campos: (string | undefined)[]): boolean {
  const palavras = normalizar(busca).split(' ').filter(Boolean);
  if (!palavras.length) return true;
  const alvo = ' ' + normalizar(campos.filter(Boolean).join(' ')) + ' ';
  return palavras.every((p) => alvo.includes(' ' + p));
}
