// "Notas deste livro": as marcações e notas do livro aberto, na ordem do livro, com filtro por cor e busca. Clicar leva
// ao trecho; dá pra copiar como citação e apagar daqui.
import type { CorMarcacao, Marcacao } from '@fierium/contratos';
import { Icone } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { corDe } from '../../compartilhado/Marcacoes';
import { ondeCurto, porPosicao, semAcento } from '../../compartilhado/citacao';

export function filtrarNotas(ms: Marcacao[], cor: string | null, texto: string): Marcacao[] {
  const q = semAcento(texto.trim());
  return ms
    .filter((m) => (!cor || m.cor === cor) && (!q || semAcento(`${m.trecho} ${m.nota ?? ''}`).includes(q)))
    .sort(porPosicao);
}

export function PainelNotas({
  marcacoes,
  cores,
  aoIr,
  aoCopiarCitacao,
  aoApagar,
}: {
  marcacoes: Marcacao[];
  cores: CorMarcacao[];
  aoIr(m: Marcacao): void;
  aoCopiarCitacao(m: Marcacao): void;
  aoApagar(m: Marcacao): void;
}) {
  const [cor, setCor] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const lista = useMemo(() => filtrarNotas(marcacoes, cor, busca), [marcacoes, cor, busca]);
  const usadas = cores.filter((c) => marcacoes.some((m) => m.cor === c.id));

  return (
    <aside className="leitor-painel" aria-label="Notas deste livro">
      <h3>Notas deste livro</h3>
      <input
        className="painel-busca"
        placeholder="Buscar nas notas…"
        aria-label="Buscar nas notas deste livro"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <div className="chips" role="group" aria-label="Filtrar por cor">
        <button className="f-chip" aria-pressed={cor === null} onClick={() => setCor(null)}>
          Todas ({marcacoes.length})
        </button>
        {usadas.map((c) => (
          <button
            key={c.id}
            className="f-chip painel-chip-cor"
            style={{ '--cor-marca': c.cor } as CSSProperties}
            aria-pressed={cor === c.id}
            onClick={() => setCor(cor === c.id ? null : c.id)}
          >
            <i /> {c.nome}
          </button>
        ))}
      </div>
      {!marcacoes.length && <p>Selecione um trecho do texto e use o botão direito para marcar ou anotar.</p>}
      {!!marcacoes.length && !lista.length && <p>Nenhuma nota com esse filtro.</p>}
      <ul className="painel-notas">
        {lista.map((m) => (
          <li key={m.id} style={{ '--cor-marca': corDe(cores, m.cor).cor } as CSSProperties}>
            <button className="painel-marcacao" onClick={() => aoIr(m)}>
              <small className="painel-marcacao-onde">
                {corDe(cores, m.cor).nome}
                {ondeCurto(m) && ` · ${ondeCurto(m)}`}
                {m.tipo === 'marcador' && ' · marcador'}
              </small>
              {m.trecho.length > 140 ? m.trecho.slice(0, 138) + '…' : m.trecho}
              {m.nota && <small className="painel-marcacao-nota">✎ {m.nota}</small>}
            </button>
            <div className="painel-notas-acoes">
              <button aria-label="Copiar como citação" title="Copiar como citação" onClick={() => aoCopiarCitacao(m)}>
                <Icone nome="ligar" tamanho={14} />
              </button>
              <button aria-label="Apagar marcação" title="Apagar" onClick={() => aoApagar(m)}>
                <Icone nome="lixo" tamanho={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
