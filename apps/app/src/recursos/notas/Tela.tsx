// Notas: todas as marcações e notas da biblioteca num lugar só. Filtrar por cor (o significado), buscar, ver as
// ligações entre trechos de livros diferentes, editar a nota e exportar em Markdown.
import { Icone } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { CartaoMarcacao, corDe, useCores } from '../../compartilhado/Marcacoes';
import { lerObra } from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import type { Notas } from './estado';
import { paraMarkdown } from './markdown';
import './notas.css';

export function TelaNotas({ notas }: { notas: Notas }) {
  const { marcacoes, obras, cor, texto } = useFatia(notas.store, (s) => s);
  const cores = useCores();
  const [busca, setBusca] = useState(texto);
  const [editando, setEditando] = useState<string | null>(null);
  const [nota, setNota] = useState('');

  useEffect(() => {
    const t = setTimeout(() => void notas.carregar({ texto: busca }).catch(() => undefined), 120);
    return () => clearTimeout(t);
  }, [busca, notas]);

  const exportar = () => {
    const md = paraMarkdown(marcacoes, obras, (id) => corDe(cores, id).nome);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = 'notas-fierium.md';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const porId = new Map(marcacoes.map((m) => [m.id, m]));

  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Notas</h1>
          <p>Tudo o que você marcou e escreveu, de todos os livros.</p>
        </div>
        <button className="f-botao" onClick={exportar} disabled={!marcacoes.length}>
          <Icone nome="baixar" /> Exportar Markdown
        </button>
      </div>
      <div className="barra-ferramentas">
        <input
          className="f-campo"
          type="search"
          placeholder="Buscar nas marcações e notas…"
          aria-label="Buscar nas notas"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <div className="chips">
        <button className="f-chip" aria-pressed={!cor} onClick={() => void notas.carregar({ cor: undefined })}>
          Todas as cores
        </button>
        {cores.map((c) => (
          <button
            key={c.id}
            className="f-chip"
            aria-pressed={cor === c.id}
            style={{ '--cor-marca': c.cor } as CSSProperties}
            onClick={() => void notas.carregar({ cor: cor === c.id ? undefined : c.id })}
          >
            <span className="cor-ponto" />
            {c.nome}
          </button>
        ))}
        <span className="contagem">{marcacoes.length} marcações</span>
      </div>
      {!marcacoes.length ? (
        <div className="vazio">
          <h2>Nenhuma marcação aqui</h2>
          <p>Enquanto lê, selecione um trecho para marcar com uma cor e escrever uma nota.</p>
        </div>
      ) : (
        <div className="marcacoes">
          {marcacoes.map((m) => {
            const obra = obras.get(m.obraId);
            return (
              <CartaoMarcacao
                key={m.id}
                marcacao={m}
                obra={obra}
                cores={cores}
                nota={
                  editando === m.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void notas.anotar(m.id, nota).then(
                          () => setEditando(null),
                          () => undefined,
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
                        <button className="f-botao" data-tamanho="p" type="button" onClick={() => setEditando(null)}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : undefined
                }
                acoes={
                  <>
                    <button
                      onClick={() => {
                        setEditando(m.id);
                        setNota(m.nota ?? '');
                      }}
                    >
                      {m.nota ? 'Editar nota' : 'Escrever nota'}
                    </button>
                    {obra && m.ancora.tipo === 'texto' && (
                      <button onClick={(e) => lerObra(obra, e, m.id)}>Ir para o trecho</button>
                    )}
                    {obra && m.ancora.tipo !== 'texto' && (
                      <button onClick={() => ir({ tela: 'obra', id: obra.id })}>Ver a obra</button>
                    )}
                    {m.ligacoes.map((l) => {
                      const outra = porId.get(l);
                      return outra ? (
                        <button
                          key={l}
                          className="ligacao"
                          title={`“${outra.trecho}”`}
                          onClick={() =>
                            document.getElementById('m-' + l)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
            );
          })}
        </div>
      )}
    </>
  );
}
