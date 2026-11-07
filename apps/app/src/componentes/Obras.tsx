// Peças das obras: o cartão (capa + título + luz do progresso), a prateleira (fileira que rola de lado) e o jeito
// de abrir uma obra pelo portal a partir do elemento clicado.
import type { Obra } from '@fierium/contratos';
import { Selo } from '@fierium/ui';
import type { MouseEvent, ReactNode } from 'react';
import { abrirLeitura, ir } from '../estado/navegacao';

export const autorDe = (o: Obra) => o.criadores[0]?.nome ?? '';
export const fracaoDe = (o: Obra) => Math.max(0, ...o.edicoes.map((e) => e.progresso?.fracao ?? 0));

export function lerObra(o: Obra, e?: MouseEvent, marcacaoId?: string) {
  const r = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect();
  abrirLeitura({
    obraId: o.id,
    edicaoId: o.edicoes[0]!.id,
    origem: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 },
    ...(marcacaoId ? { marcacaoId } : {}),
  });
}

export function Capa({ obra, compacto = false }: { obra: Obra; compacto?: boolean }) {
  return (
    <Selo
      titulo={obra.serie ? obra.serie.nome : obra.titulo}
      autor={autorDe(obra)}
      matiz={obra.matiz}
      detalhe={obra.serie ? `vol. ${obra.serie.volume}` : undefined}
      compacto={compacto}
    />
  );
}

export function CartaoObra({ obra, detalhe }: { obra: Obra; detalhe?: ReactNode }) {
  const f = fracaoDe(obra);
  return (
    <button className="cartao-obra" data-estado={obra.relacao.estado} onClick={() => ir({ tela: 'obra', id: obra.id })}>
      <div className="cartao-obra-capa">
        <Capa obra={obra} />
        {obra.relacao.favorita && <span className="cartao-obra-favorita" aria-label="favorita">✦</span>}
      </div>
      <div className="f-barra" aria-hidden={f === 0}>
        <span style={{ width: `${f * 100}%` }} />
      </div>
      <span className="cartao-obra-titulo">{obra.titulo}</span>
      <span className="cartao-obra-autor">{detalhe ?? autorDe(obra)}</span>
    </button>
  );
}

export function Prateleira({ titulo, children, acao }: { titulo: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <section className="prateleira">
      <header>
        <h2>{titulo}</h2>
        {acao}
      </header>
      <div className="prateleira-fileira">{children}</div>
    </section>
  );
}

/** "há 3 dias", "há 2 meses"… */
export function haQuanto(t: number, agora = Date.now()): string {
  const d = Math.floor((agora - t) / 86_400_000);
  if (d < 1) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  if (m < 12) return `há ${m} ${m === 1 ? 'mês' : 'meses'}`;
  const a = Math.floor(m / 12);
  return `há ${a} ${a === 1 ? 'ano' : 'anos'}`;
}

/** "≈ 2 h 10 min" pelo ritmo médio de 90 s por página. */
export function tempoRestante(o: Obra): string | null {
  const e = o.edicoes[0];
  if (!e?.paginas) return null;
  const min = Math.round(((1 - fracaoDe(o)) * e.paginas * 90) / 60);
  if (min <= 0) return null;
  return min < 60 ? `≈ ${min} min` : `≈ ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}
