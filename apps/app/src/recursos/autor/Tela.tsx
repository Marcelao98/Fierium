// A página de um autor: o que a pessoa tem (colorido) e o que existe nos catálogos abertos (cinza), por ano.
import { Icone } from '@fierium/ui';
import { useEffect } from 'react';
import { CartaoCinza, lerBaixado } from '../../compartilhado/Catalogo';
import { EstadoDaTela } from '../../compartilhado/Estados';
import { CartaoObra } from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import type { Autor } from './estado';

export function TelaAutor({ autor: a, nome }: { autor: Autor; nome: string }) {
  const { pecas, carregando } = useFatia(a.store, (s) => s);
  const fases = useFatia(a.baixador.store, (s) => s);
  useEffect(() => {
    void a.abrir(nome).catch(() => undefined);
  }, [a, nome]);
  const minhas = pecas.filter((p) => p.tipo === 'obra').length;
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
      <div className="titulo-tela">
        <div>
          <span className="f-rotulo">Autor</span>
          <h1>{nome}</h1>
          <p>
            {minhas} na sua biblioteca · {pecas.length - minhas} pra baixar
          </p>
        </div>
      </div>
      {!pecas.length && !carregando ? (
        <EstadoDaTela
          titulo="Nada deste autor por aqui"
          acoes={
            <button className="f-botao" data-tipo="luz" onClick={() => ir({ tela: 'descobrir' })}>
              Procurar no Descobrir
            </button>
          }
        >
          Nem na sua biblioteca, nem nos catálogos abertos (o catálogo pode ainda estar baixando).
        </EstadoDaTela>
      ) : (
        <div className="grade">
          {pecas.map((p) =>
            p.tipo === 'obra' ? (
              <CartaoObra key={p.obra.id} obra={p.obra} detalhe={p.obra.ano ? String(p.obra.ano) : undefined} />
            ) : (
              <CartaoCinza
                key={p.item.id}
                item={p.item}
                fase={fases[p.item.id]}
                aoBaixar={() => void a.baixador.baixar(p.item.id).then(lerBaixado)}
              />
            ),
          )}
        </div>
      )}
    </>
  );
}
