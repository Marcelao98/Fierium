// Os gráficos das estatísticas, sem estado: recebem os dias e desenham. Uma série = uma cor só (a luz), barras
// finas com ponta arredondada, dica ao passar o mouse, texto sempre na cor do texto, tabela escondida pra leitor de tela.
import type { DiaDeLeitura } from '@fierium/contratos';
import { useState } from 'react';

export const tempo = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};
export const nivel = (s: number) => (s <= 0 ? 0 : s < 900 ? 1 : s < 1800 ? 2 : s < 3600 ? 3 : 4);
const dataBonita = (d: string) =>
  new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });

function useDica() {
  const [d, setD] = useState<{ x: number; y: number; t: string } | null>(null);
  const el = d && (
    <div className="dica-grafico" style={{ left: d.x, top: d.y }} role="tooltip">
      {d.t}
    </div>
  );
  return [
    el,
    (e: { clientX: number; clientY: number } | null, t = '') => setD(e ? { x: e.clientX, y: e.clientY, t } : null),
  ] as const;
}

export function Calendario({ dias }: { dias: DiaDeLeitura[] }) {
  const [dica, mostrar] = useDica();
  const c = 12;
  const g = 3;
  const primeiro = new Date(dias[0]!.dia + 'T12:00').getDay();
  const semanas = Math.ceil((dias.length + primeiro) / 7);
  const cor = [
    'var(--superficie-2)',
    'color-mix(in srgb, var(--luz) 28%, transparent)',
    'color-mix(in srgb, var(--luz) 50%, transparent)',
    'color-mix(in srgb, var(--luz) 75%, transparent)',
    'var(--luz)',
  ];
  return (
    <div className="calendario">
      <svg
        width={semanas * (c + g)}
        height={7 * (c + g)}
        role="img"
        aria-label="Calendário de leitura dos últimos 12 meses"
      >
        {dias.map((d, i) => {
          const k = i + primeiro;
          return (
            <rect
              key={d.dia}
              x={Math.floor(k / 7) * (c + g)}
              y={(k % 7) * (c + g)}
              width={c}
              height={c}
              rx={3}
              fill={cor[nivel(d.segundos)]}
              onPointerEnter={(e) =>
                mostrar(e, `${dataBonita(d.dia)} · ${d.segundos ? tempo(d.segundos) : 'sem leitura'}`)
              }
              onPointerLeave={() => mostrar(null)}
            />
          );
        })}
      </svg>
      <div className="legenda-niveis">
        menos
        {cor.map((x, i) => (
          <i key={i} style={{ background: x }} />
        ))}
        mais
      </div>
      {dica}
    </div>
  );
}

export function Ultimos30({ dias }: { dias: DiaDeLeitura[] }) {
  const [dica, mostrar] = useDica();
  const ult = dias.slice(-30);
  const max = Math.max(1800, ...ult.map((d) => d.segundos));
  const w = 600;
  const h = 150;
  const bw = w / ult.length;
  return (
    <>
      <svg
        viewBox={`0 0 ${w} ${h + 18}`}
        width="100%"
        role="img"
        aria-label="Minutos lidos por dia nos últimos 30 dias"
      >
        <line x1={0} x2={w} y1={h} y2={h} stroke="var(--borda)" />
        <line
          x1={0}
          x2={w}
          y1={h - (1800 / max) * h}
          y2={h - (1800 / max) * h}
          stroke="var(--borda)"
          strokeDasharray="3 5"
        />
        <text x={w} y={h - (1800 / max) * h - 4} textAnchor="end" fontSize={10} fill="var(--texto-3)">
          30 min
        </text>
        {ult.map((d, i) => {
          const a = Math.max(d.segundos ? 3 : 0, (d.segundos / max) * h);
          return (
            <g
              key={d.dia}
              onPointerEnter={(e) =>
                mostrar(
                  e,
                  `${dataBonita(d.dia)} · ${d.segundos ? `${tempo(d.segundos)}, ${d.paginas} págs.` : 'sem leitura'}`,
                )
              }
              onPointerLeave={() => mostrar(null)}
            >
              <rect x={i * bw} y={0} width={bw} height={h} fill="transparent" />
              {a > 0 && (
                <path
                  d={`M${i * bw + 2} ${h} V${h - a + 4} q0 -4 4 -4 H${i * bw + bw - 6} q4 0 4 4 V${h} Z`}
                  fill="var(--luz)"
                />
              )}
            </g>
          );
        })}
        <text x={0} y={h + 14} fontSize={10} fill="var(--texto-3)">
          {dataBonita(ult[0]!.dia)}
        </text>
        <text x={w} y={h + 14} textAnchor="end" fontSize={10} fill="var(--texto-3)">
          hoje
        </text>
      </svg>
      <table className="f-sr">
        <caption>Últimos 30 dias</caption>
        <tbody>
          {ult.map((d) => (
            <tr key={d.dia}>
              <td>{d.dia}</td>
              <td>{tempo(d.segundos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dica}
    </>
  );
}
