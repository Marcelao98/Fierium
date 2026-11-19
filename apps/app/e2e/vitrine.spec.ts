// A vitrine pra mostrar aos amigos, no Chromium com o exemplo em memória: a primeira abertura em três passos, o painel
// "Mandar sugestão ou problema" (texto copiado), o cartão de citação (PNG gerado de verdade) e o modo mergulho.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const PRINTS = 'e2e/prints';

async function comExemplo(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?novo=1');
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('button', { name: 'Usar a biblioteca de exemplo' }).click();
  await expect(page.getByText('Continuar lendo')).toBeVisible({ timeout: 10_000 });
}

test('primeira abertura: boas-vindas → onde estão os livros → andamento com clássicos → Início', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.setViewportSize({ width: 1280, height: 800 });
  // `?pasta=` faz o "Escolher pasta…" funcionar no navegador (o seletor de verdade só existe no app)
  await page.goto('/?novo=1&pasta=/home/amigo/Livros');
  await expect(page.getByRole('heading', { name: 'Fierium' })).toBeVisible();
  await page.screenshot({ path: `${PRINTS}/v1-boas-vindas.png` });

  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.getByRole('heading', { name: 'Onde estão seus livros?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pular, só quero explorar' })).toBeVisible();
  await page.screenshot({ path: `${PRINTS}/v2-onde-estao.png` });

  await page.getByRole('button', { name: 'Escolher pasta…' }).click();
  await expect(page.getByRole('heading', { name: 'Montando a sua biblioteca' })).toBeVisible();
  // a varredura (no exemplo não acha nada) explica em vez de mostrar lista vazia
  await expect(page.getByText(/Não achei nenhum PDF ou EPUB nessa pasta/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Comece por…' })).toBeVisible();
  const classicos = page.getByRole('region', { name: 'Comece por…' }).getByRole('listitem');
  await expect(classicos.first()).toBeVisible();
  expect(await classicos.count()).toBeLessThanOrEqual(3);
  await page.screenshot({ path: `${PRINTS}/v3-andamento.png` });

  await page.getByRole('button', { name: 'Entrar na biblioteca' }).click();
  await expect(page.getByRole('navigation').first()).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  expect(erros).toEqual([]);
});

test('sem pasta o navegador oferece o exemplo e "Pular" cai direto no Início', async ({ page }) => {
  await page.goto('/?novo=1');
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.getByText(/No navegador não dá pra escolher uma pasta/)).toBeVisible();
  await page.getByRole('button', { name: 'Pular, só quero explorar' }).click();
  await expect(page.getByRole('navigation').first()).toBeVisible();
});

test('mandar sugestão: o texto copiado leva o que a pessoa escreveu, a versão, o sistema e o registro', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route('https://github.com/**', (r) =>
    r.fulfill({ body: '<title>GitHub</title>', contentType: 'text/html' }),
  );
  await comExemplo(page);

  // pelo menu do botão direito do Início
  await page.mouse.click(640, 700, { button: 'right' });
  await page.getByRole('menuitem', { name: /Mandar sugestão ou problema/ }).click();
  const painel = page.getByRole('dialog', { name: 'Mandar sugestão ou problema' });
  await painel.getByLabel('O que você quer contar').fill('A capa do Dom Casmurro ficou cortada');
  await painel.getByText(/O que vai junto/).click();
  await page.screenshot({ path: `${PRINTS}/v4-sugestao.png` });
  await painel.getByRole('button', { name: 'Copiar' }).click();
  await expect(painel.getByText('Copiado.')).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado).toContain('A capa do Dom Casmurro ficou cortada');
  expect(copiado).toMatch(/Fierium \d+\.\d+\.\d+ · /);
  expect(copiado).toContain('Sistema: ');
  expect(copiado).toContain('Últimas linhas do registro do app:');
  expect(copiado).toContain('Fierium aberto');

  // "Abrir no GitHub" abre a issue nova com título e corpo prontos (nunca envia sozinho)
  const [aba] = await Promise.all([
    page.waitForEvent('popup'),
    painel.getByRole('button', { name: 'Abrir no GitHub' }).click(),
  ]);
  const url = new URL(aba.url());
  expect(url.origin + url.pathname).toBe('https://github.com/Marcelao98/Fierium/issues/new');
  expect(url.searchParams.get('title')).toBe('A capa do Dom Casmurro ficou cortada');
  expect(url.searchParams.get('body')).toContain('Últimas linhas');
  await aba.close();
  await painel.getByRole('button', { name: 'Fechar' }).click();
  await expect(painel).toBeHidden();

  // e pelos Ajustes
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes' }).first().click();
  await page.getByRole('button', { name: 'Escrever…' }).click();
  await expect(page.getByRole('dialog', { name: 'Mandar sugestão ou problema' })).toBeVisible();
});

