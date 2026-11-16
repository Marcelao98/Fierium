// Marcações no PDF, no leitor de verdade (casca + motor de PDF + exemplo em memória): selecionar, marcar como Dúvida
// com nota, fechar, reabrir (pintada no mesmo lugar), clicar (balão com a nota), apagar; e uma marcação que cruza páginas.
import { expect, test, type Page } from '@playwright/test';
import { gerarPdf } from './arquivos';

const PRINTS = 'e2e/prints';
const pdf = gerarPdf(6);

async function abrirLeitor(page: Page, primeira: boolean) {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  if (primeira) {
    await page.route('**/livro.pdf', (rota) => {
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
    const q = new URLSearchParams({ arquivo: 'pdf', arquivoUrl: '/livro.pdf', arquivoTamanho: String(pdf.length) });
    await page.goto(`/?novo=1&${q}`);
    await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
    await expect(page.getByRole('heading', { name: 'Dom Casmurro' })).toBeVisible({ timeout: 10_000 });
  }
  await page.getByRole('button', { name: 'Continuar' }).click();
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  await expect(page.locator('.fl-pdf-pagina[data-pagina="1"][data-texto="sim"]')).toBeAttached({ timeout: 15_000 });
  return { leitor, erros };
}

test('PDF: selecionar, marcar como Dúvida com nota, reabrir, clicar e apagar', async ({ page }) => {
  const { leitor, erros } = await abrirLeitor(page, true);

  // arrasta o mouse sobre o texto da página 1
  const span = page.locator('.fl-pdf-pagina[data-pagina="1"] .fl-pdf-texto span').first();
  const caixa = (await span.boundingBox())!;
  await page.mouse.move(caixa.x + 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width - 2, caixa.y + caixa.height / 2, { steps: 8 });
  await page.mouse.up();

  await page.getByRole('dialog', { name: 'Marcar trecho' }).getByText('Dúvida').click();
  const balao = page.getByRole('dialog', { name: 'Marcação' });
  await balao.getByLabel('Nota da marcação').fill('Que página é essa?');
  await balao.getByText('Pronto').click();

  const marca = page.locator('.fl-pdf-pagina[data-pagina="1"] .fl-pdf-marca');
  await expect(marca.first()).toBeVisible();
  await expect(marca.first()).toHaveAttribute('data-nota', 'true');
  const estilo = await marca.first().getAttribute('style');
  await page.screenshot({ path: `${PRINTS}/m1-pdf-marcado.png` });

  // fecha e reabre: a marcação volta no mesmo lugar
  await page.keyboard.press('Escape');
  await expect(leitor).toBeHidden();
  await abrirLeitor(page, false);
  await expect(marca.first()).toBeVisible();
  expect(await marca.first().getAttribute('style')).toBe(estilo);

  // clicar na marcação abre o balão com a nota
  const m = (await marca.first().boundingBox())!;
  await page.mouse.click(m.x + m.width / 2, m.y + m.height / 2);
  const aberto = page.getByRole('dialog', { name: 'Marcação' });
  await expect(aberto.getByLabel('Nota da marcação')).toHaveValue('Que página é essa?');
  await page.screenshot({ path: `${PRINTS}/m1-pdf-balao.png` });

  // apagar some
  await aberto.getByText('Apagar').click();
  await expect(marca).toHaveCount(0);
  expect(erros).toEqual([]);
});

test('PDF: marcação que cruza páginas é uma só; marcador de página pela barra', async ({ page }) => {
  const { leitor, erros } = await abrirLeitor(page, true);
  const contador = leitor.getByRole('button', { name: 'Marcações deste livro' });
  const antes = Number((await contador.textContent())!.trim()); // o exemplo já vem com marcações
  await expect(page.locator('.fl-pdf-pagina[data-pagina="2"][data-texto="sim"]')).toBeAttached({ timeout: 15_000 });

  // seleciona do começo da página 1 ao fim da página 2 e solta como o mouse faria
  await page.evaluate(() => {
    const a = document.querySelector('.fl-pdf-pagina[data-pagina="1"] .fl-pdf-texto span')!.firstChild!;
    const b = document.querySelector('.fl-pdf-pagina[data-pagina="2"] .fl-pdf-texto span')!.firstChild!;
    const r = document.createRange();
    r.setStart(a, 0);
    r.setEnd(b, b.textContent!.length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
    const rolagem = document.querySelector('.fl-pdf')!;
    rolagem.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 400, clientY: 400 }));
  });
  await page.getByRole('dialog', { name: 'Marcar trecho' }).getByText('Importante').click();
  await expect(page.locator('.fl-pdf-pagina[data-pagina="1"] .fl-pdf-marca').first()).toBeVisible();
  await expect(page.locator('.fl-pdf-pagina[data-pagina="2"] .fl-pdf-marca').first()).toBeVisible();
  // uma marcação só
  await expect(contador).toHaveText(new RegExp(`${antes + 1}$`));
  const ids = await page
    .locator('.fl-pdf-marca')
    .evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).dataset.id))]);
  expect(ids).toHaveLength(1);
  await page.keyboard.press('Escape'); // fecha o balão

  // marcador de página: liga e desliga no mesmo lugar
  await leitor.getByRole('button', { name: 'Marcador de página' }).click();
  await expect(contador).toHaveText(new RegExp(`${antes + 2}$`));
  await leitor.getByRole('button', { name: 'Marcador de página' }).click();
  await expect(contador).toHaveText(new RegExp(`${antes + 1}$`));
  expect(erros).toEqual([]);
});
