// Os modos de leitura (Rolagem, Automático, Guiado) e o desempenho dos leitores, no Chromium de verdade: um PDF de 500
// páginas e um EPUB gerados aqui. Também confere que o capítulo malicioso do EPUB chega limpo (DOMPurify).
import { expect, test, type Page } from '@playwright/test';
import { abrirLeitor } from './leitor-apoio';

/** Liga um amostrador de quadros (requestAnimationFrame) e devolve quem para e entrega os intervalos, em ms. */
async function amostrarQuadros(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __quadros: number[]; __amostrar: boolean };
    w.__quadros = [];
    w.__amostrar = true;
    let ultimo = performance.now();
    const f = (t: number) => {
      w.__quadros.push(t - ultimo);
      ultimo = t;
      if (w.__amostrar) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  return async () => {
    const q = await page.evaluate(() => {
      const w = window as unknown as { __quadros: number[]; __amostrar: boolean };
      w.__amostrar = false;
      return w.__quadros.slice(1);
    });
    const ordenados = [...q].sort((a, b) => a - b);
    return {
      quadros: q.length,
      p95: ordenados[Math.floor(ordenados.length * 0.95)] ?? 0,
      maior: ordenados.at(-1) ?? 0,
      travadas: q.filter((d) => d > 100).length,
    };
  };
}

async function escolherModo(page: Page, modo: 'Automático' | 'Guiado', velocidade: number, unidade: string) {
  const leitor = page.getByRole('dialog', { name: 'Lendo Dom Casmurro' });
  await leitor.getByRole('button', { name: 'Modo de leitura' }).click();
  const painel = page.getByRole('complementary', { name: 'Modo de leitura' });
  await painel.getByRole('button', { name: modo }).click();
  await painel.getByLabel(`Velocidade (${unidade})`).fill(String(velocidade));
  return painel;
}

