// A página de uma obra: a obra (não o arquivo). Mostra as edições e os arquivos de cada uma, o progresso, as marcações
// e as obras da mesma constelação (mesmo autor, mesma área, mesmos assuntos).
import { Anel, Icone } from '@fierium/ui';
import { useEffect } from 'react';
import { CartaoMarcacao, useCores } from '../../compartilhado/Marcacoes';
import {
  autorDe,
  Capa,
  CartaoObra,
  fracaoDe,
  haQuanto,
  lerObra,
  Prateleira,
  tempoRestante,
} from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import type { PaginaObraEstado } from './estado';
import './obra.css';

const tamanho = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

export function TelaObra({ estado, id }: { estado: PaginaObraEstado; id: string }) {
  const { obra, marcacoes: marcacoesDaObra, colecoes, parecidas } = useFatia(estado.store, (s) => s);
  const cores = useCores();
  useEffect(() => {
    void estado.abrir(id).catch(() => undefined);
  }, [estado, id]);
  if (!obra || obra.id !== id) return <p className="carregando">Abrindo…</p>;
  const f = fracaoDe(obra);
  return (
    <>
      <button
        className="f-botao"
        data-tipo="fantasma"
        data-tamanho="p"
        onClick={() => history.back()}
        style={{ marginBottom: 16 }}
      >
        <Icone nome="voltar" tamanho={16} /> Voltar
      </button>
      <div className="obra-topo">
        <div className="obra-capa">
          <Capa obra={obra} />
        </div>
        <div>
          <span className="f-rotulo">
            {obra.reino}
            {obra.serie ? ` · ${obra.serie.nome}, vol. ${obra.serie.volume}` : ''}
          </span>
          <h1>{obra.titulo}</h1>
          <p className="obra-autor">
            {autorDe(obra)}
            {obra.ano ? `, ${obra.ano}` : ''}
          </p>
          <div className="obra-meta">
            {obra.assuntos.map((a) => (
              <span key={a} className="etiqueta">
                {a}
              </span>
            ))}
          </div>
          <div className="obra-acoes">
            <button className="f-botao" data-tipo="luz" onClick={(e) => lerObra(obra, e)}>
              <Icone nome="ler" /> {f > 0 && f < 1 ? 'Continuar' : f >= 1 ? 'Ler de novo' : 'Começar a ler'}
            </button>
            <button
              className="f-botao"
              aria-pressed={obra.relacao.favorita}
              onClick={() => void estado.favoritar(!obra.relacao.favorita).catch(() => undefined)}
            >
              <Icone nome="estrela" fill={obra.relacao.favorita ? 'currentColor' : 'none'} />{' '}
              {obra.relacao.favorita ? 'Favorita' : 'Favoritar'}
            </button>
            {obra.relacao.estado !== 'lida' && (
              <button
                className="f-botao"
                data-tipo="fantasma"
                onClick={() => void estado.marcarComoLida().catch(() => undefined)}
              >
                <Icone nome="check" /> Marcar como lida
              </button>
            )}
            {f > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--texto-2)' }}>
                <Anel fracao={f} />
                {obra.relacao.estado === 'lida'
                  ? `Lida ${obra.relacao.terminadaEm ? haQuanto(obra.relacao.terminadaEm) : ''}`
                  : tempoRestante(obra)
                    ? `${tempoRestante(obra)} restantes`
                    : ''}
              </span>
            )}
          </div>

          <section className="secao">
            <h2>Edições e arquivos</h2>
            {obra.edicoes.map((e) => (
              <div key={e.id} className="edicao f-cartao">
                <span className="formato">{e.formato.toUpperCase()}</span>
                <div>
                  {e.descricao} · {e.idioma}
                  {e.paginas ? ` · ${e.paginas} páginas` : ''}
                  {e.arquivos.map((a) => (
                    <small key={a.id}>
                      {a.caminho} · {tamanho(a.tamanho)}
                    </small>
                  ))}
                </div>
                <button className="f-botao" data-tamanho="p" onClick={(ev) => lerObra(obra, ev)}>
                  Abrir
                </button>
              </div>
            ))}
          </section>

          {obra.colecaoIds.length > 0 && (
            <section className="secao">
              <h2>Nas coleções</h2>
              <div className="chips">
                {colecoes
                  .filter((c) => obra.colecaoIds.includes(c.id))
                  .map((c) => (
                    <button key={c.id} className="f-chip" onClick={() => ir({ tela: 'colecao', id: c.id })}>
                      {c.nome}
                    </button>
                  ))}
              </div>
            </section>
          )}

          <section className="secao">
            <h2>Marcações e notas</h2>
            {marcacoesDaObra.length ? (
              <div className="marcacoes">
                {marcacoesDaObra.map((m) => (
                  <CartaoMarcacao
                    key={m.id}
                    marcacao={m}
                    cores={cores}
                    acoes={
                      m.ancora.tipo === 'texto' ? (
                        <button onClick={(e) => lerObra(obra, e, m.id)}>Ir para o trecho</button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--texto-3)' }}>
                Nenhuma marcação ainda. Selecione um trecho enquanto lê para marcar.
              </p>
            )}
          </section>
        </div>
      </div>
      {parecidas.length > 0 && (
        <Prateleira titulo="Da mesma constelação">
          {parecidas.map((o) => (
            <CartaoObra key={o.id} obra={o} />
          ))}
        </Prateleira>
      )}
    </>
  );
}
