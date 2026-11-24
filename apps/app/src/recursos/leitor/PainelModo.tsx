// O menu "Modo" do leitor: Rolagem (à mão), Automático (rola sozinho) e Guiado (uma faixa desce linha a linha), com o
// controle de velocidade e o botão de pausar/retomar. Os modos só aparecem se o leitor do formato declara as peças que
// eles usam (ex.: o texto corrido ainda não tem).
import { MODOS, modoDisponivel, modoPorId, type Capacidades, type IdModo, type EstadoModo } from '@fierium/leitor-base';

interface Props {
  capacidades: Capacidades | undefined;
  modo: IdModo;
  aoEscolher(m: IdModo): void;
  velocidade: number;
  aoMudarVelocidade(v: number): void;
  estado: EstadoModo;
  aoAlternar(): void;
}

const NOTA: Record<IdModo, string> = {
  rolagem: 'Você rola com o mouse, o dedo ou as teclas.',
  automatico: 'O livro desce sozinho. Tocar ou rolar pausa.',
  guiado: 'Uma faixa destaca a linha e desce no seu ritmo.',
};

export function PainelModo({
  capacidades,
  modo,
  aoEscolher,
  velocidade,
  aoMudarVelocidade,
  estado,
  aoAlternar,
}: Props) {
  const atual = modoPorId(modo);
  return (
    <aside className="leitor-painel" aria-label="Modo de leitura">
      <h3>Modo</h3>
      <div className="chips">
        {MODOS.map((m) => (
          <button
            key={m.id}
            className="f-chip"
            aria-pressed={modo === m.id}
            disabled={!modoDisponivel(m, capacidades)}
            onClick={() => aoEscolher(m.id)}
          >
            {m.rotulo}
          </button>
        ))}
      </div>
      <p className="leitor-nota-modo">{NOTA[modo]}</p>
      {atual.faixa && (
        <>
          <label className="leitor-controle">
            Velocidade
            <input
              type="range"
              aria-label={`Velocidade (${atual.unidade})`}
              min={atual.faixa.min}
              max={atual.faixa.max}
              step={atual.faixa.passo}
              value={velocidade}
              onChange={(e) => aoMudarVelocidade(Number(e.target.value))}
            />
            <span>{velocidade}</span>
          </label>
          <p className="leitor-nota-modo">{atual.unidade}</p>
          <button className="f-botao" data-tamanho="p" onClick={aoAlternar}>
            {estado === 'rodando' ? 'Pausar' : estado === 'fim' ? 'Recomeçar' : 'Retomar'}
          </button>
        </>
      )}
    </aside>
  );
}
