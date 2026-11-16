// O menu do botão direito do leitor e o painel "Notas deste livro", de ponta a ponta (PDF e EPUB): selecionar → botão
// direito → "Salvar como citação"; selecionar → "Anotar…" com nota; fechar e reabrir (pintadas no lugar); botão direito
// na marcação → trocar cor, copiar como citação, apagar; painel; e a citação salva aparece em Notas → Citações.
import { expect, test, type Page } from '@playwright/test';
import { abrirLeitor, PRINTS } from './leitor-apoio';

const direito = (page: Page, x: number, y: number) => page.mouse.click(x, y, { button: 'right' });

async function citacoesNasNotas(page: Page, trecho: string) {
  // fecha o leitor e confere a aba Citações das Notas
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  await expect(async () => {
    await page.keyboard.press('Escape'); // fecha o que estiver aberto (painel, balão) e por fim o leitor
    await expect(leitor).toBeHidden({ timeout: 700 });
  }).toPass({ timeout: 8000 });
  await page.getByRole('navigation').getByRole('button', { name: 'Notas' }).first().click();
  await page.getByRole('tab', { name: /^Citações/ }).click();
  await expect(page.locator('figure.citacao', { hasText: trecho }).first()).toBeVisible();
}

async function lerCitacaoCopiada(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test('PDF: menu do botão direito, notas deste livro e citação nas Notas', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { leitor, erros } = await abrirLeitor(page, 'pdf', true);
  const marcas = page.locator('.fl-pdf-pagina[data-pagina="1"] .fl-pdf-marca');
  const ids = () => marcas.evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).dataset.id!))]);
  const antes = await ids();
  const span = page.locator('.fl-pdf-pagina[data-pagina="1"] .fl-pdf-texto span').first();
  const caixa = (await span.boundingBox())!;
  const y = caixa.y + caixa.height / 2;
  const arrastar = async (de: number, ate: number) => {
    await page.mouse.move(caixa.x + caixa.width * de, y);
    await page.mouse.down();
    await page.mouse.move(caixa.x + caixa.width * ate, y, { steps: 8 });
    await page.mouse.up();
  };
  const menu = page.getByRole('menu');

  // 1) selecionar → botão direito → Salvar como citação (o menu do WebKit não aparece: o nosso sim)
  await arrastar(0.02, 0.42);
  await expect(page.getByRole('dialog', { name: 'Marcar trecho' })).toBeVisible();
  await direito(page, caixa.x + caixa.width * 0.2, y);
  await expect(menu).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Marcar trecho' })).toBeHidden();
  for (const nome of [/^Anotar/, /^Salvar como citação/, /^Copiar Ctrl\+C$/, /^Copiar como citação/])
    await expect(menu.getByRole('menuitem', { name: nome })).toBeVisible();
  await page.waitForTimeout(400); // a animação do menu termina
  await page.screenshot({ path: `${PRINTS}/m7-menu-selecao-pdf.png` });
  await menu.getByRole('menuitem', { name: 'Salvar como citação' }).click();
  await expect(menu).toBeHidden();
  await expect.poll(async () => (await ids()).length).toBe(antes.length + 1);
  const citada = (await ids()).find((id) => !antes.includes(id))!;

  // 2) selecionar outro pedaço → Anotar… (abre o balão com o cursor na nota) → escrever
  await arrastar(0.58, 0.98);
  await expect(page.getByRole('dialog', { name: 'Marcar trecho' })).toBeVisible();
  await direito(page, caixa.x + caixa.width * 0.8, y);
  await menu.getByRole('menuitem', { name: 'Anotar…' }).click();
  const balao = page.getByRole('dialog', { name: 'Marcação' });
  await expect(balao.getByLabel('Nota da marcação')).toBeFocused();
  await page.keyboard.type('Reler depois');
  await balao.getByText('Pronto').click();
  await expect.poll(async () => (await ids()).length).toBe(antes.length + 2);
  const anotada = (await ids()).find((id) => !antes.includes(id) && id !== citada)!;

  // 3) fechar e reabrir: as duas marcações voltam pintadas no lugar
  await page.keyboard.press('Escape');
  await expect(leitor).toBeHidden();
  await abrirLeitor(page, 'pdf', false);
  await expect.poll(ids).toEqual(expect.arrayContaining([citada, anotada]));

  // 4) botão direito em cima de uma marcação: menu da marcação
  const centro = async (id: string) => {
    const b = (await page
      .locator(`.fl-pdf-pagina[data-pagina="1"] .fl-pdf-marca[data-id="${id}"]`)
      .first()
      .boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  let c = await centro(citada);
  await direito(page, c.x, c.y);
  for (const nome of ['Editar nota', 'Copiar trecho', 'Copiar como citação', 'Apagar marcação'])
    await expect(menu.getByRole('menuitem', { name: nome })).toBeVisible();
  await page.waitForTimeout(400); // a animação do menu termina
  await page.screenshot({ path: `${PRINTS}/m7-menu-marcacao-pdf.png` });
  await menu.getByRole('menuitem', { name: 'Copiar como citação' }).click();
  const copiada = await lerCitacaoCopiada(page);
  expect(copiada).toMatch(/^“.+” — .*\*Dom Casmurro\*, p\. 1$/);
  const trecho = /^“(.+)”/.exec(copiada)![1]!;

  // trocar a cor da anotada
  const estiloAntes = await marcas.locator(`xpath=self::*[@data-id="${anotada}"]`).first().getAttribute('style');
  c = await centro(anotada);
  await direito(page, c.x, c.y);
  await menu.getByRole('menuitemradio', { name: 'Dúvida' }).click();
  await expect
    .poll(() => marcas.locator(`xpath=self::*[@data-id="${anotada}"]`).first().getAttribute('style'))
    .not.toBe(estiloAntes);

  // 5) sem seleção: menu da página → Notas deste livro lista, filtra e leva ao trecho
  const pg = (await page.locator('.fl-pdf-pagina[data-pagina="1"]').boundingBox())!;
  await direito(page, pg.x + pg.width * 0.5, Math.min(pg.y + pg.height * 0.9, 700));
  for (const nome of ['Marcar esta página', 'Notas deste livro', 'Tema da página…', 'Copiar o número da página'])
    await expect(menu.getByRole('menuitem', { name: nome })).toBeVisible();
  await page.waitForTimeout(400); // a animação do menu termina
  await page.screenshot({ path: `${PRINTS}/m7-menu-pagina-pdf.png` });
  await menu.getByRole('menuitem', { name: 'Notas deste livro' }).click();
  const painel = page.getByRole('complementary', { name: 'Notas deste livro' });
  await expect(painel.getByText('Reler depois')).toBeVisible();
  await painel.getByLabel('Buscar nas notas deste livro').fill('reler');
  await expect(painel.locator('li')).toHaveCount(1);
  await page.waitForTimeout(400); // a animação do menu termina
  await page.screenshot({ path: `${PRINTS}/m7-notas-do-livro-pdf.png` });
  await painel.locator('li .painel-marcacao').first().click();
  await expect(page.locator(`.fl-pdf-marca[data-id="${anotada}"][data-selecionada="true"]`).first()).toBeAttached();

  // 6) apagar pelo menu da marcação
  await page.keyboard.press('Escape'); // fecha o painel
  c = await centro(anotada);
  await direito(page, c.x, c.y);
  await menu.getByRole('menuitem', { name: 'Apagar marcação' }).click();
  await expect.poll(async () => (await ids()).includes(anotada)).toBe(false);

  // 7) a citação salva está em Notas → Citações
  await citacoesNasNotas(page, trecho);
  expect(erros).toEqual([]);
});

