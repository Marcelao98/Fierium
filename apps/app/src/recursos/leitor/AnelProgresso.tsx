// O progresso do pergaminho: um anel fino de ouro no canto, com a porcentagem do livro e o tempo no capítulo.
// A fração vem da posição de leitura; os segundos, do relógio do leitor (zera quando o capítulo muda).
const RAIO = 44;

function tempoNoCapitulo(segundos: number): string {
  return segundos < 60 ? 'menos de 1 min' : `${Math.floor(segundos / 60)} min`;
}

export function AnelProgresso({ fracao, segundos }: { fracao: number; segundos: number }) {
  const pct = Math.round(fracao * 100);
  const volta = 2 * Math.PI * RAIO;
  const tempo = tempoNoCapitulo(segundos);
  return (
    <div className="anel-progresso" role="status" aria-label={`${pct}% lido, ${tempo} no capítulo`}>
      <svg viewBox="0 0 96 96" fill="none" aria-hidden="true">
        <circle className="anel-trilho" cx="48" cy="48" r={RAIO} strokeWidth="2" />
        <circle
          className="anel-arco"
          cx="48"
          cy="48"
          r={RAIO}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - Math.min(1, Math.max(0, fracao)))}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <span>
        <b>{pct}%</b>
        {tempo} no cap.
      </span>
    </div>
  );
}
