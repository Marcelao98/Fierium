import { useId } from 'react';
import {
  ajustarAutor,
  ajustarTitulo,
  CENTRO,
  motivoDaArea,
  ornamentoDaCapa,
  textoDoSeloDeSerie,
  type Estrela,
  type Motivo,
} from './selo';

const OURO = '#e3c27d';
const OURO_SUAVE = 'rgba(227, 194, 125, 0.55)';
const CREME = '#f4ead3';

/** Estrela de quatro pontas (as grandes) ou ponto de luz (as pequenas). */
function Astro({ e }: { e: Estrela }) {
  if (!e.brilho) return <circle cx={e.x} cy={e.y} r={e.r} fill={CREME} opacity={0.85} />;
  const s = 4 + e.r * 2.2;
  const c = 0.9;
  return (
    <path
      d={`M ${e.x} ${e.y - s} Q ${e.x + c} ${e.y - c} ${e.x + s} ${e.y} Q ${e.x + c} ${e.y + c} ${e.x} ${e.y + s} Q ${e.x - c} ${e.y + c} ${e.x - s} ${e.y} Q ${e.x - c} ${e.y - c} ${e.x} ${e.y - s} Z`}
      fill={CREME}
    />
  );
}

/** O desenho de cada mundo, no meio da metade de cima. */
function Motivo({ motivo, giro }: { motivo: Motivo; giro: number }) {
  const { x, y } = CENTRO;
  const fino = { fill: 'none', stroke: OURO, strokeLinecap: 'round' } as const;
  switch (motivo) {
    case 'lua': {
      const R = 30;
      return (
        <g transform={`rotate(${(giro % 50) - 25} ${x} ${y})`}>
          <path
            d={`M ${x - 6} ${y - R} A ${R} ${R} 0 1 0 ${x - 6} ${y + R} A ${R * 1.28} ${R * 1.28} 0 0 1 ${x - 6} ${y - R} Z`}
            fill={OURO}
            opacity={0.92}
          />
          <circle cx={x - 6} cy={y} r={R + 5} {...fino} strokeWidth={0.4} opacity={0.5} />
        </g>
      );
    }
    case 'astrolabio': {
      const marcas = Array.from({ length: 36 }, (_, i) => i);
      return (
        <g>
          <circle cx={x} cy={y} r={36} {...fino} strokeWidth={0.9} />
          <circle cx={x} cy={y} r={30} {...fino} strokeWidth={0.4} />
          <circle cx={x} cy={y} r={20} {...fino} strokeWidth={0.5} strokeDasharray="1.2 2.2" />
          {marcas.map((i) => {
            const a = (i * 10 * Math.PI) / 180;
            const c = i % 3 === 0 ? 4.2 : 2.4;
            return (
              <line
                key={i}
                x1={x + Math.cos(a) * 36}
                y1={y + Math.sin(a) * 36}
                x2={x + Math.cos(a) * (36 - c)}
                y2={y + Math.sin(a) * (36 - c)}
                stroke={OURO}
                strokeWidth={0.5}
              />
            );
          })}
          <g transform={`rotate(${giro} ${x} ${y})`}>
            <line x1={x - 30} y1={y} x2={x + 30} y2={y} stroke={OURO} strokeWidth={0.6} />
            <path d={`M ${x} ${y - 30} L ${x + 3.2} ${y} L ${x} ${y + 30} L ${x - 3.2} ${y} Z`} fill={OURO_SUAVE} />
          </g>
        </g>
      );
    }
    case 'raios': {
      const raios = Array.from({ length: 24 }, (_, i) => i);
      return (
        <g transform={`rotate(${giro % 15} ${x} ${y})`}>
          {raios.map((i) => {
            const a = (i * 15 * Math.PI) / 180;
            const longo = i % 2 === 0;
            return (
              <line
                key={i}
                x1={x + Math.cos(a) * 17}
                y1={y + Math.sin(a) * 17}
                x2={x + Math.cos(a) * (longo ? 40 : 30)}
                y2={y + Math.sin(a) * (longo ? 40 : 30)}
                stroke={OURO}
                strokeWidth={longo ? 1.1 : 0.6}
                strokeLinecap="round"
              />
            );
          })}
          <circle cx={x} cy={y} r={12.5} fill={OURO} opacity={0.92} />
        </g>
      );
    }
    case 'orbitas':
      return (
        <g>
          {[0, 60, 120].map((d) => (
            <ellipse
              key={d}
              cx={x}
              cy={y}
              rx={36}
              ry={13}
              transform={`rotate(${d + (giro % 60)} ${x} ${y})`}
              {...fino}
              strokeWidth={0.7}
            />
          ))}
          <circle cx={x} cy={y} r={5} fill={OURO} />
        </g>
      );
    case 'constelacao':
      return <circle cx={x} cy={y} r={46} {...fino} strokeWidth={0.35} strokeDasharray="0.8 3" opacity={0.7} />;
  }
}

/** O canto gravado da moldura (desenhado num canto e espelhado nos outros). */
const CANTO = 'M 0 15 Q 0 0 15 0 M 0 7 Q 0 0 7 0 M 4.5 4.5 m -1.1 0 a 1.1 1.1 0 1 0 2.2 0 a 1.1 1.1 0 1 0 -2.2 0';

