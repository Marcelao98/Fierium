// Descobrir: a busca no catálogo inteiro e as linhas prontas (que rolam de lado). Mais a ficha de um item do catálogo.
import type { ItemCatalogo } from '@fierium/contratos';
import { Icone } from '@fierium/ui';
import { useEffect, useState } from 'react';
import { AvisoDoCatalogo, CapaItem, CartaoCinza, lerBaixado } from '../../compartilhado/Catalogo';
import { autorDoItem, licencaDoItem } from '../../compartilhado/catalogo';
import { CartaoObra, Prateleira } from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import type { Descobrir } from './estado';

function Item({ item, d }: { item: ItemCatalogo; d: Descobrir }) {
  const obras = useFatia(d.store, (s) => s.obras);
  const fases = useFatia(d.baixador.store, (s) => s);
  const obra = item.obraId ? obras[item.obraId] : undefined;
  if (obra) return <CartaoObra obra={obra} />;
  return (
    <CartaoCinza item={item} fase={fases[item.id]} aoBaixar={() => void d.baixador.baixar(item.id).then(lerBaixado)} />
  );
}

export function TelaDescobrir({ descobrir: d }: { descobrir: Descobrir }) {
  const { texto, resultados, total, colecoes, carregando } = useFatia(d.store, (s) => s);
  const fase = useFatia(d.vigia.store, (s) => s.estado?.fase);
  const [campo, setCampo] = useState(texto);
  useEffect(() => {
    void d.carregar().catch(() => undefined);
  }, [d]);
  useEffect(() => {
    const t = setTimeout(() => void d.buscar(campo).catch(() => undefined), 150);
    return () => clearTimeout(t);
  }, [campo, d]);
  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Descobrir</h1>
          <p>O que existe nos catálogos abertos. O que você já tem aparece colorido; o resto, em cinza.</p>
        </div>
      </div>
      <div className="barra-ferramentas">
        <input
          className="f-campo"
          type="search"
          placeholder="Buscar no catálogo inteiro: título ou autor…"
          aria-label="Buscar no catálogo"
          value={campo}
          onChange={(e) => setCampo(e.target.value)}
        />
      </div>
      <AvisoDoCatalogo vigia={d.vigia} />
      {fase && fase !== 'pronto' ? null : resultados ? (
        <section aria-label="Resultados da busca">
          <p className="contagem" style={{ marginLeft: 0, marginBottom: 12 }} aria-live="polite">
            {total} {total === 1 ? 'resultado' : 'resultados'}
          </p>
          {resultados.length ? (
            <div className="grade">
              {resultados.map((i) => (
                <Item key={i.id} item={i} d={d} />
              ))}
            </div>
          ) : (
            <div className="vazio">
              <h2>Nada no catálogo com isso</h2>
              <p>Tente outras palavras.</p>
            </div>
          )}
        </section>
      ) : (
        <>
          {!colecoes.length && <p className="carregando">{carregando ? 'Montando as coleções…' : ''}</p>}
          {colecoes.map((c) => (
            <Prateleira key={c.id} titulo={c.titulo}>
              {c.itens.map((i) => (
                <Item key={i.id} item={i} d={d} />
              ))}
            </Prateleira>
          ))}
        </>
      )}
    </>
  );
}

/** A ficha de um item do catálogo: tudo sobre ele e o "Baixar e ler". */
export function TelaItem({ descobrir: d, id }: { descobrir: Descobrir; id: string }) {
  const { item, erroItem } = useFatia(d.store, (s) => s);
  const fases = useFatia(d.baixador.store, (s) => s);
  useEffect(() => {
    void d.abrirItem(id).catch(() => undefined);
    void d.carregar().catch(() => undefined);
  }, [d, id]);
  const voltar = (
    <button
      className="f-botao"
      data-tipo="fantasma"
      data-tamanho="p"
      onClick={() => history.back()}
      style={{ marginBottom: 16 }}
    >
      <Icone nome="voltar" tamanho={16} /> Voltar
    </button>
  );
  if (erroItem)
    return (
      <>
        {voltar}
        <p className="ficha-erro" role="alert">
          {erroItem}
        </p>
      </>
    );
  if (!item || item.id !== id)
    return (
      <>
        {voltar}
        <p className="carregando">Abrindo…</p>
      </>
    );
  const fase = fases[item.id];
  const autor = autorDoItem(item);
  const tenho = item.obraId ?? (fase?.fase === 'pronto' ? fase.obraId : undefined);
  const fonte = item.ofertas[0];
  return (
    <>
      {voltar}
      <div className="ficha">
        <div
          className="ficha-capa"
          data-colorida={tenho ? '' : undefined}
          style={tenho ? { filter: 'none', opacity: 1 } : undefined}
        >
          <CapaItem item={item} />
        </div>
        <div>
          <span className="f-rotulo">{tenho ? 'Na sua biblioteca' : 'Nos catálogos abertos'}</span>
          <h1>{item.titulo}</h1>
          <p className="obra-autor">
            {autor && (
              <button className="ficha-autor" onClick={() => ir({ tela: 'autor', nome: autor })}>
                {autor}
              </button>
            )}
            {item.ano ? `, ${item.ano}` : ''}
          </p>
          <dl>
            <dt>Idioma</dt>
            <dd>{item.idioma}</dd>
            {item.serie && (
              <>
                <dt>Série</dt>
                <dd>
                  {item.serie.nome}, vol. {item.serie.volume}
                </dd>
              </>
            )}
            <dt>Fonte</dt>
            <dd>{fonte?.fonte ?? item.id.split(':')[0]}</dd>
            <dt>Licença</dt>
            <dd>{licencaDoItem(item)}</dd>
          </dl>
          {item.assuntos.length > 0 && (
            <div className="obra-meta">
              {item.assuntos.map((a) => (
                <span key={a} className="etiqueta">
                  {a}
                </span>
              ))}
            </div>
          )}
          {item.sinopse && <p style={{ margin: '16px 0', maxWidth: '60ch' }}>{item.sinopse}</p>}
          <div className="obra-acoes">
            {tenho ? (
              <button className="f-botao" data-tipo="luz" onClick={() => ir({ tela: 'obra', id: tenho })}>
                <Icone nome="ler" /> Abrir na biblioteca
              </button>
            ) : (
              <button
                className="f-botao"
                data-tipo="luz"
                disabled={fase?.fase === 'baixando'}
                onClick={() => void d.baixador.baixar(item.id).then(lerBaixado)}
              >
                <Icone nome="baixar" /> {fase?.fase === 'baixando' ? 'Baixando…' : 'Baixar e ler'}
              </button>
            )}
          </div>
          {fase?.fase === 'baixando' && <p aria-live="polite">Baixando e preparando o livro…</p>}
          {fase?.fase === 'erro' && (
            <p className="ficha-erro" role="alert">
              {fase.mensagem}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
