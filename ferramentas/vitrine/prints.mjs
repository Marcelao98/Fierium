// Prints e vídeo da vitrine (site/ e README). Uso: node ferramentas/vitrine/prints.mjs
// Sobe o app (exemplo em memória, Céu antigo) numa porta própria, tira os prints 1440×900 e grava o fluxo
// "abrir → ler → marcar → citação". Precisa do Playwright (do projeto) e, pra otimizar, do Pillow (python3) e do ffmpeg.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '../..');
const saida = join(raiz, 'site/imagens');
const bruto = join(aqui, '.bruto'); // temporário (fora do git)
const porta = Number(process.env.FIERIUM_PORTA_VITRINE ?? 4196);
const base = `http://127.0.0.1:${porta}`;
const requireApp = createRequire(join(raiz, 'apps/app/package.json'));
const { chromium } = requireApp('@playwright/test');
mkdirSync(saida, { recursive: true });
rmSync(bruto, { recursive: true, force: true });
mkdirSync(bruto, { recursive: true });

const rodar = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: raiz, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} falhou`);
};
if (!process.env.FIERIUM_SEM_BUILD) rodar('pnpm', ['--filter', '@fierium/app', 'build']);
const servidor = spawn(
  'pnpm',
  [
    '--filter',
    '@fierium/app',
    'exec',
    'vite',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(porta),
    '--strictPort',
  ],
  { cwd: raiz, stdio: 'ignore' },
);
const encerrar = () => servidor.kill();
process.on('exit', encerrar);
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    // o servidor ainda está subindo: tenta de novo
  }
  await new Promise((r) => setTimeout(r, 500));
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
const pag = await ctx.newPage();
const print = async (nome) => {
  await pag.evaluate(() => document.fonts.ready);
  await pag.waitForTimeout(500);
  await pag.screenshot({ path: join(bruto, `${nome}.png`) });
};
const navegar = (nome) => pag.getByRole('navigation').getByRole('button', { name: nome }).first().click();

// entra no exemplo
await pag.goto(`${base}/?novo=1`);
await pag.getByRole('button', { name: 'Começar' }).click();
await pag.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
await pag.getByText('Continuar lendo').waitFor({ timeout: 15_000 });
await print('inicio');

await pag.goto(`${base}/#/biblioteca/grade`);
await pag.locator('.cartao-obra .f-selo').first().waitFor();
await print('biblioteca');

await pag.goto(`${base}/#/descobrir`);
await pag.locator('.cartao-cinza .f-selo').first().waitFor();
await print('descobrir');

await navegar('Notas');
await pag.getByRole('tab', { name: /^Citações/ }).click();
await pag.locator('figure.citacao').first().waitFor();
await print('notas');

// leitor + painel de temas
await navegar('Início');
await pag.getByRole('button', { name: 'Continuar' }).click();
const leitor = pag.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
await leitor.getByText('II — Do livro').waitFor({ timeout: 15_000 });
await print('leitor');
await leitor.getByRole('button', { name: 'Aparência' }).click();
await pag.getByRole('region', { name: 'Página' }).locator('.tema-amostra').first().waitFor();
await print('temas');
await pag.keyboard.press('Escape');

// cartão de citação
await pag.keyboard.press('Escape');
await navegar('Notas');
await pag.getByRole('button', { name: 'Compartilhar como imagem' }).first().click();
const janela = pag.getByRole('dialog', { name: 'Compartilhar como imagem' });
await janela.getByLabel('Prévia do cartão de citação').waitFor();
await janela.getByRole('group', { name: 'Estilo do cartão' }).getByRole('button').nth(1).click();
await pag.waitForTimeout(800);
await print('cartao');
await ctx.close();

// vídeo: abrir → ler → marcar → citação
const ctxV = await nav.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: bruto, size: { width: 1280, height: 800 } },
});
await ctxV.grantPermissions(['clipboard-read', 'clipboard-write']);
const v = await ctxV.newPage();
await v.goto(`${base}/?novo=1`);
await v.getByRole('button', { name: 'Começar' }).click();
await v.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
await v.getByText('Continuar lendo').waitFor({ timeout: 15_000 });
await v.waitForTimeout(1800);
await v.getByRole('button', { name: 'Continuar' }).click();
const lv = v.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
await lv.getByText('II — Do livro').waitFor({ timeout: 15_000 });
await v.waitForTimeout(1500);
await lv.getByRole('button', { name: 'Aparência' }).click();
await v.waitForTimeout(1500);
await v.getByRole('region', { name: 'Página' }).getByRole('button', { name: 'Página Noite', exact: true }).click();
await v.waitForTimeout(1500);
await v.keyboard.press('Escape');
await v.evaluate(() => {
  const p = document.querySelector('p[data-cap="1"][data-par="0"]');
  p.scrollIntoView({ block: 'center', behavior: 'instant' });
  const t = p.firstChild;
  const r = document.createRange();
  r.setStart(t, 0);
  r.setEnd(t, 'Agora que expliquei o título'.length);
  getSelection().removeAllRanges();
  getSelection().addRange(r);
  p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
await v.waitForTimeout(1500);
await v.keyboard.press('Shift+F10');
await v.waitForTimeout(1500);
await v.getByRole('menuitem', { name: 'Compartilhar como imagem…' }).click();
await v.getByLabel('Prévia do cartão de citação').waitFor();
await v.waitForTimeout(3500);
await ctxV.close(); // grava o arquivo
await nav.close();
encerrar();

// otimiza: PNG bruto → WebP (e JPG pro og:image); vídeo → WebM e MP4 leves
const py = `
import sys, glob, os
from PIL import Image
for f in glob.glob(sys.argv[1] + '/*.png'):
    nome = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert('RGB')
    im.save(os.path.join(sys.argv[2], nome + '.webp'), 'WEBP', quality=80, method=6)
    if nome == 'inicio':
        im.save(os.path.join(sys.argv[2], 'og.jpg'), 'JPEG', quality=82, optimize=True)
`;
rodar('python3', ['-I', '-c', py, bruto, saida]);
const webm = readdirSync(bruto).find((f) => f.endsWith('.webm'));
if (webm) {
  const entrada = join(bruto, webm);
  const ff = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-i',
      entrada,
      '-an',
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      '38',
      '-vf',
      'scale=1280:-2,fps=24',
      join(saida, 'fluxo.webm'),
    ],
    { stdio: 'inherit' },
  );
  if (ff.status === 0) {
    spawnSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-y',
        '-i',
        entrada,
        '-an',
        '-c:v',
        'libx264',
        '-crf',
        '30',
        '-preset',
        'slow',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-vf',
        'scale=1280:-2,fps=24',
        join(saida, 'fluxo.mp4'),
      ],
      { stdio: 'inherit' },
    );
  } else {
    console.warn('ffmpeg falhou ou não existe: ficou o WebM cru em fluxo.webm');
    renameSync(entrada, join(saida, 'fluxo.webm'));
  }
}
rmSync(bruto, { recursive: true, force: true });
console.log('prints em', saida, existsSync(join(saida, 'fluxo.webm')) ? '(com vídeo)' : '');
