import type { CorMarcacao, Marcacao, Obra } from '@fierium/contratos';
import type { CSSProperties, ReactNode } from 'react';
import { useConfig } from '../nucleo/contexto';
import { haQuanto } from './Obras';

export function useCores(): CorMarcacao[] {
  return useConfig()?.cores ?? [];
}

export function corDe(cores: CorMarcacao[], id: string): CorMarcacao {
  return cores.find((c) => c.id === id) ?? { id, nome: id, cor: '#a99be6' };
}

export function ondeEsta(m: Marcacao): string {
  if (m.ancora.tipo === 'pdf') return `p. ${m.ancora.pagina}`;
  if (m.ancora.tipo === 'texto') return `cap. ${m.ancora.capitulo + 1}`;
  return '';
}

export function CartaoMarcacao({
  marcacao: m,
  obra,
  cores,
  acoes,
  nota,
}: {
  marcacao: Marcacao;
  obra?: Obra | undefined;
  cores: CorMarcacao[];
  acoes?: ReactNode;
  nota?: ReactNode;
}) {
  const c = corDe(cores, m.cor);
  return (
    <article className="marcacao" style={{ '--cor-marca': c.cor } as CSSProperties}>
      <blockquote>“{m.trecho}”</blockquote>
      {nota ?? (m.nota && <p className="marcacao-nota">{m.nota}</p>)}
      <div className="marcacao-rodape">
        <span>
          <span className="cor-ponto" />
          {c.nome}
        </span>
        {obra && <span>{obra.titulo}</span>}
        {ondeEsta(m) && <span>{ondeEsta(m)}</span>}
        <span>{haQuanto(m.criadaEm)}</span>
        {acoes}
      </div>
    </article>
  );
}
