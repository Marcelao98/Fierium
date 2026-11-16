// A página de uma obra: a obra (não o arquivo). Mostra as edições e os arquivos de cada uma, o progresso, as marcações
// e as obras da mesma constelação (mesmo autor, mesma área, mesmos assuntos).
import { Anel, Icone } from '@fierium/ui';
import type { Obra } from '@fierium/contratos';
import { useEffect, useState } from 'react';
import { CartaoMarcacao, useCores } from '../../compartilhado/Marcacoes';
import {
  autorDe,
  Capa,
  CartaoObra,
  formatosDe,
  fracaoDe,
  haQuanto,
  lerObra,
  Prateleira,
  tempoRestante,
} from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import { CorrigirDados } from './Corrigir';
import type { PaginaObraEstado } from './estado';
import './obra.css';

const tamanho = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

export function TelaObra({ estado, id }: { estado: PaginaObraEstado; id: string }) {
  const { obra, marcacoes: marcacoesDaObra, colecoes, parecidas } = useFatia(estado.store, (s) => s);
  const cores = useCores();
  const [juntando, setJuntando] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  useEffect(() => {
    setJuntando(false);
    setCorrigindo(false);
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
            {autorDe(obra) ? (
              <button
                className="ficha-autor"
                title={`Obras de ${autorDe(obra)}`}
                onClick={() => ir({ tela: 'autor', nome: autorDe(obra) })}
              >
                {autorDe(obra)}
              </button>
            ) : null}
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
            <button
              className="f-botao"
              data-tipo="fantasma"
              aria-expanded={corrigindo}
              onClick={() => setCorrigindo(!corrigindo)}
            >
              Corrigir dados…
            </button>
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

          {corrigindo && <CorrigirDados estado={estado} obra={obra} />}

          <section className="secao">
            <h2>Edições e arquivos</h2>
            {obra.edicoes.map((e) => {
              const detalhes = [
                e.descricao,
                e.idioma,
                e.paginas ? `${e.paginas} páginas` : '',
                e.progresso ? `${Math.round(e.progresso.fracao * 100)}% lido` : 'nunca aberta',
              ].filter(Boolean);
              const disponivel = e.arquivos.some((a) => a.disponivel);
              return (
                <div key={e.id} className="edicao f-cartao">
                  <span className="formato">{e.formato.toUpperCase()}</span>
                  <div>
                    {detalhes.join(' · ')}
                    {e.arquivos.map((a) => (
                      <small key={a.id}>
                        {a.caminho} · {tamanho(a.tamanho)}
                        {a.disponivel ? '' : ' · arquivo não encontrado'}
                      </small>
                    ))}
                  </div>
                  <div className="edicao-acoes">
                    <button
                      className="f-botao"
                      data-tamanho="p"
                      disabled={!disponivel}
                      aria-label={`Abrir a edição ${e.formato.toUpperCase()}`}
                      onClick={(ev) => lerObra(obra, ev, undefined, e.id)}
                    >
                      Abrir
                    </button>
                    {obra.edicoes.length > 1 && (
                      <button
                        className="f-botao"
                        data-tipo="fantasma"
                        data-tamanho="p"
                        title="Esta edição é de outro livro: separar numa obra própria"
                        aria-label={`Separar a edição ${e.formato.toUpperCase()}`}
                        onClick={() =>
                          void estado.separar(e.id).then(
                            (nova) => ir({ tela: 'obra', id: nova }),
                            () => undefined, // o aviso já saiu
                          )
                        }
                      >
                        Separar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              className="f-botao"
              data-tipo="fantasma"
              data-tamanho="p"
              aria-expanded={juntando}
              onClick={() => setJuntando(!juntando)}
            >
              Juntar com outra obra…
            </button>
            {juntando && (
              <JuntarObra
                obra={obra}
                todas={estado.todas}
                aoEscolher={(outra) => {
                  setJuntando(false);
                  void estado.juntar(outra.id).catch(() => undefined); // o aviso já saiu
                }}
              />
            )}
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
                        <button onClick={(e) => lerObra(obra, e, m.id, m.edicaoId)}>Ir para o trecho</button>
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

/** Escolher a outra obra que é o mesmo livro (o PDF de um EPUB, a cópia com outro nome…): ela vira edição desta. */
function JuntarObra({
  obra,
  todas,
  aoEscolher,
}: {
  obra: Obra;
  todas: () => Promise<Obra[]>;
  aoEscolher: (outra: Obra) => void;
}) {
  const [lista, setLista] = useState<Obra[]>([]);
  const [texto, setTexto] = useState('');
  useEffect(() => {
    let vivo = true;
    void todas().then(
      (l) => vivo && setLista(l.filter((o) => o.id !== obra.id)),
      () => undefined, // o aviso já saiu
    );
    return () => {
      vivo = false;
    };
  }, [obra.id, todas]);
  const simples = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const palavras = simples(texto).split(/\s+/).filter(Boolean);
  const achadas = lista.filter((o) => palavras.every((p) => simples(`${o.titulo} ${autorDe(o)}`).includes(p)));
  return (
    <div className="juntar f-cartao" role="group" aria-label="Juntar com outra obra">
      <p>Escolha a obra que é o mesmo livro. As edições, o progresso e as marcações dela vêm pra cá.</p>
      <input
        className="f-campo"
        type="search"
        placeholder="Buscar por título ou autor…"
        aria-label="Buscar a obra pra juntar"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoFocus
      />
      <div className="juntar-lista">
        {achadas.slice(0, 8).map((o) => (
          <button key={o.id} className="juntar-item" onClick={() => aoEscolher(o)}>
            <strong>{o.titulo}</strong>
            <span>{[autorDe(o), formatosDe(o)].filter(Boolean).join(' · ')}</span>
          </button>
        ))}
        {!achadas.length && <p className="juntar-vazio">Nenhuma outra obra com esse nome.</p>}
      </div>
    </div>
  );
}
