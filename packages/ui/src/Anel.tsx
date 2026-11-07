/** Anel de progresso: a luz que a obra já acumulou. */
export function Anel({ fracao, tamanho = 44, rotulo = true }: { fracao: number; tamanho?: number; rotulo?: boolean }) {
  const r = 18;
  const voltas = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 44 44" role="img" aria-label={`${Math.round(f * 100)}% lido`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--superficie-3)" strokeWidth="2.5" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--luz)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${voltas * f} ${voltas}`}
        transform="rotate(-90 22 22)"
        style={{ filter: 'drop-shadow(0 0 4px var(--luz))' }}
      />
      {rotulo && (
        <text x="22" y="26" textAnchor="middle" fontSize="11" fill="var(--texto)" fontFamily="var(--fonte-ui)">
          {Math.round(f * 100)}%
        </text>
      )}
    </svg>
  );
}