/**
 * A capa gerada de uma obra sem imagem: pano na cor da obra, moldura gravada em ouro, o ornamento do mundo dela
 * (feito do título, sempre o mesmo), título em Cormorant, autor em Cinzel e, se for de série, o selo do volume.
 * É um SVG só: tudo escala junto, de 48 px a 320 px, e nada estoura. `compacto` tira os textos (miniaturas).
 */
export function Selo({
  titulo,
  autor,
  matiz,
  detalhe,
  area,
  compacto = false,
}: {
  titulo: string;
  autor?: string | undefined;
  matiz: number;
  detalhe?: string | undefined;
  /** o "reino" ou os assuntos da obra: escolhem o ornamento */
  area?: string | undefined;
  compacto?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const motivo = motivoDaArea(area);
  const orn = ornamentoDaCapa(titulo + '|' + (autor ?? ''), motivo);
  const t = ajustarTitulo(titulo);
  const a = autor ? ajustarAutor(autor) : null;
  const passo = t.tamanho * 1.13;
  const topo = 194 - (t.linhas.length * passo) / 2 + t.tamanho * 0.8;
  const escala = compacto ? 1.4 : 1;
  return (
    <div
      className="f-selo"
      data-motivo={motivo}
      style={{
        background: `radial-gradient(130% 95% at 50% 22%, hsl(${matiz} 44% 28%), hsl(${(matiz + 24) % 360} 48% 14%) 68%, hsl(${(matiz + 36) % 360} 52% 8%))`,
      }}
    >
      <svg viewBox="0 0 200 300" className="f-selo-desenho" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`${uid}-trama`} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
            <path d="M0 0.4H2.4M0.4 0V2.4" stroke="#fff" strokeWidth="0.25" opacity="0.07" />
          </pattern>
        </defs>
        <rect width="200" height="300" fill={`url(#${uid}-trama)`} />
        {/* moldura gravada: filete grosso, filete fino e o canto ornamentado */}
        <rect x="8" y="8" width="184" height="284" rx="1.5" fill="none" stroke={OURO} strokeWidth="1.1" />
        <rect x="12.5" y="12.5" width="175" height="275" fill="none" stroke={OURO_SUAVE} strokeWidth="0.4" />
        {(
          [
            [14, 14, 1, 1],
            [186, 14, -1, 1],
            [14, 286, 1, -1],
            [186, 286, -1, -1],
          ] as const
        ).map(([cx, cy, sx, sy]) => (
          <path
            key={`${cx}-${cy}`}
            d={CANTO}
            transform={`translate(${cx} ${cy}) scale(${sx} ${sy})`}
            fill="none"
            stroke={OURO}
            strokeWidth="0.7"
            strokeLinecap="round"
          />
        ))}
        <g transform={compacto ? `translate(100 150) scale(${escala}) translate(-100 -${CENTRO.y})` : undefined}>
          {orn.fios.map(([i, j]) => {
            const p = orn.estrelas[i];
            const q = orn.estrelas[j];
            return p && q ? (
              <line key={`${i}-${j}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={OURO_SUAVE} strokeWidth="0.5" />
            ) : null;
          })}
          <Motivo motivo={motivo} giro={orn.giro} />
          {orn.estrelas.map((e, i) => (
            <Astro key={i} e={e} />
          ))}
        </g>
        {!compacto && (
          <g>
            <g stroke={OURO_SUAVE} strokeWidth="0.5">
              <line x1="42" y1="150" x2="94" y2="150" />
              <line x1="106" y1="150" x2="158" y2="150" />
            </g>
            <path d="M 100 146.5 L 103.5 150 L 100 153.5 L 96.5 150 Z" fill={OURO} />
            <text textAnchor="middle" className="f-selo-titulo" fill={CREME} fontSize={t.tamanho}>
              {t.linhas.map((l, i) => (
                <tspan key={i} x="100" y={topo + i * passo}>
                  {l}
                </tspan>
              ))}
            </text>
            <g stroke={OURO_SUAVE} strokeWidth="0.5">
              <line x1="62" y1="234" x2="138" y2="234" />
            </g>
            {a && (
              <text
                x="100"
                y="251"
                textAnchor="middle"
                className="f-selo-autor"
                fill={OURO}
                fontSize={a.tamanho}
                letterSpacing={a.tamanho * 0.14}
              >
                {a.texto}
              </text>
            )}
            {detalhe ? (
              <g>
                <circle cx="100" cy="271" r="9.5" fill={`hsl(${matiz} 40% 12%)`} stroke={OURO} strokeWidth="0.8" />
                <circle cx="100" cy="271" r="7.6" fill="none" stroke={OURO_SUAVE} strokeWidth="0.35" />
                <text
                  x="100"
                  y="271.2"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="f-selo-autor"
                  fill={OURO}
                  fontSize="8.4"
                >
                  {textoDoSeloDeSerie(detalhe)}
                </text>
              </g>
            ) : (
              <g fill={OURO} opacity="0.8">
                <circle cx="94" cy="270" r="0.9" />
                <path d="M 100 267 L 101.5 270 L 100 273 L 98.5 270 Z" />
                <circle cx="106" cy="270" r="0.9" />
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
