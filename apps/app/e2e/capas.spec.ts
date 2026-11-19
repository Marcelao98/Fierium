// As capas: a gerada (Céu antigo) na Biblioteca, no Descobrir (cinza) e na Obra, sempre 2:3 e sem estourar o texto;
// e a capa do PDF desenhada em segundo plano pela fila (pdf.js de verdade, no Chromium).
import { expect, test, type Page } from '@playwright/test';
import { gerarPdf } from './arquivos';

async function entrar(page: Page, extra = '') {
  await page.goto(`/?novo=1${extra}`);
  await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Dom Casmurro' })).toBeVisible({ timeout: 10_000 });
}

/** Todas as capas visíveis têm a proporção 2:3 (a grade não pula nem deforma). */
async function proporcaoDuasPorTres(page: Page, seletor: string) {
  const caixas = await page.locator(seletor).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return r.width / r.height;
    }),
  );
  expect(caixas.length).toBeGreaterThan(3);
  for (const p of caixas) expect(Math.abs(p - 2 / 3)).toBeLessThan(0.01);
}

test('Capas geradas: Biblioteca, Descobrir e Obra', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await entrar(page);

  await page.goto('/#/biblioteca/grade');
  await expect(page.locator('.cartao-obra .f-selo').first()).toBeVisible();
  await proporcaoDuasPorTres(page, '.cartao-obra-capa .capa');
  // cada mundo tem o seu ornamento (o exemplo traz romance, filosofia, ciência, fantasia…)
  const motivos = await page
    .locator('.cartao-obra .f-selo')
    .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-motivo')))]);
  expect(motivos.length).toBeGreaterThanOrEqual(3);
  // o texto não sai da capa: nenhum <text> passa da moldura (200 de largura no desenho)
  const estouros = await page.locator('.f-selo text').evaluateAll(
    (els) =>
      els.filter((t) => {
        const b = (t as SVGGraphicsElement).getBBox();
        return b.x < 12 || b.x + b.width > 188;
      }).length,
  );
  expect(estouros).toBe(0);
  await page.screenshot({ path: 'e2e/prints/30-capas-biblioteca.png' });

  await page.goto('/#/descobrir');
  await expect(page.locator('.cartao-cinza .f-selo').first()).toBeVisible();
  await proporcaoDuasPorTres(page, '.cartao-cinza-capa .capa');
  await page.screenshot({ path: 'e2e/prints/31-capas-descobrir.png' });

  await page.goto('/#/biblioteca/grade');
  await page.locator('.cartao-obra', { hasText: 'Dom Casmurro' }).first().click();
  await expect(page.locator('.obra-capa .f-selo')).toBeVisible();
  await page.screenshot({ path: 'e2e/prints/32-capas-obra.png' });
  expect(erros).toEqual([]);
});

test('Capa do PDF: a fila desenha a 1ª página em segundo plano e a troca é suave', async ({ page }) => {
  test.setTimeout(90_000);
  const pdf = gerarPdf(3);
  await page.route('**/teste.pdf', async (rota) => {
    const range = rota.request().headers()['range'];
    const cab = { 'accept-ranges': 'bytes', 'content-type': 'application/pdf' };
    const m = range && /bytes=(\d+)-(\d*)/.exec(range);
    if (!m) return rota.fulfill({ status: 200, headers: cab, body: pdf });
    const ini = Number(m[1]);
    const fim = Math.min(pdf.length - 1, m[2] ? Number(m[2]) : pdf.length - 1);
    return rota.fulfill({
      status: 206,
      headers: { ...cab, 'content-range': `bytes ${ini}-${fim}/${pdf.length}` },
      body: pdf.subarray(ini, fim + 1),
    });
  });
  await entrar(page, `&arquivo=pdf&arquivoUrl=/teste.pdf&arquivoTamanho=${pdf.length}`);
  // só troca a rota (um page.goto recarregaria a página e perderia o ?arquivo= do teste)
  await page.evaluate(() => (location.hash = '#/biblioteca/grade'));
  const comImagem = page.locator('.cartao-obra .capa-imagem');
  await expect(comImagem.first()).toBeVisible({ timeout: 40_000 });
  const larg = await comImagem.first().evaluate((i: HTMLImageElement) => i.naturalWidth);
  expect(larg).toBeGreaterThanOrEqual(300);
  await proporcaoDuasPorTres(page, '.cartao-obra-capa .capa');
  await page.waitForTimeout(800); // a troca suave termina
  await page.screenshot({ path: 'e2e/prints/33-capa-pdf.png' });
});
