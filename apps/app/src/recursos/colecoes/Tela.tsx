// Coleções: espaços que a pessoa cria, cada um com a sua cor (a atmosfera muda quando você entra nele).
import { Icone } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Capa, CartaoObra } from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import type { Colecoes } from './estado';
import './colecoes.css';

const MATIZES = [32, 0, 330, 285, 255, 215, 190, 160, 120, 60];

export function TelaColecoes({ colecoes: estado }: { colecoes: Colecoes }) {
  const { colecoes, todas } = useFatia(estado.store, (s) => s);
  useEffect(() => {
    void estado.carregar().catch(() => undefined);
  }, [estado]);
  const [nova, setNova] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [matiz, setMatiz] = useState(255);
  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Coleções</h1>
          <p>Lugares que você monta dentro da biblioteca.</p>
        </div>
        <button className="f-botao" data-tipo="luz" onClick={() => setNova(true)}>
          <Icone nome="mais" /> Nova coleção
        </button>
      </div>
      {nova && (
        <form
          className="f-cartao colecao-nova"
          onSubmit={(e) => {
            e.preventDefault();
            void estado.criar(nome, descricao, matiz).then(
              (c) => {
                setNova(false);
                setNome('');
                setDescricao('');
                ir({ tela: 'colecao', id: c.id });
              },
              () => undefined,
            );
          }}
        >
          <input
            className="f-campo"
            placeholder="Nome da coleção"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            aria-label="Nome"
          />
          <input
            className="f-campo"
            placeholder="Uma frase sobre ela (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            aria-label="Descrição"
          />
          <div className="matizes" role="group" aria-label="Cor">
            {MATIZES.map((m) => (
              <button
                type="button"
                key={m}
                aria-pressed={matiz === m}
                aria-label={`cor ${m}`}
                style={{ background: `hsl(${m} 55% 50%)` }}
                onClick={() => setMatiz(m)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="f-botao" data-tipo="luz" type="submit" disabled={!nome.trim()}>
              Criar
            </button>
            <button className="f-botao" type="button" onClick={() => setNova(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div className="colecoes-grade" style={{ marginTop: 16 }}>
        {colecoes.map((c) => (
          <button
            key={c.id}
            className="colecao-cartao"
            style={{ '--c-matiz': c.matiz } as CSSProperties}
            onClick={() => ir({ tela: 'colecao', id: c.id })}
          >
            <div>
              <h2>{c.nome}</h2>
              <p>{c.descricao}</p>
            </div>
            <div>
              <div className="colecao-capas">
                {todas
                  .filter((o) => c.obraIds.includes(o.id))
                  .slice(0, 6)
                  .map((o) => (
                    <div key={o.id}>
                      <Capa obra={o} compacto />
                    </div>
                  ))}
              </div>
              <small style={{ color: 'var(--texto-3)' }}>{c.obraIds.length} obras</small>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

export function TelaColecao({ colecoes: estado, id }: { colecoes: Colecoes; id: string }) {
  const { colecoes, todas } = useFatia(estado.store, (s) => s);
  const [editando, setEditando] = useState(false);
  const c = colecoes.find((x) => x.id === id);
  useEffect(() => {
    void estado.carregar().catch(() => undefined);
  }, [estado]);
  // a atmosfera (cor do fundo) muda com a coleção aberta
  useEffect(() => {
    if (c) document.documentElement.style.setProperty('--matiz', String(c.matiz));
  }, [c]);
  if (!c) return <p className="carregando">Abrindo…</p>;
  const obras = todas.filter((o) => c.obraIds.includes(o.id));
  return (
    <>
      <button
        className="f-botao"
        data-tipo="fantasma"
        data-tamanho="p"
        onClick={() => ir({ tela: 'colecoes' })}
        style={{ marginBottom: 16 }}
      >
        <Icone nome="voltar" tamanho={16} /> Coleções
      </button>
      <div className="titulo-tela">
        <div>
          <span className="f-rotulo">Coleção · {obras.length} obras</span>
          <h1>{c.nome}</h1>
          <p>{c.descricao}</p>
        </div>
        <button className="f-botao" onClick={() => setEditando(!editando)}>
          {editando ? 'Pronto' : 'Escolher obras'}
        </button>
      </div>
      {editando ? (
        <div className="lista-obras">
          {todas.map((o) => {
            const tem = c.obraIds.includes(o.id);
            return (
              <label key={o.id} className="linha-obra" style={{ gridTemplateColumns: '24px 40px 1fr 160px' }}>
                <input
                  type="checkbox"
                  checked={tem}
                  onChange={() =>
                    void estado.definirObras(c.id, tem ? c.obraIds.filter((x) => x !== o.id) : [...c.obraIds, o.id])
                  }
                />
                <Capa obra={o} compacto />
                <span>{o.titulo}</span>
                <span className="secundario">{o.criadores[0]?.nome}</span>
              </label>
            );
          })}
        </div>
      ) : obras.length ? (
        <div className="grade">
          {obras.map((o) => (
            <CartaoObra key={o.id} obra={o} />
          ))}
        </div>
      ) : (
        <div className="vazio">
          <h2>Coleção vazia</h2>
          <p>Use "Escolher obras" para trazer obras pra cá.</p>
        </div>
      )}
    </>
  );
}
