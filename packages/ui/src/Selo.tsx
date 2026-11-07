import { formaDoSelo } from './selo';

/** A capa gerada (selo) de uma obra: um campo de cor da obra com órbitas e astros, título em serifa. */
export function Selo({
  titulo,
  autor,
  matiz,
  detalhe,
  compacto = false,
}: {
  titulo: string;
  autor?: string | undefined;
  matiz: number;
  detalhe?: string | undefined;
  compacto?: boolean;
}) {
  const f = formaDoSelo(titulo + '|' + (autor ?? ''));
  const c = 50;
  const cy = 38;
  return (
    <div
      className="f-selo"
      style={{
        background: `radial-gradient(120% 90% at 50% 25%, hsl(${matiz} 45% 30%), hsl(${(matiz + 30) % 360} 50% 12%) 70%, hsl(${(matiz + 40) % 360} 55% 7%))`,
      }}
    >
      <svg viewBox="0 0 100 150" className="f-selo-desenho" aria-hidden="true">
        {f.orbitas.map((r, i) => (
          <circle key={i} cx={c} cy={cy} r={r * 50} fill="none" stroke="rgba(255,240,215,0.22)" strokeWidth={0.5} />
        ))}
        <path
          d={`M ${c + Math.cos((f.arco * Math.PI) / 180) * 30} ${cy + Math.sin((f.arco * Math.PI) / 180) * 30} A 30 30 0 0 1 ${c + Math.cos(((f.arco + 70) * Math.PI) / 180) * 30} ${cy + Math.sin(((f.arco + 70) * Math.PI) / 180) * 30}`}
          fill="none"
          stroke="rgba(255,228,170,0.75)"
          strokeWidth={0.9}
          strokeLinecap="round"
        />
        <circle cx={c} cy={cy} r={2.4} fill="rgba(255,240,210,0.95)" />
        {f.astros.map(([ang, o, t], i) => {
          const r = (f.orbitas[o] ?? 0.3) * 50;
          return (
            <circle
              key={i}
              cx={c + Math.cos((ang * Math.PI) / 180) * r}
              cy={cy + Math.sin((ang * Math.PI) / 180) * r}
              r={t * 0.6}
              fill="rgba(255,244,222,0.85)"
            />
          );
        })}
      </svg>
      {!compacto && (
        <div className="f-selo-texto">
          <span className="f-selo-titulo">{titulo}</span>
          {autor && <span className="f-selo-autor">{autor}</span>}
          {detalhe && <span className="f-selo-detalhe">{detalhe}</span>}
        </div>
      )}
    </div>
  );
}