test('cartão de citação: vem das Notas, desenha 1080×1350 e salva um PNG', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await comExemplo(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Notas' }).first().click();
  await page.getByRole('button', { name: 'Compartilhar como imagem' }).first().click();
  const janela = page.getByRole('dialog', { name: 'Compartilhar como imagem' });
  const canvas = janela.getByLabel('Prévia do cartão de citação');
  await expect(canvas).toHaveAttribute('data-pronto', 'true', { timeout: 10_000 });
  expect(await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([1080, 1350]);
  // desenhou de verdade: o cartão não é de uma cor só
  const cores = await canvas.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const vistas = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 97) vistas.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    return vistas.size;
  });
  expect(cores).toBeGreaterThan(8);

  // os três estilos
  const estilos = janela.getByRole('group', { name: 'Estilo do cartão' }).getByRole('button');
  await expect(estilos).toHaveCount(3);
  for (const [i, nome] of ['pagina', 'ceu', 'pergaminho'].entries()) {
    await estilos.nth(i).click();
    await expect(canvas).toHaveAttribute('data-pronto', 'true');
    await page.screenshot({ path: `${PRINTS}/v5-cartao-${nome}.png` });
  }

  await janela.getByRole('button', { name: 'Copiar imagem' }).click();
  await expect(janela.getByText('Imagem copiada.', { exact: false })).toBeVisible();

  const [baixado] = await Promise.all([
    page.waitForEvent('download'),
    janela.getByRole('button', { name: 'Salvar…' }).click(),
  ]);
  expect(baixado.suggestedFilename()).toMatch(/^citacao.*\.png$/);
  const arquivo = await baixado.path();
  const png = readFileSync(arquivo);
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1350);
  await page.keyboard.press('Escape');
  await expect(janela).toBeHidden();
});

test('cartão de citação também sai do menu do botão direito do leitor', async ({ page }) => {
  await comExemplo(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  await expect(leitor.getByText('II — Do livro')).toBeVisible();
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
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'Compartilhar como imagem…' }).click();
  const janela = page.getByRole('dialog', { name: 'Compartilhar como imagem' });
  await expect(janela.getByLabel('Prévia do cartão de citação')).toHaveAttribute('data-pronto', 'true', {
    timeout: 10_000,
  });
});

test('modo mergulho: F11 esconde barra e painéis, deixa só o anel; o mouse no topo ou Esc trazem a barra', async ({
  page,
}) => {
  await comExemplo(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  await expect(leitor.getByText('II — Do livro')).toBeVisible();
  const barra = leitor.locator('.leitor-barra');

  await leitor.getByRole('button', { name: 'Aparência' }).click();
  await expect(leitor.getByLabel('Aparência da leitura')).toBeVisible();
  await page.keyboard.press('F11');
  await expect(leitor).toHaveAttribute('data-mergulho', 'true');
  await expect(leitor.getByLabel('Aparência da leitura')).toBeHidden(); // os painéis somem
  await expect(barra).toHaveCSS('opacity', '0');
  await expect(leitor.locator('.leitor-anel')).toBeVisible();
  await page.screenshot({ path: `${PRINTS}/v6-mergulho.png` });

  await page.mouse.move(640, 20); // mexer o mouse no topo mostra a barra
  await expect(barra).toHaveCSS('opacity', '1');
  await page.mouse.move(640, 500);
  await expect(barra).toHaveCSS('opacity', '0');

  await page.keyboard.press('Escape'); // Esc sai do mergulho (e não fecha o leitor)
  await expect(leitor).toHaveAttribute('data-mergulho', 'false');
  await expect(leitor).toBeVisible();
  await page.mouse.move(640, 300);
  await expect(barra).toHaveCSS('opacity', '1');

  // o botão da barra também liga
  await leitor.getByRole('button', { name: 'Modo mergulho' }).click();
  await expect(leitor).toHaveAttribute('data-mergulho', 'true');
});
