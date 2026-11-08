// O motor de EPUB num Chromium de verdade: gera um EPUB mínimo no próprio teste, serve por page.route e confere
// capítulo 1, próximo capítulo e reabrir pelo CFI.
import { crc32 } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';

/** Zip "stored" (sem compressão) feito à mão: o bastante pro EPUB (o mimetype tem de ser o primeiro, sem compressão). */
function zip(arquivos: [string, string][]): Buffer {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;
  for (const [nome, texto] of arquivos) {
    const n = Buffer.from(nome);
    const d = Buffer.from(texto);
    const crc = crc32(d);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(d.length, 18);
    h.writeUInt32LE(d.length, 22);
    h.writeUInt16LE(n.length, 26);
    partes.push(h, n, d);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(d.length, 20);
    c.writeUInt32LE(d.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(deslocamento, 42);
    central.push(c, n);
    deslocamento += h.length + n.length + d.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamCentral, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...partes, ...central, fim]);
}

function epubDeTeste(): Buffer {
  const cap = (n: number) =>
    `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulo ${n}</title></head><body><h1>Capítulo ${n}</h1>${Array.from(
      { length: 40 },
      (_, i) => `<p>Parágrafo ${i + 1} do capítulo ${n}: o dragão dormia sobre o ouro da montanha.</p>`,
    ).join('')}</body></html>`;
  return zip([
    ['mimetype', 'application/epub+zip'],
    [
      'META-INF/container.xml',
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ],
    [
      'OEBPS/content.opf',
      `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">teste-1</dc:identifier><dc:title>Livro de Teste</dc:title><dc:language>pt-BR</dc:language><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${[1, 2, 3].map((n) => `<item id="c${n}" href="c${n}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${[1, 2, 3].map((n) => `<itemref idref="c${n}"/>`).join('')}</spine></package>`,
    ],
    [
      'OEBPS/nav.xhtml',
      '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Sumário</title></head><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">Capítulo 1</a></li><li><a href="c2.xhtml">Capítulo 2</a></li><li><a href="c3.xhtml">Capítulo 3</a></li></ol></nav></body></html>',
    ],
    ['OEBPS/c1.xhtml', cap(1)],
    ['OEBPS/c2.xhtml', cap(2)],
    ['OEBPS/c3.xhtml', cap(3)],
  ]);
}

async function abrir(page: Page, cfi?: string) {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.route('**/livro-teste.epub', (r) =>
    r.fulfill({ body: epubDeTeste(), contentType: 'application/epub+zip' }),
  );
  const q = `?dev=epub&url=${encodeURIComponent('/livro-teste.epub')}${cfi ? `&cfi=${encodeURIComponent(cfi)}` : ''}`;
  await page.goto(`/${q}`);
  return erros;
}

const leitura = (page: Page) => page.frameLocator('iframe').first();
const estado = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __epub?: { posicao: string; fracao: number; erro: string } }).__epub ?? {
        posicao: '',
        fracao: 0,
        erro: '',
      },
  );

test('EPUB: abre o capítulo 1, passa pro próximo e reabre pelo CFI', async ({ page }) => {
  const erros = await abrir(page);
  await expect(leitura(page).getByRole('heading', { name: 'Capítulo 1' })).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await estado(page)).posicao).toContain('epubcfi');
  expect((await estado(page)).erro).toBe('');

  await page.getByRole('button', { name: 'Próximo capítulo' }).click();
  await expect(leitura(page).getByRole('heading', { name: 'Capítulo 2' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(leitura(page).getByRole('heading', { name: 'Capítulo 3' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(leitura(page).getByRole('heading', { name: 'Capítulo 2' })).toBeVisible();

  const cfi = (await estado(page)).posicao;
  expect(cfi).toContain('epubcfi');
  await page.screenshot({ path: 'e2e/prints/epub-capitulo2.png' });

  await abrir(page, cfi);
  await expect(leitura(page).getByRole('heading', { name: 'Capítulo 2' })).toBeVisible({ timeout: 15_000 });
  await expect(leitura(page).getByRole('heading', { name: 'Capítulo 1' })).toHaveCount(0);
  expect(erros).toEqual([]);
});

test('EPUB: arquivo ilegível vira erro com código', async ({ page }) => {
  await page.route('**/ruim.epub', (r) =>
    r.fulfill({ body: 'isto não é um zip', contentType: 'application/epub+zip' }),
  );
  await page.goto(`/?dev=epub&url=${encodeURIComponent('/ruim.epub')}`);
  await expect.poll(async () => (await estado(page)).erro).toContain('EPUB_ILEGIVEL');
});
