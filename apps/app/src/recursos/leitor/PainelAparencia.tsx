// O painel "Aa": tema da página, cor da interface, fonte, tamanho, entrelinha e largura.
import type { ConfigLeitura, PaginaLeitura, TemaLeitura } from '@fierium/contratos';
import { PainelPagina } from './PainelPagina';

const TEMAS: [TemaLeitura, string, string, string][] = [
  ['pergaminho', 'Pergaminho', '#f1e6c9', '#2b2216'],
  ['papel', 'Papel', '#f7f3ea', '#1f1b16'],
  ['sepia', 'Sépia', '#efe1c6', '#3b2b1a'],
  ['noite', 'Noite', '#12101f', '#ddd6c8'],
  ['tinta', 'Tinta', '#e9e9e4', '#111'],
];

/** Fonte da leitura: id, nome e a família CSS (`--l-fonte` do leitor usa a mesma lista). */
export const FONTES: [ConfigLeitura['fonte'], string, string][] = [
  ['cormorant', 'Cormorant', 'var(--fonte-titulo)'],
  ['literata', 'Literata', 'var(--fonte-leitura)'],
  ['inter', 'Inter', 'var(--fonte-ui)'],
];

interface Props {
  cfg: ConfigLeitura;
  mudar(m: Partial<ConfigLeitura>): void;
  previa(p: PaginaLeitura | null): void;
}

export function PainelAparencia({ cfg, mudar, previa }: Props) {
  return (
    <aside className="leitor-painel" aria-label="Aparência da leitura">
      <PainelPagina cfg={cfg} mudar={mudar} previa={previa} />
      <h3>Cor da interface</h3>
      <div className="temas-leitura">
        {TEMAS.map(([v, n, f, t]) => (
          <button
            key={v}
            aria-pressed={cfg.tema === v}
            style={{ background: f, color: t }}
            onClick={() => mudar({ tema: v })}
          >
            {n}
          </button>
        ))}
      </div>
      <h3>Fonte</h3>
      <div className="chips">
        {FONTES.map(([v, n, f]) => (
          <button
            key={v}
            className="f-chip"
            style={{ fontFamily: f }}
            aria-pressed={cfg.fonte === v}
            onClick={() => mudar({ fonte: v })}
          >
            {n}
          </button>
        ))}
      </div>
      <h3>Texto</h3>
      <label className="leitor-controle">
        Tamanho
        <input
          type="range"
          min={14}
          max={32}
          value={cfg.tamanho}
          onChange={(e) => mudar({ tamanho: Number(e.target.value) })}
        />
        <span>{cfg.tamanho}</span>
      </label>
      <label className="leitor-controle">
        Entrelinha
        <input
          type="range"
          min={1.2}
          max={2.2}
          step={0.1}
          value={cfg.entrelinha}
          onChange={(e) => mudar({ entrelinha: Number(e.target.value) })}
        />
        <span>{cfg.entrelinha.toFixed(1)}</span>
      </label>
      <label className="leitor-controle">
        Largura
        <input
          type="range"
          min={40}
          max={100}
          step={2}
          value={cfg.largura}
          onChange={(e) => mudar({ largura: Number(e.target.value) })}
        />
        <span>{cfg.largura}</span>
      </label>
    </aside>
  );
}
