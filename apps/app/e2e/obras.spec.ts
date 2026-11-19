// Obra ≠ arquivo, no navegador (exemplo em memória): juntar duas obras pela página da obra (viram uma, com duas
// edições), abrir uma edição específica e separar de novo.
import { expect, test } from '@playwright/test';

test('Obra: juntar com outra obra, ver as duas edições e separar', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto('/?novo=1');
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Dom Casmurro' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Sobre a obra' }).click();
  await expect(page.locator('.edicao')).toHaveCount(1);
  // uma edição só: não há o que separar
  await expect(page.getByRole('button', { name: /^Separar a edição/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Juntar com outra obra…' }).click();
  await page.getByLabel('Buscar a obra pra juntar').fill('iracema');
  await page.locator('.juntar-item', { hasText: 'Iracema' }).click();
  await expect(page.locator('.edicao')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Dom Casmurro', level: 1 })).toBeVisible();
  await page.screenshot({ path: 'e2e/prints/14-obra-duas-edicoes.png' });

  // a biblioteca mostra uma capa só pras duas
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.goto('/#/biblioteca/grade');
  await page.getByLabel('Buscar na biblioteca').fill('iracema');
  await expect(page.locator('.grade .cartao-obra')).toHaveCount(0);
  await page.getByLabel('Buscar na biblioteca').fill('dom casmurro');
  await page.locator('.cartao-obra', { hasText: 'Dom Casmurro' }).click();
  await expect(page.locator('.edicao')).toHaveCount(2);

  // separar a segunda edição: ela volta a ser uma obra própria (a página vai pra ela)
  await page
    .getByRole('button', { name: /^Separar a edição/ })
    .last()
    .click();
  await expect(page.locator('.edicao')).toHaveCount(1);
  await page.goto('/#/biblioteca/grade');
  await page.getByLabel('Buscar na biblioteca').fill('dom casmurro');
  await expect(page.locator('.grade .cartao-obra')).toHaveCount(2);
  expect(erros).toEqual([]);
});
