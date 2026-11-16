// Notas: o lugar de achar tudo o que foi marcado, em todos os livros. Filtros (livro, cor, tipo, texto sem acento),
// abrir no trecho, copiar citação pronta, aba Citações em leitura corrida e exportar em Markdown.
import type { Marcacao, Obra } from '@fierium/contratos';
import { Icone } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CartaoMarcacao, corDe, useCores } from '../../compartilhado/Marcacoes';
import { lerObra } from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import { formatoLembrado } from '../../compartilhado/citacao';
import { agrupar, citacao, filtrar, TIPOS, type AbaNotas, type FiltroNotas, type FormatoCitacao } from './citacao';
import type { Notas } from './estado';
import { paraMarkdown } from './markdown';
import './notas.css';

const CHAVE_FORMATO = 'fierium.notas.formato';

function baixar(nome: string, texto: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/markdown' }));
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function TelaNotas({ notas }: { notas: Notas }) {
  const { marcacoes, obras } = useFatia(notas.store, (s) => s);
  const cores = useCores();
  const [aba, setAba] = useState<AbaNotas>('todas');
  const [f, setF] = useState<FiltroNotas>({});
  const [formato, setFormato] = useState<FormatoCitacao>(formatoLembrado);
  const [editando, setEditando] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [apagando, setApagando] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    void notas.carregar().catch(() => undefined);
  }, [notas]);

  const nomeCor = (id: string) => corDe(cores, id).nome;
  const idCitacao = cores.find((c) => c.id === 'citacao')?.id ?? 'citacao';
  const base = useMemo(
    () => (aba === 'citacoes' ? marcacoes.filter((m) => m.cor === idCitacao) : marcacoes),
    [aba, marcacoes, idCitacao],
  );
  const filtro = useMemo(() => (aba === 'citacoes' ? { ...f, cor: undefined, tipo: undefined } : f), [aba, f]);
  const visiveis = useMemo(() => filtrar(base, filtro, obras), [base, filtro, obras]);
  const grupos = useMemo(() => agrupar(visiveis, obras), [visiveis, obras]);
  const ordenadas = grupos.flatMap((g) => g.marcacoes);
  const porId = new Map(marcacoes.map((m) => [m.id, m]));
  const livros = useMemo(
    () => agrupar(base, obras).map((g) => ({ id: g.obraId, titulo: g.obra?.titulo ?? 'Obra', n: g.marcacoes.length })),
    [base, obras],
  );
  const contar = (campo: keyof FiltroNotas, valor: string) =>
    filtrar(base, { ...filtro, [campo]: valor }, obras, campo).length;

  const mudar = (m: Partial<FiltroNotas>) => setF((x) => ({ ...x, ...m }));
  const escolherFormato = (v: FormatoCitacao) => {
    setFormato(v);
    try {
      localStorage.setItem(CHAVE_FORMATO, v);
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
  };
  const copiar = async (texto: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(msg);
    } catch {
      setAviso('Não consegui copiar: o sistema não deixou acessar a área de transferência.');
    }
  };
  const textoCitacao = (m: Marcacao) => citacao(m, obras.get(m.obraId), formato);
  const exportar = (lista: Marcacao[], arquivo: string) => baixar(arquivo, paraMarkdown(lista, obras, nomeCor));
  const abrir = (obra: Obra, e: React.MouseEvent, m: Marcacao) => lerObra(obra, e, m.id);

  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Notas</h1>
          <p>Tudo o que você marcou e escreveu, de todos os livros.</p>
        </div>
        <div className="notas-exportar">
          <button
            className="f-botao"
            onClick={() =>
              exportar(
                agrupar(marcacoes, obras).flatMap((g) => g.marcacoes),
                'notas-fierium.md',
              )
            }
            disabled={!marcacoes.length}
          >
            <Icone nome="baixar" /> Exportar tudo
          </button>
          <button
            className="f-botao"
            onClick={() => exportar(ordenadas, 'notas-fierium-filtro.md')}
            disabled={!ordenadas.length}
          >
            <Icone nome="baixar" /> Exportar o filtro
          </button>
          <button
            className="f-botao"
            onClick={() =>
              void copiar(ordenadas.map(textoCitacao).join('\n\n'), `${ordenadas.length} citações copiadas.`)
            }
            disabled={!ordenadas.length}
          >
            Copiar tudo do filtro
          </button>
        </div>
      </div>

      <div className="notas-abas" role="tablist" aria-label="O que mostrar">
        <button role="tab" aria-selected={aba === 'todas'} onClick={() => setAba('todas')}>
          Todas ({marcacoes.length})
        </button>
        <button role="tab" aria-selected={aba === 'citacoes'} onClick={() => setAba('citacoes')}>
          Citações ({marcacoes.filter((m) => m.cor === idCitacao).length})
        </button>
        <label className="notas-formato">
          Citar como
          <select
            className="f-campo"
            value={formato}
            onChange={(e) => escolherFormato(e.target.value as FormatoCitacao)}
            aria-label="Formato da citação"
          >
            <option value="simples">Autor, Título, página</option>
            <option value="abnt">ABNT simples</option>
          </select>
        </label>
      </div>

      <div className="barra-ferramentas">
        <input
          className="f-campo"
          type="search"
          placeholder="Buscar nas marcações e notas…"
          aria-label="Buscar nas notas"
          value={f.texto ?? ''}
          onChange={(e) => mudar({ texto: e.target.value })}
        />
        <select
          className="f-campo"
          aria-label="Livro"
          value={f.obraId ?? ''}
          onChange={(e) => mudar({ obraId: e.target.value || undefined })}
        >
          <option value="">Todos os livros</option>
          {livros.map((l) => (
            <option key={l.id} value={l.id}>
              {l.titulo} ({l.n})
            </option>
          ))}
        </select>
      </div>

      {aba === 'todas' && (
        <>
          <div className="chips" aria-label="Significado">
            <button className="f-chip" aria-pressed={!f.cor} onClick={() => mudar({ cor: undefined })}>
              Todas as cores
            </button>
            {cores.map((c) => (
              <button
                key={c.id}
                className="f-chip"
                aria-pressed={f.cor === c.id}
                style={{ '--cor-marca': c.cor } as CSSProperties}
                onClick={() => mudar({ cor: f.cor === c.id ? undefined : c.id })}
              >
                <span className="cor-ponto" />
                {c.nome} ({contar('cor', c.id)})
              </button>
            ))}
          </div>
          <div className="chips" aria-label="Tipo">
            <button className="f-chip" aria-pressed={!f.tipo} onClick={() => mudar({ tipo: undefined })}>
              Todos os tipos
            </button>
            {TIPOS.map((t) => (
              <button
                key={t.id}
                className="f-chip"
                aria-pressed={f.tipo === t.id}
                onClick={() => mudar({ tipo: f.tipo === t.id ? undefined : t.id })}
              >
                {t.nome} ({contar('tipo', t.id)})
              </button>
            ))}
          </div>
        </>
      )}
      <p className="contagem" role="status">
        {visiveis.length} {visiveis.length === 1 ? 'marcação' : 'marcações'}
        {aviso && <span className="notas-aviso"> · {aviso}</span>}
      </p>

      {!visiveis.length ? (
        <div className="vazio">
          <h2>Nenhuma marcação aqui</h2>
          <p>
            {aba === 'citacoes'
              ? 'Marque trechos com a cor “Citação” enquanto lê e eles aparecem aqui, prontos pra copiar.'
              : 'Enquanto lê, selecione um trecho para marcar com uma cor e escrever uma nota.'}
          </p>
        </div>
      ) : (
        grupos.map((g) => (
          <section key={g.obraId} className="notas-grupo" aria-label={g.obra?.titulo ?? 'Obra'}>
            <header>
              <h2>{g.obra?.titulo ?? 'Obra'}</h2>
              <span className="contagem">{g.marcacoes.length}</span>
              <button
                className="f-botao"
                data-tamanho="p"
                onClick={() => exportar(g.marcacoes, `notas-${slug(g.obra?.titulo ?? 'obra')}.md`)}
              >
                <Icone nome="baixar" /> Exportar este livro
              </button>
            </header>
            {aba === 'citacoes' ? (
              <div className="citacoes">
                {g.marcacoes.map((m) => (
                  <figure key={m.id} className="citacao">
                    <blockquote>“{m.trecho}”</blockquote>
                    <figcaption>
                      {textoCitacao(m)
                        .slice(m.trecho.length + 2)
                        .replace(/^ — /, '— ')}
                    </figcaption>
                    {m.nota && <p className="marcacao-nota">{m.nota}</p>}
                    <div className="marcacao-rodape">
                      <button onClick={() => void copiar(textoCitacao(m), 'Citação copiada.')}>Copiar citação</button>
                      {g.obra && <button onClick={(e) => abrir(g.obra!, e, m)}>Abrir no trecho</button>}
                    </div>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="marcacoes">
                {g.marcacoes.map((m) => (
                  <CartaoMarcacao
                    key={m.id}
                    marcacao={m}
                    obra={g.obra}
                    cores={cores}
                    nota={
                      editando === m.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void notas.anotar(m.id, nota).then(
                              () => setEditando(null),
                              () => setAviso('Não consegui salvar a nota.'),
                            );
                          }}
                          style={{ display: 'grid', gap: 8, margin: '8px 0' }}
                        >
                          <textarea
                            className="f-campo"
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                            autoFocus
                            aria-label="Nota"
                            rows={3}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="f-botao" data-tamanho="p" data-tipo="luz" type="submit">
                              Salvar nota
                            </button>
                            <button
                              className="f-botao"
                              data-tamanho="p"
                              type="button"
                              onClick={() => setEditando(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : undefined
                    }
                    acoes={
                      <>
                        <time dateTime={new Date(m.criadaEm).toISOString()}>
                          {new Date(m.criadaEm).toLocaleDateString('pt-BR')}
                        </time>
                        {g.obra && <button onClick={(e) => abrir(g.obra!, e, m)}>Abrir no trecho</button>}
                        <button onClick={() => void copiar(textoCitacao(m), 'Citação copiada.')}>Copiar citação</button>
                        <button
                          onClick={() => {
                            setEditando(m.id);
                            setNota(m.nota ?? '');
                          }}
                        >
                          {m.nota ? 'Editar nota' : 'Escrever nota'}
                        </button>
                        {apagando === m.id ? (
                          <button
                            onClick={() =>
                              void notas.apagar(m.id).then(
                                () => setApagando(null),
                                () => setAviso('Não consegui apagar a marcação.'),
                              )
                            }
                          >
                            Confirmar apagar
                          </button>
                        ) : (
                          <button onClick={() => setApagando(m.id)}>Apagar</button>
                        )}
                        {g.obra && m.ancora.tipo !== 'texto' && (
                          <button onClick={() => ir({ tela: 'obra', id: g.obra!.id })}>Ver a obra</button>
                        )}
                        {m.ligacoes.map((l) => {
                          const outra = porId.get(l);
                          return outra ? (
                            <button
                              key={l}
                              className="ligacao"
                              title={`“${outra.trecho}”`}
                              onClick={() =>
                                document
                                  .getElementById('m-' + l)
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                            >
                              ↔ ligada a {obras.get(outra.obraId)?.titulo}
                            </button>
                          ) : null;
                        })}
                        <span id={'m-' + m.id} />
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </>
  );
}
