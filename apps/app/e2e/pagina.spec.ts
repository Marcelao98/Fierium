// Temas da página: o painel "Página" do leitor e a repintura de verdade do PDF (pixels) no Chromium.
import { expect, test, type Page } from '@playwright/test';

const PRINTS = 'e2e/prints';

/** Um PDF simples: texto preto grande sobre o branco da página. */
function gerarPdf(n: number): Buffer {
  const objs: string[] = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = Array.from({ length: n }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  for (let i = 0; i < n; i++) {
    const conteudo = `BT /F1 120 Tf 72 600 Td (HHHH) Tj ET`;
    objs[4 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objs[5 + i * 2] = `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`;
  }
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

async function servir(page: Page, pdf: Buffer) {
  await page.route('**/teste.pdf', async (rota) => {
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
}

/** O pixel do fundo (canto da página) e o do texto (o mais distante do fundo) do canvas da página 1. */
async function amostrar(page: Page) {
  return page.locator('.fl-pdf-pagina[data-pagina="1"] canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const fundo = [d[0]!, d[1]!, d[2]!];
    let melhor = 0;
    let texto = fundo;
    for (let i = 0; i < d.length; i += 4) {
      const dist = Math.abs(d[i]! - fundo[0]!) + Math.abs(d[i + 1]! - fundo[1]!) + Math.abs(d[i + 2]! - fundo[2]!);
      if (dist > melhor) {
        melhor = dist;
        texto = [d[i]!, d[i + 1]!, d[i + 2]!];
      }
    }
    return { fundo, texto };
  });
}

const perto = (a: number[], b: number[], tol = 3) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);

test.describe('PDF repintado pelo tema', () => {
  test.use({ deviceScaleFactor: 2 });

  test('Noite, tema personalizado e reabrir; mede o tempo de repintar uma página A4 em 2×', async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(String(e)));
    const pdf = gerarPdf(3);
    await servir(page, pdf);
    await page.goto(`/?dev=pdf&url=/teste.pdf&tamanho=${pdf.length}&tema=noite`);
    await expect(page.locator('#estado')).toHaveText('pronto', { timeout: 15_000 });
    await expect(page.locator('.fl-pdf-pagina[data-pagina="1"] canvas')).toBeVisible({ timeout: 15_000 });

    // Noite: papel #141414, letra #d6d6d6
    const noite = await amostrar(page);
    expect(perto(noite.fundo, [0x14, 0x14, 0x14])).toBe(true);
    expect(perto(noite.texto, [0xd6, 0xd6, 0xd6])).toBe(true);

    // tema personalizado, sem recarregar o arquivo: papel #102030, letra #f0e0c0
    await page.evaluate(() =>
      (window as unknown as { __aplicarPagina(p: object): void }).__aplicarPagina({
        tema: 'personalizado',
        papel: '#102030',
        tinta: '#f0e0c0',
      }),
    );
    await expect
      .poll(async () => perto((await amostrar(page)).fundo, [0x10, 0x20, 0x30]), { timeout: 5000 })
      .toBe(true);
    const livre = await amostrar(page);
    expect(perto(livre.texto, [0xf0, 0xe0, 0xc0])).toBe(true);
    // o canvas em volta acompanha o papel
    const fundoAoRedor = await page.locator('.fl-pdf').evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(fundoAoRedor).not.toBe('rgb(74, 74, 79)');

    // tempo de repintar (a página tem ~2,4 milhões de pixels em 2×)
    await page.evaluate(() =>
      (window as unknown as { __aplicarPagina(p: object): void }).__aplicarPagina({ tema: 'sepia', papel: undefined }),
    );
    const ms = Number(await page.locator('.fl-pdf').getAttribute('data-pintura-ms'));
    const px = await page
      .locator('.fl-pdf-pagina[data-pagina="1"] canvas')
      .evaluate((c: HTMLCanvasElement) => c.width * c.height);
    console.log(`REPINTURA: ${ms} ms por página (${px} pixels)`);
    expect(ms).toBeGreaterThan(0);

    // "Original" volta aos pixels crus do pdf.js (branco e preto)
    await page.evaluate(() =>
      (window as unknown as { __aplicarPagina(p: object): void }).__aplicarPagina({ tema: 'original' }),
    );
    await expect.poll(async () => perto((await amostrar(page)).fundo, [255, 255, 255], 0)).toBe(true);
    expect(perto((await amostrar(page)).texto, [0, 0, 0], 0)).toBe(true);

    // reabrir com o tema personalizado vindo da URL
    await page.goto('about:blank');
    await page.goto(
      `/?dev=pdf&url=/teste.pdf&tamanho=${pdf.length}&tema=personalizado&papel=%23102030&tinta=%23f0e0c0`,
    );
    await expect(page.locator('#estado')).toHaveText('pronto', { timeout: 15_000 });
    await expect(page.locator('.fl-pdf-pagina[data-pagina="1"] canvas')).toBeVisible({ timeout: 15_000 });
    expect(perto((await amostrar(page)).fundo, [0x10, 0x20, 0x30])).toBe(true);
    expect(erros).toEqual([]);
  });
});

test('painel Página: trocar o tema, buscar, personalizar, salvar como meu tema e continuar depois de recarregar', async ({
  page,
}) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto('/?novo=1');
  await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  await leitor.getByRole('button', { name: 'Aparência' }).click();
  const painel = page.getByRole('region', { name: 'Página' });

  // grade agrupada: ~100 temas
  expect(await painel.locator('.tema-amostra').count()).toBeGreaterThanOrEqual(95);
  await page.screenshot({ path: `${PRINTS}/5-pagina-grade.png` });

  // busca
  await painel.getByLabel('Buscar tema da página').fill('cafe');
  await expect(painel.getByRole('button', { name: 'Página Café com leite' })).toBeVisible();
  await expect(painel.getByRole('button', { name: 'Página Noite', exact: true })).toHaveCount(0);
  await painel.getByLabel('Buscar tema da página').fill('');

  // escolher Noite
  await painel.getByRole('button', { name: 'Página Noite', exact: true }).click();
  await expect(painel.getByRole('button', { name: 'Página Noite', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // personalizar: papel #102030, letra #f0e0c0; contraste baixo avisa
  await painel.getByRole('button', { name: 'Personalizar' }).click();
  await painel.getByLabel('Cor do papel (hex)').fill('#102030');
  await painel.getByLabel('Cor da letra (hex)').fill('#183048');
  await expect(painel.getByRole('status')).toContainText('Contraste baixo');
  await painel.getByLabel('Cor da letra (hex)').fill('#f0e0c0');
  await expect(painel.getByRole('status')).toHaveCount(0);
  await page.screenshot({ path: `${PRINTS}/6-pagina-personalizar.png` });

  // salvar como meu tema
  await painel.getByLabel('Nome do tema').fill('Azulão');
  await painel.getByRole('button', { name: 'Salvar como meu tema' }).click();
  await expect(painel.getByRole('heading', { name: 'Meus temas' })).toBeVisible();
  await expect(painel.getByRole('button', { name: 'Página Azulão' })).toHaveAttribute('aria-pressed', 'true');

  // recarrega: o tema e "meus temas" continuam
  await page.reload();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('dialog', { name: 'Lendo Dom Casmurro' }).getByRole('button', { name: 'Aparência' }).click();
  await expect(painel.getByRole('button', { name: 'Página Azulão' })).toHaveAttribute('aria-pressed', 'true');

  // renomear e apagar
  await painel.getByRole('button', { name: 'Renomear Azulão' }).click();
  await painel.getByLabel('Novo nome de Azulão').fill('Meu azul');
  await page.keyboard.press('Enter');
  await expect(painel.getByRole('button', { name: 'Página Meu azul' })).toBeVisible();
  await painel.getByRole('button', { name: 'Apagar Meu azul' }).click();
  await expect(painel.getByRole('heading', { name: 'Meus temas' })).toHaveCount(0);
  await expect(painel.getByRole('button', { name: 'Página Sépia', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(erros).toEqual([]);
});
