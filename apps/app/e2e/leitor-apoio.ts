// Apoio dos e2e do leitor: abre o Dom Casmurro do exemplo com um PDF ou um EPUB gerado pelo teste (nunca um livro de
// verdade) e devolve a casca do leitor.
import { expect, type Page } from '@playwright/test';
import { epubDeTeste, gerarPdf } from './arquivos';

export const PRINTS = 'e2e/prints';

export interface OpcoesLeitor {
  /** PDF: quantas páginas e quantas linhas de texto em cada uma */
  paginas?: number;
  linhas?: number;
  /** EPUB: com capítulo cheio de código malicioso */
  hostil?: boolean;
  /** espera tanto (ms) antes de abrir o livro, pra medir a abertura com o app já parado */
  acalmar?: number;
}

/** Devolve também `ms`: o tempo do clique em Continuar até o conteúdo (1ª página do PDF ou capítulo 1) aparecer. */
export async function abrirLeitor(page: Page, formato: 'pdf' | 'epub', primeira: boolean, opcoes: OpcoesLeitor = {}) {
  const erros: string[] = [];
  if (primeira) page.on('pageerror', (e) => erros.push(String(e)));
  if (primeira && formato === 'pdf') {
    const pdf = gerarPdf(opcoes.paginas ?? 6, opcoes.linhas ?? 1);
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
    await page.route('**/livro.epub', (r) =>
      r.fulfill({ body: epubDeTeste(opcoes.hostil), contentType: 'application/epub+zip' }),
    );
    await page.goto(`/?novo=1&${new URLSearchParams({ arquivo: 'epub', arquivoUrl: '/livro.epub' })}`);
  }
  if (primeira) {
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
    await expect(page.getByRole('heading', { name: 'Dom Casmurro' })).toBeVisible({ timeout: 10_000 });
  }
  if (opcoes.acalmar) await page.waitForTimeout(opcoes.acalmar);
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Continuar' }).click();
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  if (formato === 'pdf')
    await expect(page.locator('.fl-pdf-pagina[data-pagina="1"][data-texto="sim"]')).toBeAttached({ timeout: 15_000 });
  else
    await expect(page.frameLocator('iframe').first().getByRole('heading', { name: 'Capítulo 1' })).toBeVisible({
      timeout: 15_000,
    });
  return { leitor, erros, ms: Date.now() - t0 };
}