test.describe('modos de leitura e desempenho', () => {
  test('PDF de 500 páginas: 1ª página rápida, Automático rola sem travar e pausa ao rolar à mão', async ({ page }) => {
    const { erros, ms } = await abrirLeitor(page, 'pdf', true, {
      paginas: 500,
      linhas: 30,
      acalmar: 3500,
    });
    console.log(`MEDIDA PDF 500 páginas: 1ª página pronta em ${ms} ms (do clique em Continuar)`);
    expect(ms).toBeLessThan(1000);

    const rolagem = page.locator('.fl-pdf');
    const painel = await escolherModo(page, 'Automático', 100, 'px/s');
    const parar = await amostrarQuadros(page);
    const antes = await rolagem.evaluate((e) => e.scrollTop);
    await page.waitForTimeout(3000);
    const depois = await rolagem.evaluate((e) => e.scrollTop);
    const quadros = await parar();
    console.log(
      `MEDIDA Automático (PDF, 100 px/s, 3 s): rolou ${depois - antes} px; ${quadros.quadros} quadros, p95 ${quadros.p95.toFixed(1)} ms, maior ${quadros.maior.toFixed(0)} ms, ${quadros.travadas} travadas (>100 ms)`,
    );
    expect(depois - antes).toBeGreaterThan(220); // 100 px/s por 3 s = 300 px (com folga pra o relógio da máquina)
    expect(depois - antes).toBeLessThan(380);
    expect(quadros.travadas).toBeLessThanOrEqual(1);

    // rolar à mão pausa; Retomar continua
    await rolagem.hover();
    await page.mouse.wheel(0, 120);
    await expect(painel.getByRole('button', { name: 'Retomar' })).toBeVisible();
    await page.waitForTimeout(600); // a roda anima a rolagem; espera assentar
    const parado = await rolagem.evaluate((e) => e.scrollTop);
    await page.waitForTimeout(500);
    expect(await rolagem.evaluate((e) => e.scrollTop)).toBe(parado);
    await painel.getByRole('button', { name: 'Retomar' }).click();
    await page.waitForTimeout(800);
    expect(await rolagem.evaluate((e) => e.scrollTop)).toBeGreaterThan(parado);
    expect(erros).toEqual([]);
  });

  test('PDF: Guiado destaca a linha de texto e desce no ritmo das palavras por minuto', async ({ page }) => {
    const { erros } = await abrirLeitor(page, 'pdf', true, { paginas: 20, linhas: 30 });
    await escolherModo(page, 'Guiado', 600, 'palavras/min');
    const destaque = page.locator('.fl-pdf-lista .fl-destaque');
    await expect(destaque).toBeAttached({ timeout: 5000 });
    const caixa = async () => (await destaque.boundingBox())!;
    const a = await caixa();
    // a faixa cobre um item de texto do PDF
    const cobre = await page.evaluate(
      ({ y, altura }) => {
        const spans = [...document.querySelectorAll('.fl-pdf-texto span')];
        return spans.some((s) => {
          const r = s.getBoundingClientRect();
          const c = r.top + r.height / 2;
          return c >= y && c <= y + altura;
        });
      },
      { y: a.y, altura: a.height },
    );
    expect(cobre).toBe(true);
    await page.waitForTimeout(2600); // linhas de 8 palavras a 600/min: 0,8 s cada
    const b = await caixa();
    expect(b.y).not.toBe(a.y);
    expect(erros).toEqual([]);
  });

  test('EPUB: trocar de capítulo é rápido, Automático rola o capítulo e o livro malicioso chega limpo', async ({
    page,
  }) => {
    const { erros, ms } = await abrirLeitor(page, 'epub', true, { hostil: true });
    console.log(`MEDIDA EPUB: capítulo 1 pronto em ${ms} ms (do clique em Continuar)`);
    const texto = page.frameLocator('iframe').first();
    // o capítulo 1 do livro malicioso: texto fica; script, on*, javascript: e iframe somem
    await expect(texto.getByText('Texto do livro')).toBeVisible();
    expect(await texto.locator('script').count()).toBe(0);
    expect(await texto.locator('iframe').count()).toBe(0);
    expect(await texto.locator('#veneno').getAttribute('onclick')).toBeNull();
    expect(await texto.locator('#mal').getAttribute('href')).toBeNull();
    await texto.locator('#veneno').click();
    const veneno = await page.evaluate(() => {
      const quadros = [...document.querySelectorAll('iframe')];
      return quadros.map((q) => (q.contentWindow as unknown as { __veneno?: number }).__veneno ?? null);
    });
    expect(veneno.every((v) => v === null)).toBe(true);

    // trocar de capítulo
    const t0 = Date.now();
    await page.getByRole('button', { name: 'Próximo capítulo' }).click();
    await expect(page.frameLocator('iframe').first().getByRole('heading', { name: 'Capítulo 2' })).toBeVisible();
    const troca = Date.now() - t0;
    console.log(`MEDIDA EPUB: trocar de capítulo em ${troca} ms`);
    expect(troca).toBeLessThan(300);

    // Automático rola o capítulo (o elemento que rola é o do epub.js)
    const rolador = page.locator('.epub-container');
    await escolherModo(page, 'Automático', 200, 'px/s');
    const parar = await amostrarQuadros(page);
    const antes = await rolador.evaluate((e) => e.scrollTop);
    await page.waitForTimeout(2000);
    const depois = await rolador.evaluate((e) => e.scrollTop);
    const quadros = await parar();
    console.log(
      `MEDIDA Automático (EPUB, 200 px/s, 2 s): rolou ${depois - antes} px; ${quadros.quadros} quadros, p95 ${quadros.p95.toFixed(1)} ms, ${quadros.travadas} travadas`,
    );
    expect(depois - antes).toBeGreaterThan(250);
    expect(quadros.travadas).toBeLessThanOrEqual(1);
    expect(erros).toEqual([]);
  });

  test('EPUB: Guiado destaca a linha dentro do capítulo', async ({ page }) => {
    const { erros } = await abrirLeitor(page, 'epub', true);
    await escolherModo(page, 'Guiado', 600, 'palavras/min');
    const texto = page.frameLocator('iframe').first();
    const destaque = texto.locator('.fl-destaque');
    await expect(destaque).toBeAttached({ timeout: 5000 });
    const a = (await destaque.boundingBox())!;
    expect(a.height).toBeGreaterThan(5);
    // a faixa cai dentro de um parágrafo do capítulo (a conta de coordenadas da tela pro iframe está certa)
    const dentroDeUmParagrafo = await destaque.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [...el.ownerDocument.querySelectorAll('p, h1')].some((p) => {
        const q = p.getBoundingClientRect();
        return r.top >= q.top - 2 && r.bottom <= q.bottom + 2 && r.height > 0;
      });
    });
    expect(dentroDeUmParagrafo).toBe(true);
    await page.waitForTimeout(2200);
    const b = (await destaque.boundingBox())!;
    expect(b.y).not.toBe(a.y);
    expect(erros).toEqual([]);
  });
});
