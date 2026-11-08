// Estatísticas: o que você leu, sem culpa. Números do dia e da semana, sequência (hoje sem leitura não quebra),
// calendário do ano, os últimos 30 dias, por área e metas que você escolhe.
// Gráficos: uma série = uma cor só (a luz), barras finas com ponta arredondada, dica ao passar o mouse, texto sempre
// na cor do texto (nunca na cor da série).
import type { Meta, Periodo, TipoMeta } from '@fierium/contratos';
import { Icone } from '@fierium/ui';
import { useEffect, useState } from 'react';
import { useFatia } from '../../nucleo/contexto';
import type { Estatisticas } from './estado';
import { Calendario, tempo, Ultimos30 } from './Graficos';
import './estatisticas.css';

const PERIODO: Record<Periodo, string> = { dia: 'por dia', semana: 'por semana', mes: 'por mês', ano: 'por ano' };
const TIPO: Record<TipoMeta, string> = { livros: 'livros terminados', paginas: 'páginas', minutos: 'minutos lendo' };

export function TelaEstatisticas({ estatisticas }: { estatisticas: Estatisticas }) {
  const r = useFatia(estatisticas.store, (s) => s.resumo);
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [tipo, setTipo] = useState<TipoMeta>('paginas');
  const [alvo, setAlvo] = useState('100');
  useEffect(() => {
    void estatisticas.carregar().catch(() => undefined);
  }, [estatisticas]);
  if (!r) return <p className="carregando">Somando…</p>;
  const maxArea = Math.max(1, ...r.porReino.map((x) => x.segundos));
  const metas: Meta[] = r.metas.map((m) => m.meta);
  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Estatísticas</h1>
          <p>
            {r.horaFavorita !== null
              ? `Você lê mais por volta das ${r.horaFavorita}h${r.horaFavorita >= 20 || r.horaFavorita < 5 ? ': leitor da noite' : ''}.`
              : 'Leia um pouco e as suas estatísticas aparecem aqui.'}
          </p>
        </div>
      </div>
      <div className="numeros">
        <div className="numero f-cartao">
          <span className="f-rotulo">Hoje</span>
          <strong>{tempo(r.hoje.segundos)}</strong>
          <small>{r.hoje.paginas} páginas</small>
        </div>
        <div className="numero f-cartao">
          <span className="f-rotulo">Esta semana</span>
          <strong>{tempo(r.semana.segundos)}</strong>
          <small>{r.semana.paginas} páginas</small>
        </div>
        <div className="numero f-cartao">
          <span className="f-rotulo">Sequência</span>
          <strong>
            {r.sequencia} {r.sequencia === 1 ? 'dia' : 'dias'}
          </strong>
          <small>recorde: {r.recorde} dias</small>
        </div>
        <div className="numero f-cartao">
          <span className="f-rotulo">Terminados no ano</span>
          <strong>{r.terminadasNoAno}</strong>
          <small>obras</small>
        </div>
      </div>

      <section className="painel f-cartao">
        <h2>O seu ano</h2>
        <Calendario dias={r.dias} />
      </section>

      <div className="inicio-colunas">
        <section className="painel f-cartao">
          <h2>Últimos 30 dias</h2>
          <Ultimos30 dias={r.dias} />
        </section>
        <section className="painel f-cartao">
          <h2>Por área</h2>
          <div className="barras-reino">
            {r.porReino.map((x) => (
              <div key={x.reino} className="barra-reino">
                <span>{x.reino}</span>
                <div className="f-barra">
                  <span style={{ width: `${(x.segundos / maxArea) * 100}%` }} />
                </div>
                <span>{tempo(x.segundos)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="painel f-cartao">
        <h2>Metas</h2>
        <div className="metas">
          {r.metas.map((s) => (
            <div key={s.meta.id} className="meta">
              <span>
                {s.meta.alvo} {TIPO[s.meta.tipo]} {PERIODO[s.meta.periodo]}
              </span>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--texto-2)' }}>
                {s.feito} de {s.meta.alvo}
                {s.fracao >= 1 && ' ✓'}
                <button
                  className="f-botao f-icone-botao"
                  data-tipo="fantasma"
                  aria-label="Apagar meta"
                  onClick={() => void estatisticas.salvarMetas(metas.filter((m) => m.id !== s.meta.id))}
                >
                  <Icone nome="lixo" tamanho={16} />
                </button>
              </span>
              <div className="f-barra">
                <span style={{ width: `${s.fracao * 100}%` }} />
              </div>
            </div>
          ))}
          {!r.metas.length && (
            <p style={{ color: 'var(--texto-3)', margin: 0 }}>Sem metas. Metas são opcionais e você escolhe tudo.</p>
          )}
        </div>
        <form
          className="meta-nova"
          onSubmit={(e) => {
            e.preventDefault();
            void estatisticas
              .salvarMetas([...metas, { id: crypto.randomUUID(), periodo, tipo, alvo: Number(alvo) }])
              .catch(() => undefined);
          }}
        >
          <input
            className="f-campo"
            type="number"
            min={1}
            value={alvo}
            onChange={(e) => setAlvo(e.target.value)}
            aria-label="Quanto"
          />
          <select
            className="f-campo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMeta)}
            aria-label="O quê"
          >
            {Object.entries(TIPO).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
          <select
            className="f-campo"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            aria-label="Período"
          >
            {Object.entries(PERIODO).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
          <button className="f-botao" type="submit">
            <Icone nome="mais" /> Adicionar meta
          </button>
        </form>
      </section>
    </>
  );
}
