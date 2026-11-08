// Despacha uma onda inteira (docs/ORQUESTRACAO.md): cada cartão numa pasta separada (git worktree, na branch
// agente/<marco>-<passo>) e numa sessão própria de agente, todas em paralelo, alternando Codex e OpenCode (revisão
// cruzada). Quando o agente termina, o script envia a branch (o agente não precisa de rede pra isso).
//
// Uso:  pnpm despachar <marco> <onda> [--so-codex | --so-opencode] [--modelo-opencode=<provedor/modelo>] [--simular]
//   ex.: pnpm despachar m1.5 1
// Acompanhar: tmux attach -t fierium-<marco>-<onda> (uma janela por cartão) ou os logs em ../fierium-agentes/logs/.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [marco, onda] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const simular = flags.has('--simular');

function parar(msg) {
  console.error(`despachar: ${msg}`);
  process.exit(1);
}
if (!marco || !onda) parar('uso: pnpm despachar <marco> <onda> [--so-codex|--so-opencode] [--simular]');

// ---------- quais cartões e de qual branch ----------
const arqOndas = join(raiz, 'docs/cartoes', marco, 'ONDAS.md');
if (!existsSync(arqOndas)) parar(`não achei ${arqOndas}`);
const ondas = readFileSync(arqOndas, 'utf8');
const base = ondas.match(/^Branch do marco: `([^`]+)`/m)?.[1];
if (!base) parar('o ONDAS.md não diz a "Branch do marco"');
const linha = ondas.split('\n').find((l) => new RegExp(`^\\|\\s*${onda.replace('.', '\\.')}\\s*(🧭)?\\s*\\|`).test(l));
if (!linha) parar(`não achei a onda ${onda} na tabela do ${arqOndas}`);
if (linha.includes('🧭')) parar(`a onda ${onda} é do orquestrador (🧭): peça pra ele, não pra um executor`);
const cartoes = [...linha.matchAll(/\(([\w.-]+)\.md\)/g)].map((m) => m[1]);
if (!cartoes.length) parar(`a onda ${onda} não tem cartões`);

// ---------- quem executa ----------
// o Claude fica de fora de propósito: ele é o orquestrador e revisa no fim (limite de uso, D27)
const agentes = flags.has('--so-opencode') ? ['opencode'] : flags.has('--so-codex') ? ['codex'] : ['codex', 'opencode'];
const modeloOpencode = [...flags].find((f) => f.startsWith('--modelo-opencode='))?.split('=')[1];
const temComando = (c) => spawnSync('sh', ['-c', `command -v ${c}`]).status === 0;
for (const a of new Set(agentes)) if (!temComando(a) && !simular) parar(`o comando "${a}" não está instalado`);
if (!temComando('tmux') && !simular) parar('preciso do tmux (sudo apt install tmux)');

const pastaAgentes = resolve(raiz, '../fierium-agentes');
const logs = join(pastaAgentes, 'logs');
const sessaoTmux = `fierium-${marco}-${onda}`.replace(/\./g, '_');
const git = (...a) => execFileSync('git', a, { cwd: raiz, encoding: 'utf8' }).trim();

if (!simular) {
  mkdirSync(logs, { recursive: true });
  git('fetch', 'origin', `+refs/heads/${base}:refs/remotes/origin/${base}`);
}

const plano = cartoes.map((c, i) => {
  // o nome do arquivo é o passo (i3, 01-banco…), igual à branch escrita no cartão
  const branch = `agente/${marco}-${c}`;
  return { cartao: c, branch, pasta: join(pastaAgentes, `${marco}-${c}`), agente: agentes[i % agentes.length] };
});

const frase = (p) =>
  `Execute o cartão docs/cartoes/${marco}/${p.cartao}.md deste repositório (Fierium). Você já está na branch ` +
  `${p.branch}, com as dependências instaladas. Siga o AGENTS.md (seção "Se você recebeu um cartão"). Faça commits ` +
  `em português, sem nome de modelo. No fim, preencha o relatório no cartão, mude o Estado pra "em revisão" e faça ` +
  `o commit final. Não precisa enviar a branch: quem envia é o script que te chamou. Dúvida de produto: anote no ` +
  `relatório e pare.`;

// o que roda dentro de cada janela do tmux: o agente, depois o envio da branch
const comandoAgente = (p) =>
  p.agente === 'codex'
    ? `codex exec --full-auto ${JSON.stringify(frase(p))}`
    : `opencode run ${modeloOpencode ? `-m ${modeloOpencode} ` : ''}${JSON.stringify(frase(p))}`;

for (const p of plano) {
  const log = join(logs, `${marco}-${p.cartao}.log`);
  const roteiro = join(pastaAgentes, `${marco}-${p.cartao}.sh`);
  const sh = [
    '#!/usr/bin/env bash',
    'set -o pipefail',
    `cd ${JSON.stringify(p.pasta)}`,
    `echo "== ${marco}/${p.cartao} com ${p.agente} em $(date) ==" | tee -a ${JSON.stringify(log)}`,
    `${comandoAgente(p)} 2>&1 | tee -a ${JSON.stringify(log)}`,
    // sobrou algo sem commit? guarda num commit de segurança pra revisão ver (não perde trabalho)
    'if [ -n "$(git status --porcelain)" ]; then git add -A && git commit -q -m "Sobras do executor (sem commit no fim)"; fi',
    `git push -u origin ${p.branch} 2>&1 | tee -a ${JSON.stringify(log)}`,
    `echo "== terminou: peça ao orquestrador: /orquestra revisa ${marco}/${p.cartao} ==" | tee -a ${JSON.stringify(log)}`,
    'exec bash',
  ].join('\n');

  console.log(`${marco}/${p.cartao}  →  ${p.agente.padEnd(6)}  ${p.branch}  (${p.pasta})`);
  if (simular) continue;

  if (!existsSync(p.pasta)) {
    // branch nova a partir da base do marco (ou a que já existe no GitHub, se for uma correção)
    const remota = git('ls-remote', '--heads', 'origin', p.branch);
    if (remota) {
      git('fetch', 'origin', `+refs/heads/${p.branch}:refs/remotes/origin/${p.branch}`);
      git('worktree', 'add', '-B', p.branch, p.pasta, `origin/${p.branch}`);
    } else {
      git('worktree', 'add', '-B', p.branch, p.pasta, `origin/${base}`);
    }
    execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: p.pasta, stdio: 'inherit' });
  }
  writeFileSync(roteiro, sh, { mode: 0o755 });
  const temSessao = spawnSync('tmux', ['has-session', '-t', sessaoTmux]).status === 0;
  execFileSync(
    'tmux',
    temSessao
      ? ['new-window', '-t', sessaoTmux, '-n', p.cartao, roteiro]
      : ['new-session', '-d', '-s', sessaoTmux, '-n', p.cartao, roteiro],
  );
}

console.log(
  simular
    ? '\n(simulação: nada foi criado)'
    : `\n${plano.length} agentes rodando. Acompanhe: tmux attach -t ${sessaoTmux}   (Ctrl+B depois N = próxima janela)\n` +
        `Logs: ${logs}\nQuando cada um terminar: /orquestra revisa ${marco}/<cartão>`,
);
