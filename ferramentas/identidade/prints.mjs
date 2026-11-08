// Tira os prints das três direções do M1.5 (docs/IDENTIDADE.md). Uso: node ferramentas/identidade/prints.mjs
import { createRequire } from 'node:module';
// require (e não import) pra achar o Playwright instalado no sistema também (NODE_PATH), além do do projeto
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const saida = join(aqui, '../../docs/imagens/identidade');
mkdirSync(saida, { recursive: true });
const nav = await chromium.launch();
const pag = await nav.newPage({ viewport: { width: 1440, height: 900 } });
for (const d of ['nebulosa', 'ceu', 'aurora'])
  for (const t of ['inicio', 'biblioteca', 'leitor']) {
    await pag.goto(`file://${join(aqui, 'prototipo.html')}?d=${d}&t=${t}`, { waitUntil: 'networkidle' });
    await pag.evaluate(() => document.fonts.ready);
    await pag.screenshot({ path: join(saida, `${d}-${t}.jpg`), quality: 84, type: 'jpeg' });
  }
const sel = await nav.newPage({ viewport: { width: 1440, height: 900 } });
await sel.goto(`file://${join(aqui, 'selos.html')}`, { waitUntil: 'networkidle' });
await sel.evaluate(() => document.fonts.ready);
await sel.screenshot({ path: join(saida, 'selos.jpg'), quality: 88, type: 'jpeg' });
await nav.close();
console.log('prints em', saida);
