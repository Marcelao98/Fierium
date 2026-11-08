// Painel dos cartões (docs/ORQUESTRACAO.md): o estado escrito em cada cartão e se a branch do executor já está no
// GitHub. Uso: pnpm cartoes [marco]   (ex.: pnpm cartoes m3)
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../../docs/cartoes');
const filtro = process.argv[2];

let remotas = new Set();
try {
  const saida = execFileSync('git', ['ls-remote', '--heads', 'origin', 'agente/*'], { encoding: 'utf8' });
  remotas = new Set(
    saida
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('refs/heads/')[1]),
  );
} catch (e) {
  // sem rede ou sem origin: o painel ainda mostra o estado escrito nos cartões
  console.error(`(não deu pra consultar o GitHub: ${e.message.split('\n')[0]})`);
}

const linhas = [];
for (const marco of readdirSync(raiz, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()) {
  if (filtro && marco !== filtro) continue;
  for (const arq of readdirSync(join(raiz, marco))
    .filter((a) => a.endsWith('.md') && a !== 'ONDAS.md')
    .sort()) {
    const texto = readFileSync(join(raiz, marco, arq), 'utf8');
    const titulo = texto.match(/^# Cartão \S+ · (.+)$/m)?.[1] ?? arq;
    const estado = texto.match(/^\*\*Estado:\*\* (.+)$/m)?.[1] ?? '?';
    const branch = texto.match(/^\*\*Branch:\*\* `([^`]+)`/m)?.[1] ?? '';
    linhas.push([`${marco}/${arq.replace('.md', '')}`, titulo, estado, remotas.has(branch) ? 'no GitHub' : '—']);
  }
}
const larg = [0, 1, 2, 3].map((i) => Math.max(...linhas.map((l) => l[i].length), 6));
const fmt = (l) => l.map((c, i) => c.padEnd(larg[i])).join('  ');
console.log(fmt(['cartão', 'título', 'estado', 'branch']));
for (const l of linhas) console.log(fmt(l));
