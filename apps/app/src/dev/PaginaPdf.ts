// Página de desenvolvimento (?dev=pdf&url=...&tamanho=N&posicao=37:0.42&tema=noite): monta só o motor de PDF numa
// caixa de tela cheia. O e2e usa isso; a posição aparece em #posicao e o estado em #estado.
import type { ConfigLeitura, TemaLeitura } from '@fierium/contratos';
import { motorPdf } from '@fierium/leitores';

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
    tema: (q.get('tema') ?? 'papel') as TemaLeitura,
  };
  const posicao = q.get('posicao');
  await motorPdf.montar(raiz, {
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
  if (!estado.textContent?.startsWith('erro')) estado.textContent = 'pronto';
}
