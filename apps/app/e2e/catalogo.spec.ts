// O catálogo público em cinza (D30), no navegador com o exemplo em memória: buscar mostra o cinza, a página do autor
// junta colorido e cinza, a ficha, Descobrir, o interruptor de rede e "Corrigir dados".
import { expect, test } from '@playwright/test';

test('Catálogo: cinza na biblioteca, autor, ficha, Descobrir, Ajustes e Corrigir dados', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto('/?novo=1');
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Dom Casmurro' })).toBeVisible({ timeout: 10_000 });

  // 1) buscar "machado": o que a pessoa tem (colorido) e, abaixo, "Pra baixar" (cinza)
  await page.goto('/#/biblioteca/grade');
  await page.getByLabel('Buscar na biblioteca').fill('machado');
  await expect(page.getByRole('heading', { name: 'Pra baixar' })).toBeVisible();
  await expect(page.locator('.grade .cartao-obra').first()).toBeVisible();
  await expect(page.locator('.cartao-cinza', { hasText: 'Quincas Borba' })).toBeVisible();
  await expect(page.locator('.cartao-cinza .selo-licenca').first()).toHaveText('Domínio público');
  await page.screenshot({ path: 'e2e/prints/20-biblioteca-cinza.png' });

  // 2) a página do autor: colorido + cinza, juntos
  await page.locator('.cartao-cinza-autor', { hasText: 'Machado de Assis' }).first().click();
  await expect(page.getByRole('heading', { name: 'Machado de Assis', level: 1 })).toBeVisible();
  await expect(page.locator('.grade .cartao-obra').first()).toBeVisible();
  await expect(page.locator('.grade .cartao-cinza').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/prints/21-autor.png' });

  // 3) a ficha de um cinza; no navegador baixar falha em português, com o caminho pros Ajustes
  await page.locator('.cartao-cinza-corpo', { hasText: 'Quincas Borba' }).click();
  await expect(page.getByRole('heading', { name: 'Quincas Borba', level: 1 })).toBeVisible();
  await expect(page.getByText('Domínio público').first()).toBeVisible();
  await page.getByRole('button', { name: 'Baixar e ler' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Ajustes → Internet' })).toBeVisible();
  await page.screenshot({ path: 'e2e/prints/22-ficha.png' });

  // 4) Descobrir: as coleções prontas
  await page.getByRole('button', { name: 'Descobrir' }).first().click();
  await expect(page.getByRole('heading', { name: 'Clássicos brasileiros' })).toBeVisible();
  for (const t of ['Fantasia e aventura', 'Filosofia', 'Poesia', 'Ciência'])
    await expect(page.getByRole('heading', { name: t })).toBeVisible();
  await expect(page.locator('.prateleira .cartao-cinza').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/prints/23-descobrir.png' });
  await page.getByLabel('Buscar no catálogo').fill('iracema');
  await expect(page.locator('.grade .cartao-cinza', { hasText: 'Iracema' })).toBeVisible();

  // 5) Ajustes: Internet e Catálogos; desligar a rede
  await page.getByRole('button', { name: 'Ajustes' }).first().click();
  await expect(page.getByText('Project Gutenberg')).toBeVisible();
  const rede = page.getByLabel('Permitir internet');
  await expect(rede).toBeChecked();
  await rede.uncheck();
  await expect(rede).not.toBeChecked();
  await expect(page.getByRole('button', { name: /Atualizar Project Gutenberg agora/ })).toBeDisabled();
  await page.screenshot({ path: 'e2e/prints/24-ajustes-internet.png' });

  // 6) Corrigir dados (no exemplo a lista de sugestões é vazia)
  await page.goto('/#/biblioteca/grade');
  await page.getByLabel('Buscar na biblioteca').fill('dom casmurro');
  await page.locator('.cartao-obra', { hasText: 'Dom Casmurro' }).click();
  await page.getByRole('button', { name: 'Corrigir dados…' }).click();
  await expect(page.getByText('É este livro?')).toBeVisible();
  await expect(page.getByText('Nenhuma sugestão por enquanto')).toBeVisible();
  await page.getByRole('button', { name: 'Editar à mão' }).click();
  await expect(page.getByLabel('Título')).toHaveValue('Dom Casmurro');
  await page.screenshot({ path: 'e2e/prints/25-corrigir-dados.png' });

  expect(erros).toEqual([]);
});
