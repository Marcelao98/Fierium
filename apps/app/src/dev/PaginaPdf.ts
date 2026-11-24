// Página de desenvolvimento (?dev=pdf&url=...&tamanho=N&posicao=37:0.42&tema=noite): monta só o motor de PDF numa
// caixa de tela cheia. O e2e usa isso; a posição aparece em #posicao e o estado em #estado.
import type { ConfigLeitura, PaginaLeitura } from '@fierium/contratos';
import { PAGINA_PADRAO } from '@fierium/leitor-base';
import { motorPdf } from '@fierium/leitor-pdf';

const paginaDaUrl = (): PaginaLeitura => {
  const q = new URL(location.href).searchParams;
  return {
    ...PAGINA_PADRAO,
    tema: q.get('tema') ?? 'papel',
    papel: q.get('papel') ?? undefined,
    tinta: q.get('tinta') ?? undefined,
  };
};

export async function abrirPaginaPdf(raiz: HTMLElement) {
  const q = new URL(location.href).searchParams;
  raiz.style.cssText = 'position:fixed;inset:0';
  const info = document.createElement('div');
  info.style.cssText =
    'position:fixed;right:8px;top:8px;z-index:9;background:#000a;color:#fff;font:12px monospace;padding:4px 8px';
  info.innerHTML = '<span id="estado">montando</span> <span id="posicao"></span>';
  document.body.append(info);
  const estado = info.querySelector('#estado')!;
  const pos = info.querySelector('#posicao')!;
  const aparencia: ConfigLeitura = {
    fonte: 'literata',
    tamanho: 20,
    entrelinha: 1.7,
    largura: 66,
    tema: 'papel',
    pagina: paginaDaUrl(),
    temasMeus: [],
  };
  const posicao = q.get('posicao');
  const sessao = await motorPdf.montar(raiz, {
    fonte: {
      tipo: 'arquivo',
      edicaoId: 'dev',
      formato: 'pdf',
      url: q.get('url') ?? '',
      tamanho: Number(q.get('tamanho') ?? 0),
    },
    alvo: posicao ? { posicao } : undefined,
    aparencia,
    marcacoes: [],
    cores: [],
    eventos: {
      posicao: (p) => (pos.textContent = p),
      selecao: () => undefined,
      marcacaoClicada: () => undefined,
      toque: () => undefined,
      erro: (c, m) => (estado.textContent = `erro ${c}: ${m}`),
    },
  });
  // o e2e troca o tema com o PDF aberto (sem recarregar o arquivo)
  (window as unknown as { __aplicarPagina: (p: Partial<PaginaLeitura>) => void }).__aplicarPagina = (p) =>
    sessao.aplicarAparencia({ ...aparencia, pagina: { ...aparencia.pagina, ...p } });
  if (!estado.textContent?.startsWith('erro')) estado.textContent = 'pronto';
}
