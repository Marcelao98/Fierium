// O caminho da pessoa, ponta a ponta, no Chromium, com a biblioteca de exemplo (adaptador em memória).
import { expect, test, type Page } from '@playwright/test';

const PRINTS = 'e2e/prints';

async function entrar(page: Page, largura = 1280) {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  await page.setViewportSize({ width: largura, height: largura > 800 ? 800 : 860 });
  await page.goto('/?novo=1');
  await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
  await expect(page.getByText('Continuar lendo')).toBeVisible({ timeout: 10_000 });
  return erros;
}

test('abertura → início → ler → marcar com nota → Notas → recarregar e continua lá', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto('/?novo=1');
  await expect(page.getByRole('heading', { name: 'Fierium' })).toBeVisible();
  await page.screenshot({ path: `${PRINTS}/1-abertura.png` });
  await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Dom Casmurro' })).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${PRINTS}/2-inicio.png` });

  await page.getByRole('button', { name: 'Continuar' }).click();
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  await expect(leitor.getByText('II — Do livro')).toBeVisible();
  // seleciona um trecho do primeiro parágrafo do capítulo II e marca como "Dúvida"
  await page.evaluate(() => {
    const p = document.querySelector('p[data-cap="1"][data-par="0"]')!;
    p.scrollIntoView({ block: 'center', behavior: 'instant' });
    const t = p.firstChild!;
    const r = document.createRange();
    r.setStart(t, 0);
    r.setEnd(t, 'Agora que expliquei o título'.length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.getByRole('dialog', { name: 'Marcar trecho' }).getByText('Dúvida').click();
  const balao = page.getByRole('dialog', { name: 'Marcação' });
  await balao.getByLabel('Nota da marcação').fill('Que título?');
  await page.screenshot({ path: `${PRINTS}/3-leitor-marcando.png` });
  await balao.getByText('Pronto').click();
  const marca = page.locator('mark[data-nota="true"]', { hasText: 'Agora que expliquei o título' });
  await expect(marca).toBeVisible();
  // o pergaminho (tema padrão): a página com moldura, a marcação em ouro e o anel de progresso
  await marca.click();
  await expect(page.getByRole('dialog', { name: 'Marcação' })).toBeVisible();
  await expect(leitor.getByRole('status')).toContainText('%');
  await page.screenshot({ path: `${PRINTS}/3b-leitor-pergaminho.png` });
  await page.keyboard.press('Escape');

  await leitor.getByRole('button', { name: 'Aparência' }).click();
  await page.getByRole('button', { name: 'Sépia' }).click();
  // fora do pergaminho, o anel some e a barra de progresso volta
  await expect(leitor.getByRole('status')).toHaveCount(0);
  await expect(leitor.locator('.leitor-progresso')).toBeVisible();
  await page.screenshot({ path: `${PRINTS}/4-leitor-sepia.png` });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(leitor).toBeHidden();

  await page.getByRole('navigation').getByRole('button', { name: 'Notas' }).first().click();
  await expect(page.getByText('“Agora que expliquei o título”')).toBeVisible();
  await expect(page.getByText('Que título?')).toBeVisible();
  await page.screenshot({ path: `${PRINTS}/5-notas.png` });

  await page.reload();
  await expect(page.getByText('“Agora que expliquei o título”')).toBeVisible();
  expect(erros).toEqual([]);
});

test('biblioteca: busca sem acento, filtros, lista e mapa com deriva', async ({ page }) => {
  const erros = await entrar(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Biblioteca' }).first().click();
  await page.getByLabel('Buscar na biblioteca').fill('postumas');
  await expect(page.getByRole('button', { name: /^Memórias Póstumas de Brás Cubas/ })).toBeVisible();
  await expect(page.getByText('1 obra', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar na biblioteca').fill('');
  await page.getByRole('button', { name: 'Lidas', exact: true }).click();
  await page.screenshot({ path: `${PRINTS}/6-biblioteca.png` });
  await page.getByRole('button', { name: 'Mapa' }).click();
  await expect(page.getByRole('img', { name: /Mapa da biblioteca: 40 obras/ })).toBeVisible();
  await page.getByRole('button', { name: 'Deriva' }).click();
  await expect(page.getByRole('status').filter({ hasText: /nunca aberta|Uma obra/ })).toBeVisible();
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${PRINTS}/7-mapa-deriva.png` });
  expect(erros).toEqual([]);
});

test('obra, coleções, estatísticas com meta nova e tema claro', async ({ page }) => {
  const erros = await entrar(page);
  await page.getByRole('button', { name: 'Sobre a obra' }).click();
  await expect(page.getByRole('heading', { name: 'Edições e arquivos' })).toBeVisible();
  await page.screenshot({ path: `${PRINTS}/8-obra.png`, fullPage: true });
  await page.getByRole('navigation').getByRole('button', { name: 'Coleções' }).click();
  await page.getByText('Os antigos').click();
  await expect(page.getByRole('heading', { name: 'Os antigos' })).toBeVisible();
  await page.screenshot({ path: `${PRINTS}/9-colecao.png` });
  await page.getByRole('navigation').getByRole('button', { name: 'Estatísticas' }).first().click();
  await expect(page.getByRole('img', { name: /Calendário de leitura/ })).toBeVisible();
  await page.getByLabel('Quanto').fill('300');
  await page.getByRole('button', { name: 'Adicionar meta' }).click();
  await expect(page.getByText('300 páginas por semana')).toBeVisible();
  await page.screenshot({ path: `${PRINTS}/10-estatisticas.png`, fullPage: true });
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Buscar' }).fill('tema claro');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'lucido');
  await page.getByRole('navigation').getByRole('button', { name: 'Início' }).first().click();
  await page.screenshot({ path: `${PRINTS}/11-inicio-claro.png` });
  expect(erros).toEqual([]);
});

test('celular (janela estreita) e inspetor', async ({ page }) => {
  const erros = await entrar(page, 390);
  await page.screenshot({ path: `${PRINTS}/12-celular-inicio.png`, fullPage: true });
  await page.keyboard.press('Control+Shift+D');
  const insp = page.getByRole('complementary', { name: 'Inspetor de depuração' });
  await expect(insp.getByText('biblioteca.limiar').first()).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `${PRINTS}/13-inspetor.png` });
  expect(erros).toEqual([]);
});
