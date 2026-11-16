// Notas: filtrar, citar, abrir no trecho, exportar um livro; e o Ctrl+K achando a nota.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function entrar(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?novo=1');
  await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
  await expect(page.getByText('Continuar lendo')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('navigation').getByRole('button', { name: 'Notas' }).first().click();
  await expect(page.getByRole('heading', { name: 'Notas', exact: true })).toBeVisible();
}

test('Notas: citação copiada, abrir no trecho e exportar um livro', async ({ page }) => {
  await entrar(page);
  await expect(page.getByText('A entropia de um sistema isolado')).toBeVisible();
  await page.screenshot({ path: 'e2e/prints/notas-todas.png' });
  await page.getByRole('tab', { name: /^Citações/ }).click();
  await expect(page.getByText('O amor é o desejo de possuir o bem para sempre.')).toBeVisible();
  await page.screenshot({ path: 'e2e/prints/notas-citacoes.png' });

  const cit = page.locator('figure.citacao', { hasText: 'Há livros que apenas terão isso' });
  await cit.getByRole('button', { name: 'Copiar citação' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '“Há livros que apenas terão isso dos seus autores; alguns nem tanto.” — Machado de Assis, *Dom Casmurro*, cap. 1',
  );
  await page.getByLabel('Formato da citação').selectOption('abnt');
  await cit.getByRole('button', { name: 'Copiar citação' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '(ASSIS, Machado de. Dom Casmurro. cap. 1)',
  );
  await page.getByLabel('Formato da citação').selectOption('simples');

  // exportar o Markdown de um livro
  const baixado = page.waitForEvent('download');
  await page.getByRole('region', { name: 'Dom Casmurro' }).getByRole('button', { name: 'Exportar este livro' }).click();
  const md = readFileSync((await (await baixado).path())!, 'utf8');
  expect(md).toContain('## Dom Casmurro');
  expect(md).toContain('> Há livros que apenas terão isso');
  expect(md).not.toContain('O Banquete');

  // texto sem acento
  await page.getByRole('tab', { name: /^Todas/ }).click();
  await page.getByLabel('Buscar nas notas').fill('entropía');
  await expect(page.getByText('A entropia de um sistema isolado')).toBeVisible();
  await expect(page.getByText('Há livros que apenas')).toBeHidden();
  await page.getByLabel('Buscar nas notas').fill('');

  // abrir no trecho
  const cartao = page.locator('article.marcacao', { hasText: 'O livro inteiro está nesta frase.' });
  await cartao.getByRole('button', { name: 'Abrir no trecho' }).click();
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  await expect(leitor).toBeVisible();
  await expect(leitor.getByText('O meu fim evidente era atar as duas pontas')).toBeVisible();
});

test('Ctrl+K acha a nota com "dúvida" e abre no trecho', async ({ page }) => {
  await entrar(page);
  const cartao = page.locator('article.marcacao', { hasText: 'O livro inteiro está nesta frase.' });
  await cartao.getByRole('button', { name: 'Editar nota' }).click();
  await page.getByLabel('Nota', { exact: true }).fill('Ficou uma dúvida aqui.');
  await page.getByRole('button', { name: 'Salvar nota' }).click();
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Buscar', exact: true }).fill('dúvida');
  const opcao = page.getByRole('option', { name: /O meu fim evidente/ });
  await expect(opcao).toBeVisible();
  await opcao.click();
  await expect(page.getByRole('dialog', { name: 'Lendo Dom Casmurro' })).toBeVisible();
});