test('EPUB: menu do botão direito, notas deste livro e citação nas Notas', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { leitor, erros } = await abrirLeitor(page, 'epub', true);
  const texto = page.frameLocator('iframe').first();
  const realces = page.locator('.fl-realce');
  const ids = () => realces.evaluateAll((els) => [...new Set(els.map((e) => (e as SVGElement).dataset.id!))]);
  const antes = await ids();
  const menu = page.getByRole('menu');

  const selecionar = async (n: number) => {
    await texto
      .locator('p')
      .nth(n)
      .evaluate((p) => {
        const t = p.firstChild!;
        const r = document.createRange();
        r.setStart(t, 0);
        r.setEnd(t, 'Parágrafo 1 do capítulo 1'.length);
        const s = p.ownerDocument.getSelection()!;
        s.removeAllRanges();
        s.addRange(r);
      });
    await expect(page.getByRole('dialog', { name: 'Marcar trecho' })).toBeVisible();
    const b = (await texto.locator('p').nth(n).boundingBox())!;
    return { x: b.x + 30, y: b.y + 8 };
  };

  // 1) selecionar → botão direito → Salvar como citação
  let p = await selecionar(0);
  await direito(page, p.x, p.y);
  await expect(menu).toBeVisible();
  for (const nome of [/^Anotar/, /^Salvar como citação/, /^Copiar Ctrl\+C$/, /^Copiar como citação/])
    await expect(menu.getByRole('menuitem', { name: nome })).toBeVisible();
  await page.waitForTimeout(400); // a animação do menu termina
  await page.screenshot({ path: `${PRINTS}/m7-menu-selecao-epub.png` });
  await menu.getByRole('menuitem', { name: 'Salvar como citação' }).click();
  await expect.poll(async () => (await ids()).length).toBe(antes.length + 1);
  const citada = (await ids()).find((id) => !antes.includes(id))!;

  // 2) outro parágrafo → Anotar…
  p = await selecionar(1);
  await direito(page, p.x, p.y);
  await menu.getByRole('menuitem', { name: 'Anotar…' }).click();
  const balao = page.getByRole('dialog', { name: 'Marcação' });
  await expect(balao.getByLabel('Nota da marcação')).toBeFocused();
  await page.keyboard.type('Dragão de novo');
  await balao.getByText('Pronto').click();
  await expect.poll(async () => (await ids()).length).toBe(antes.length + 2);
  const anotada = (await ids()).find((id) => !antes.includes(id) && id !== citada)!;

  // 3) fechar e reabrir
  await page.keyboard.press('Escape');
  await expect(leitor).toBeHidden();
  await abrirLeitor(page, 'epub', false);
  await expect.poll(ids).toEqual(expect.arrayContaining([citada, anotada]));

  // 4) botão direito na marcação: copiar como citação, trocar cor
  const noParagrafo = async (n: number) => {
    const b = (await page.frameLocator('iframe').first().locator('p').nth(n).boundingBox())!;
    return { x: b.x + 30, y: b.y + 8 };
  };
  p = await noParagrafo(0);
  await direito(page, p.x, p.y);
  for (const nome of ['Editar nota', 'Copiar trecho', 'Copiar como citação', 'Apagar marcação'])
    await expect(menu.getByRole('menuitem', { name: nome })).toBeVisible();
  await page.waitForTimeout(400); // a animação do menu termina
  await page.screenshot({ path: `${PRINTS}/m7-menu-marcacao-epub.png` });
  await menu.getByRole('menuitem', { name: 'Copiar como citação' }).click();
  const copiada = await lerCitacaoCopiada(page);
  expect(copiada).toMatch(/^“.+” — .*\*Dom Casmurro\*$/); // EPUB não tem número de página
  const trecho = /^“(.+)”/.exec(copiada)![1]!;

  const fill = () => realces.locator(`xpath=self::*[@data-id="${anotada}"]`).first().getAttribute('fill');
  const corAntes = await fill();
  p = await noParagrafo(1);
  await direito(page, p.x, p.y);
  await menu.getByRole('menuitemradio', { name: 'Dúvida' }).click();
  await expect.poll(fill).not.toBe(corAntes);

  // 5) página: menu sem seleção (sem "copiar o número da página" no EPUB) e o painel Notas deste livro
  const margem = (await page.locator('.fl-epub').boundingBox())!;
  await direito(page, margem.x + 8, margem.y + margem.height - 8);
  await expect(menu.getByRole('menuitem', { name: 'Marcar esta página' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Copiar o número da página' })).toHaveCount(0);
  await page.waitForTimeout(400); // a animação do menu termina
  await page.screenshot({ path: `${PRINTS}/m7-menu-pagina-epub.png` });
  await menu.getByRole('menuitem', { name: 'Notas deste livro' }).click();
  const painel = page.getByRole('complementary', { name: 'Notas deste livro' });
  await expect(painel.getByText('Dragão de novo')).toBeVisible();
  await painel.getByRole('button', { name: /Todas/ }).click();
  await page.waitForTimeout(400); // a animação do menu termina
  await page.screenshot({ path: `${PRINTS}/m7-notas-do-livro-epub.png` });
  await painel.locator('li .painel-marcacao', { hasText: 'Dragão de novo' }).click();

  // apagar daqui mesmo, pelo painel
  await painel.locator('li', { hasText: 'Dragão de novo' }).getByRole('button', { name: 'Apagar marcação' }).click();
  await expect.poll(async () => (await ids()).includes(anotada)).toBe(false);

  // 6) a citação salva está em Notas → Citações
  await citacoesNasNotas(page, trecho);
  expect(erros).toEqual([]);
});
