// Peças do catálogo: o cartão cinza (o que existe nos catálogos abertos e a pessoa ainda não tem). O cartão colorido
// continua sendo o CartaoObra.
import type { ItemCatalogo } from '@fierium/contratos';
import { useFatia } from '../nucleo/contexto';
import { Icone, Selo } from '@fierium/ui';
import { abrirLeitura, ir } from '../nucleo/navegacao';
import { CapaImagem } from './CapaImagem';
import './catalogo.css';
import { autorDoItem, fraseDoCatalogo, licencaDoItem, type FaseBaixa, type Vigia } from './catalogo';

const matizDe = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

export function CapaItem({ item, compacto = false }: { item: ItemCatalogo; compacto?: boolean }) {
  return (
    <CapaImagem
      src={item.capa}
      gerada={
        <Selo
          titulo={item.serie ? item.serie.nome : item.titulo}
          autor={autorDoItem(item)}
          matiz={matizDe(item.id)}
          detalhe={item.serie ? `vol. ${item.serie.volume}` : undefined}
          area={item.assuntos.join(' ')}
          compacto={compacto}
        />
      }
    />
  );
}

/** O aviso enquanto o catálogo não chegou: andamento, ou o motivo da falha com "Tentar de novo". Pronto, some. */
export function AvisoDoCatalogo({ vigia }: { vigia: Vigia }) {
  const estado = useFatia(vigia.store, (s) => s.estado);
  if (!estado || estado.fase === 'pronto') return null;
  const andando = estado.fase === 'baixando' || estado.fase === 'importando';
  return (
    <div className="aviso-catalogo" data-fase={estado.fase} role={estado.fase === 'erro' ? 'alert' : 'status'}>
      <p>{fraseDoCatalogo(estado)}</p>
      {andando && (
        <progress
          aria-label="Andamento do catálogo"
          {...(estado.fase === 'baixando' && estado.total ? { value: estado.bytes ?? 0, max: estado.total } : {})}
        />
      )}
      {andando && <small>Só na primeira vez. Dá pra usar a biblioteca enquanto isso.</small>}
      {(estado.fase === 'erro' || estado.fase === 'vazio') && (
        <button className="f-botao" data-tamanho="p" onClick={() => vigia.tentarDeNovo()}>
          {estado.fase === 'erro' ? 'Tentar de novo' : 'Baixar agora'}
        </button>
      )}
      {estado.fase === 'sem-rede' && (
        <button className="f-botao" data-tamanho="p" onClick={() => ir({ tela: 'ajustes' })}>
          Abrir os Ajustes
        </button>
      )}
    </div>
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
          {/* no cartão só o essencial; a licença inteira fica na ficha */}
          <span className="selo-licenca">{licencaDoItem(item).split(/ [(—]/)[0]}</span>
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
