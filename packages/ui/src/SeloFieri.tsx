// O Selo de Fieri, versão "Astrolábio" (D24): a lua e a centelha dentro de um astrolábio gravado em ouro, com a
// órbita aberta correndo por dentro (o vão é o vir-a-ser). Pequeno (≤ 20 px) vira a versão simples: aro, lua e centelha.
// Desenho de referência: ferramentas/identidade/selos.js → seloB.

const MARCAS = Array.from({ length: 72 }, (_, i) => {
  const a = (i * 5 * Math.PI) / 180;
  const fora = 90;
  const dentro = i % 6 ? 84 : 77;
  return {
    x1: 100 + Math.cos(a) * fora,
    y1: 100 + Math.sin(a) * fora,
    x2: 100 + Math.cos(a) * dentro,
    y2: 100 + Math.sin(a) * dentro,
    grossa: i % 6 === 0,
  };
});

export function SeloFieri({
  tamanho = 32,
  cor = 'var(--luz)',
  centelha = 'var(--estrela)',
  rotulo,
}: {
  tamanho?: number;
  cor?: string;
  centelha?: string;
  /** sem rótulo, o selo é decoração (aria-hidden) */
  rotulo?: string;
}) {
  const simples = tamanho <= 20;
  return (
    <svg
      className="f-selo-fieri"
      viewBox="0 0 200 200"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke={cor}
      strokeLinecap="round"
      {...(rotulo ? { role: 'img', 'aria-label': rotulo } : { 'aria-hidden': true })}
    >
      <circle cx="100" cy="100" r="90" strokeWidth={simples ? 8 : 1.4} strokeOpacity={simples ? 1 : 0.6} />
      {!simples && (
        <>
          <g className="f-selo-fieri-marcas">
            {MARCAS.map((m, i) => (
              <line
                key={i}
                x1={m.x1}
                y1={m.y1}
                x2={m.x2}
                y2={m.y2}
                strokeWidth={m.grossa ? 1.6 : 0.9}
                strokeOpacity={0.75}
              />
            ))}
          </g>
          <path className="f-selo-fieri-orbita" d="M155 56A70 70 0 1 1 100 30" strokeWidth={2.6} />
          <circle cx="155" cy="56" r="4.5" fill={cor} />
          <path d="M100 42v10M100 130v10M42 92h10M148 92h10" strokeWidth={1.2} />
        </>
      )}
      <path d="M58 108A42 42 0 0 0 142 108A44 44 0 0 1 58 108Z" fill={cor} strokeWidth={1} />
      <path d="M100 58L105 86L128 92L105 98L100 124L95 98L72 92L95 86Z" fill={simples ? cor : centelha} stroke="none" />
    </svg>
  );
}
