// Pastas de livros nos Ajustes, no navegador (exemplo em memória).
import { expect, test } from '@playwright/test';

test('Ajustes: adicionar pasta, procurar livros, ver o resultado e remover', async ({ page }) => {
  await page.goto('/?novo=1');
  await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
  await expect(page.getByText('Continuar lendo')).toBeVisible({ timeout: 10_000 });
  await page
    .getByRole('link', { name: /Ajustes/ })
    .or(page.getByRole('button', { name: /Ajustes/ }))
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  const campo = page.getByLabel('Caminho da pasta');
  await campo.fill('livros sem barra');
  await campo.press('Enter');
  await expect(page.getByRole('alert')).toContainText('não é um caminho');
  await campo.fill('/home/x/Livros');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.getByText('/home/x/Livros')).toBeVisible();
  await expect(page.locator('.pastas-resultado')).toContainText('novos');
  await page.getByRole('button', { name: 'Procurar livros agora' }).click();
  await expect(page.locator('.pastas-resultado')).toContainText(/0 novos · 0 livros · \d+\.\d s/);
  await page.getByRole('button', { name: 'Remover /home/x/Livros' }).click();
  await expect(page.getByText('Nenhuma pasta ainda.')).toBeVisible();
});
