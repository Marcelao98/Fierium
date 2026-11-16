import { useEffect, useState } from 'react';
import { useFatia } from '../../nucleo/contexto';
import type { Pastas } from './estado';

export function PastasDeLivros({ pastas }: { pastas: Pastas }) {
  const lista = useFatia(pastas.store, (s) => s.pastas);
  const varrendo = useFatia(pastas.store, (s) => s.varrendo);
  const resultado = useFatia(pastas.store, (s) => s.resultado);
  const erro = useFatia(pastas.store, (s) => s.erro);
  const sugestoes = useFatia(pastas.store, (s) => s.sugestoes);
  const [caminho, setCaminho] = useState('');

  useEffect(() => void pastas.carregar(), [pastas]);

  const adicionar = async () => {
    if (!caminho.trim()) return;
    if (await pastas.adicionar(caminho)) setCaminho('');
  };

  return (
    <section className="pastas" aria-label="Pastas de livros">
      <div className="pastas-cab">
        <div>
          Pastas de livros
          <small>
            Onde moram os seus PDF e EPUB.{' '}
            {pastas.podeEscolher
              ? 'Escolha a pasta no seletor do sistema.'
              : 'Digite ou cole o caminho (ex.: ~/Livros).'}
          </small>
        </div>
        <button className="f-botao" disabled={varrendo || lista.length === 0} onClick={() => void pastas.varrer()}>
          {varrendo ? 'Procurando…' : 'Procurar livros agora'}
        </button>
      </div>
      {lista.length === 0 && <p className="pastas-vazio">Nenhuma pasta ainda.</p>}
      <ul className="pastas-lista">
        {lista.map((p) => (
          <li key={p.caminho}>
            <span className="pasta-caminho">{p.caminho}</span>
            <small>{p.existe ? `${p.arquivos} livros` : 'não encontrada'}</small>
            <button
              className="f-botao"
              data-tamanho="p"
              aria-label={`Remover ${p.caminho}`}
              onClick={() => void pastas.remover(p.caminho)}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      {pastas.podeEscolher && (
        <div className="pastas-escolher">
          <button className="f-botao" data-tipo="luz" disabled={varrendo} onClick={() => void pastas.escolher()}>
            Escolher pasta…
          </button>
        </div>
      )}
      {sugestoes.length > 0 && (
        <div className="pastas-sugestoes" aria-label="Pastas sugeridas">
          <small>Sugestões:</small>
          {sugestoes.map((c) => (
            <button
              key={c}
              className="f-botao"
              data-tamanho="p"
              disabled={varrendo}
              onClick={() => void pastas.adicionar(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {pastas.podeEscolher && <small className="pastas-ou">ou digite o caminho</small>}
      <form
        className="pastas-novo"
        onSubmit={(e) => {
          e.preventDefault();
          void adicionar();
        }}
      >
        <input
          className="f-campo"
          aria-label="Caminho da pasta"
          placeholder="~/Livros"
          value={caminho}
          onChange={(e) => setCaminho(e.target.value)}
        />
        <button className="f-botao" type="submit" disabled={varrendo || !caminho.trim()}>
          Adicionar
        </button>
      </form>
      {erro && (
        <p className="pastas-erro" role="alert">
          {erro}
        </p>
      )}
      {resultado && !erro && (
        <p className="pastas-resultado" role="status">
          {resultado.novos} novos · {resultado.total} livros · {(resultado.milissegundos / 1000).toFixed(1)} s
        </p>
      )}
    </section>
  );
}
