// Peças do catálogo: o cartão cinza (o que existe nos catálogos abertos e a pessoa ainda não tem). O cartão colorido
// continua sendo o CartaoObra.
import type { ItemCatalogo } from '@fierium/contratos';
import { Icone, Selo } from '@fierium/ui';
import { abrirLeitura, ir } from '../nucleo/navegacao';
import './catalogo.css';
import { autorDoItem, licencaDoItem, type FaseBaixa } from './catalogo';

const matizDe = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

export function CapaItem({ item, compacto = false }: { item: ItemCatalogo; compacto?: boolean }) {
  if (item.capa) return <img className="capa-imagem" src={item.capa} alt="" loading="lazy" decoding="async" />;
  return (
    <Selo
      titulo={item.serie ? item.serie.nome : item.titulo}
      autor={autorDoItem(item)}
      matiz={matizDe(item.id)}
      detalhe={item.serie ? `vol. ${item.serie.volume}` : undefined}
      compacto={compacto}
    />
  );
}

/** Abre o leitor na obra recém-baixada. */
export function lerBaixado(r: { obraId: string; edicaoId: string } | null) {
  if (r) abrirLeitura({ ...r, origem: { x: innerWidth / 2, y: innerHeight / 2 } });
}

export function CartaoCinza({
  item,
  fase,
  aoBaixar,
}: {
  item: ItemCatalogo;
  fase?: FaseBaixa | undefined;
  aoBaixar: () => void;
}) {
  const autor = autorDoItem(item);
  const baixando = fase?.fase === 'baixando';
  return (
    <div className="cartao-cinza" data-fase={fase?.fase}>
      <button
        className="cartao-cinza-corpo"
        aria-label={`${item.titulo}, ${autor}: ver a ficha`}
        onClick={() => ir({ tela: 'item', id: item.id })}
      >
        <span className="cartao-cinza-capa" aria-hidden="true">
          <CapaItem item={item} />
          <span className="selo-licenca">{licencaDoItem(item)}</span>
        </span>
        <span className="cartao-obra-titulo">{item.titulo}</span>
      </button>
      {autor && (
        <button className="cartao-cinza-autor" onClick={() => ir({ tela: 'autor', nome: autor })}>
          {autor}
        </button>
      )}
      <button
        className="f-botao"
        data-tamanho="p"
        disabled={baixando}
        aria-label={`Baixar ${item.titulo}`}
        onClick={aoBaixar}
      >
        <Icone nome="baixar" tamanho={14} /> {baixando ? 'Baixando…' : 'Baixar'}
      </button>
      {fase?.fase === 'erro' && (
        <span className="cartao-cinza-erro" role="alert">
          {fase.mensagem}
        </span>
      )}
    </div>
  );
}
