// Página de desenvolvimento do motor de EPUB (?dev=epub&url=...): monta só o motor, sem biblioteca nem núcleo.
// Serve pra olhar um EPUB de verdade e pro teste e2e. Expõe window.__epub { posicao, fracao, erro, toques }.
import type { ConfigLeitura } from '@fierium/contratos';
import { motorEpub, type SessaoLeitura } from '@fierium/leitores';
import { useEffect, useRef } from 'react';

const APARENCIA: ConfigLeitura = { fonte: 'literata', tamanho: 18, entrelinha: 1.6, largura: 68, tema: 'pergaminho' };

export default function DevEpub() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const q = new URL(location.href).searchParams;
    const estado = { posicao: '', fracao: 0, erro: '', toques: 0 };
    (window as unknown as { __epub: unknown }).__epub = estado;
    let sessao: SessaoLeitura | null = null;
    let cancelado = false;
    void motorEpub
      .montar(el, {
        fonte: { tipo: 'arquivo', edicaoId: 'dev', formato: 'epub', url: q.get('url') ?? '', tamanho: 0 },
        alvo: q.get('cfi') ? { posicao: q.get('cfi')! } : undefined,
        aparencia: { ...APARENCIA, tema: (q.get('tema') as ConfigLeitura['tema'] | null) ?? APARENCIA.tema },
        marcacoes: [],
        cores: [],
        eventos: {
          posicao: (p, f) => Object.assign(estado, { posicao: p, fracao: f }),
          selecao: () => undefined,
          marcacaoClicada: () => undefined,
          toque: () => void (estado.toques += 1),
          erro: (c, m) => void (estado.erro = `${c}: ${m}`),
        },
      })
      .then((s) => {
        if (cancelado) s.desmontar();
        else sessao = s;
      })
      .catch(() => undefined); // o erro já foi para estado.erro
    return () => {
      cancelado = true;
      sessao?.desmontar();
    };
  }, []);
  return <div ref={ref} style={{ position: 'fixed', inset: 0 }} data-testid="alvo-epub" />;
}
