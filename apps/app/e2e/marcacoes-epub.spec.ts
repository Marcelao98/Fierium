// Marcações no EPUB, no leitor de verdade (casca + epub.js + exemplo em memória): selecionar, marcar como Dúvida com
// nota, fechar, reabrir (realçada no mesmo lugar), clicar (balão com a nota) e apagar.
import { expect, test, type Page } from '@playwright/test';
import { epubDeTeste } from './arquivos';

const PRINTS = 'e2e/prints';

async function abrirLeitor(page: Page, primeira: boolean) {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  if (primeira) {
    await page.route('**/livro.epub', (r) => r.fulfill({ body: epubDeTeste(), contentType: 'application/epub+zip' }));
    const q = new URLSearchParams({ arquivo: 'epub', arquivoUrl: '/livro.epub' });
    await page.goto(`/?novo=1&${q}`);
    await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
    await expect(page.getByRole('heading', { name: 'Dom Casmurro' })).toBeVisible({ timeout: 10_000 });
  }
  await page.getByRole('button', { name: 'Continuar' }).click();
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  const texto = page.frameLocator('iframe').first();
  await expect(texto.getByRole('heading', { name: 'Capítulo 1' })).toBeVisible({ timeout: 15_000 });
  return { leitor, texto, erros };
}

test('EPUB: selecionar, marcar como Dúvida com nota, reabrir, clicar e apagar', async ({ page }) => {
  const { leitor, texto, erros } = await abrirLeitor(page, true);
  const contador = leitor.getByRole('button', { name: 'Marcações deste livro' });
  const antes = Number((await contador.textContent())!.trim());

  // seleciona o começo do primeiro parágrafo dentro do iframe (o epub.js avisa com um pequeno atraso)
  await texto
    .locator('p')
    .first()
    .evaluate((p) => {
      const t = p.firstChild!;
      const r = document.createRange();
      r.setStart(t, 0);
      r.setEnd(t, 'Parágrafo 1 do capítulo 1'.length);
      const s = p.ownerDocument.getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
    });
  await page.getByRole('dialog', { name: 'Marcar trecho' }).getByText('Dúvida').click();
  const balao = page.getByRole('dialog', { name: 'Marcação' });
  await balao.getByLabel('Nota da marcação').fill('Que dragão é esse?');
  await balao.getByText('Pronto').click();
  await expect(contador).toHaveText(new RegExp(`${antes + 1}$`));

  // o realce (SVG do epub.js) aparece por cima do texto
  // (o epub.js põe o SVG dentro do iframe ou ao lado dele, conforme o modo de fluxo)
  const marca = page.locator('.fl-realce');
  await expect(marca.first()).toBeAttached({ timeout: 10_000 });
  await page.screenshot({ path: `${PRINTS}/m1-epub-marcado.png` });

  // fecha e reabre: a marcação volta realçada
  await page.keyboard.press('Escape');
  await expect(leitor).toBeHidden();
  const reaberto = await abrirLeitor(page, false);
  await expect(marca.first()).toBeAttached({ timeout: 10_000 });

  // clicar no trecho marcado abre o balão com a nota
  await reaberto.texto
    .locator('p')
    .first()
    .click({ position: { x: 20, y: 8 } });
  const aberto = page.getByRole('dialog', { name: 'Marcação' });
  await expect(aberto.getByLabel('Nota da marcação')).toHaveValue('Que dragão é esse?');
  await page.screenshot({ path: `${PRINTS}/m1-epub-balao.png` });

  // apagar some
  await aberto.getByText('Apagar').click();
  await expect(reaberto.leitor.getByRole('button', { name: 'Marcações deste livro' })).toHaveText(
    new RegExp(`${antes}$`),
  );
  await expect(marca).toHaveCount(0);
  expect(erros).toEqual([]);
});

test('EPUB: marcador de página pela barra liga e desliga', async ({ page }) => {
  const { leitor, erros } = await abrirLeitor(page, true);
  const contador = leitor.getByRole('button', { name: 'Marcações deste livro' });
  const antes = Number((await contador.textContent())!.trim());
  await expect.poll(() => page.evaluate(() => document.querySelector('iframe') !== null)).toBe(true);
  await page.waitForTimeout(800); // a posição chega do epub.js com o relocated
  await leitor.getByRole('button', { name: 'Marcador de página' }).click();
  await expect(contador).toHaveText(new RegExp(`${antes + 1}$`));
  await leitor.getByRole('button', { name: 'Marcador de página' }).click();
  await expect(contador).toHaveText(new RegExp(`${antes}$`));
  expect(erros).toEqual([]);
});
