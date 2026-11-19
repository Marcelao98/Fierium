// Apoio dos e2e do leitor: abre o Dom Casmurro do exemplo com um PDF ou um EPUB gerado pelo teste (nunca um livro de
// verdade) e devolve a casca do leitor.
import { expect, type Page } from '@playwright/test';
import { epubDeTeste, gerarPdf } from './arquivos';

export const PRINTS = 'e2e/prints';

export async function abrirLeitor(page: Page, formato: 'pdf' | 'epub', primeira: boolean) {
  const erros: string[] = [];
  if (primeira) page.on('pageerror', (e) => erros.push(String(e)));
  if (primeira && formato === 'pdf') {
    const pdf = gerarPdf(6);
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
  } else if (primeira) {
    await page.route('**/livro.epub', (r) => r.fulfill({ body: epubDeTeste(), contentType: 'application/epub+zip' }));
    await page.goto(`/?novo=1&${new URLSearchParams({ arquivo: 'epub', arquivoUrl: '/livro.epub' })}`);
  }
  if (primeira) {
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
    await expect(page.getByRole('heading', { name: 'Dom Casmurro' })).toBeVisible({ timeout: 10_000 });
  }
  await page.getByRole('button', { name: 'Continuar' }).click();
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  if (formato === 'pdf')
    await expect(page.locator('.fl-pdf-pagina[data-pagina="1"][data-texto="sim"]')).toBeAttached({ timeout: 15_000 });
  else
    await expect(page.frameLocator('iframe').first().getByRole('heading', { name: 'Capítulo 1' })).toBeVisible({
      timeout: 15_000,
    });
  return { leitor, erros };
}
