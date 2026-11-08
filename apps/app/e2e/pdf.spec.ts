// O motor de PDF de verdade, no Chromium: um PDF de 30 páginas gerado aqui, servido com Range (206).
import { expect, test, type Page } from '@playwright/test';

const PAGINAS = 30;

/** Escreve um PDF simples à mão: cada página com o texto "Página N" (sem acento, fonte Helvetica). */
function gerarPdf(n: number): Buffer {
  const objs: string[] = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = Array.from({ length: n }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  for (let i = 0; i < n; i++) {
    const conteudo = `BT /F1 48 Tf 72 700 Td (Pagina ${i + 1}) Tj ET`;
    objs[4 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objs[5 + i * 2] = `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`;
  }
  // enchimento (300 KB) pra o arquivo passar do tamanho do pedaço e o pdf.js usar Range de verdade
  const enchimento = 'x'.repeat(300_000);
  objs[4 + n * 2] = `<< /Length ${enchimento.length} >>\nstream\n${enchimento}\nendstream`;
  let saida = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = saida.length;
    saida += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = saida.length;
  saida += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) saida += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  saida += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(saida, 'latin1');
}

async function servirPdf(page: Page, pdf: Buffer) {
  const pedidos: string[] = [];
  await page.route('**/teste.pdf', async (rota) => {
    const range = rota.request().headers()['range'];
    const cab = { 'accept-ranges': 'bytes', 'content-type': 'application/pdf' };
    const m = range && /bytes=(\d+)-(\d*)/.exec(range);
    if (!m) return rota.fulfill({ status: 200, headers: cab, body: pdf });
    pedidos.push(range);
    const ini = Number(m[1]);
    const fim = Math.min(pdf.length - 1, m[2] ? Number(m[2]) : pdf.length - 1);
    return rota.fulfill({
      status: 206,
      headers: { ...cab, 'content-range': `bytes ${ini}-${fim}/${pdf.length}` },
      body: pdf.subarray(ini, fim + 1),
    });
  });
  return pedidos;
}

const abrir = async (page: Page, tamanho: number, posicao?: string) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  const q = new URLSearchParams({ dev: 'pdf', url: '/teste.pdf', tamanho: String(tamanho) });
  if (posicao) q.set('posicao', posicao);
  await page.goto(`/?${q}`);
  await expect(page.locator('#estado')).toHaveText('pronto', { timeout: 15_000 });
  return erros;
};

test('PDF: abre pela página 1, rola, muda a posição e reabre na página certa', async ({ page }) => {
  const pdf = gerarPdf(PAGINAS);
  const pedidos = await servirPdf(page, pdf);
  const erros = await abrir(page, pdf.length);

  const p1 = page.locator('.fl-pdf-pagina[data-pagina="1"]');
  await expect(p1.locator('canvas')).toBeVisible({ timeout: 15_000 });
  // desenhou de verdade: tem pixel escuro (o texto) num fundo branco
  const escuros = await p1.locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! < 100) n++;
    return n;
  });
  expect(escuros).toBeGreaterThan(200);
  // só as páginas perto da tela têm canvas
  expect(await page.locator('.fl-pdf-canvas').count()).toBeLessThanOrEqual(6);
  expect(pedidos.length).toBeGreaterThan(0);

  // rolar até a página 20 muda a posição
  await page.evaluate(() => {
    const r = document.querySelector('.fl-pdf')!;
    r.scrollTop = (document.querySelector('[data-pagina="20"]') as HTMLElement).offsetTop + 100;
  });
  await expect(page.locator('#posicao')).toHaveText(/^20:/, { timeout: 5000 });
  await expect(page.locator('.fl-pdf-pagina[data-pagina="20"] canvas')).toBeVisible({ timeout: 15_000 });
  // a página 1 ficou longe: o canvas dela foi liberado
  await expect(p1.locator('canvas')).toHaveCount(0, { timeout: 5000 });
  const posicao = (await page.locator('#posicao').textContent())!;

  // reabrir com a posição volta na mesma página
  await page.goto('about:blank');
  await abrir(page, pdf.length, posicao);
  await expect(page.locator('#posicao')).toHaveText(/^20:/, { timeout: 5000 });
  await expect(page.locator('.fl-pdf-pagina[data-pagina="20"] canvas')).toBeVisible({ timeout: 15_000 });
  expect(erros).toEqual([]);
});

test('PDF: arquivo que não é PDF dá erro com código', async ({ page }) => {
  await page.route('**/teste.pdf', (rota) =>
    rota.fulfill({ status: 200, headers: { 'content-type': 'application/pdf' }, body: Buffer.from('isto não é pdf') }),
  );
  await page.goto('/?dev=pdf&url=/teste.pdf&tamanho=14');
  await expect(page.locator('#estado')).toHaveText(/erro PDF_ILEGIVEL/, { timeout: 15_000 });
});
