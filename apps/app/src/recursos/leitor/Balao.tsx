// O balão de marcação: aparece sobre um trecho selecionado (escolher a cor = marcar) ou sobre uma marcação existente
// (mudar a cor, escrever a nota, apagar). É o mesmo pra todos os formatos: o motor só avisa onde está o trecho.
import type { CorMarcacao, Marcacao } from '@fierium/contratos';
import type { Caixa } from '@fierium/leitores';
import { Icone } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

export interface PropsBalao {
  caixa: Caixa;
  cores: CorMarcacao[];
  /** marcação existente (editar) ou null (seleção nova: escolher a cor marca) */
  marcacao: Marcacao | null;
  aoEscolherCor(cor: string): void;
  aoSalvarNota(nota: string): void;
  aoApagar(): void;
  aoFechar(): void;
  /** tamanho da janela (os testes passam) */
  largura?: number;
  altura?: number;
}

export function Balao({
  caixa,
  cores,
  marcacao,
  aoEscolherCor,
  aoSalvarNota,
  aoApagar,
  aoFechar,
  largura,
  altura,
}: PropsBalao) {
  const [nota, setNota] = useState(marcacao?.nota ?? '');
  useEffect(() => setNota(marcacao?.nota ?? ''), [marcacao?.id, marcacao?.nota]);
  const w = largura ?? innerWidth;
  const x = Math.min(w - 130, Math.max(130, caixa.x + caixa.largura / 2));
  return (
    <div
      className="balao"
      // sempre dentro da janela, mesmo se o trecho estiver quase saindo da tela
      style={{ left: x, top: Math.min((altura ?? innerHeight) - 20, Math.max(140, caixa.y)) }}
      role="dialog"
      aria-label={marcacao ? 'Marcação' : 'Marcar trecho'}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === 'Escape' && aoFechar()}
    >
      <div className="balao-cores">
        {cores.map((c) => (
          <button
            key={c.id}
            style={{ '--cor-marca': c.cor } as CSSProperties}
            aria-pressed={marcacao?.cor === c.id}
            onClick={() => aoEscolherCor(c.id)}
          >
            <i />
            {c.nome}
          </button>
        ))}
      </div>
      {marcacao && (
        <>
          <textarea
            placeholder="Escrever uma nota…"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            aria-label="Nota da marcação"
          />
          <div className="balao-acoes">
            <button onClick={aoApagar}>
              <Icone nome="lixo" tamanho={14} /> Apagar
            </button>
            <button onClick={() => aoSalvarNota(nota)}>
              <Icone nome="check" tamanho={14} /> Pronto
            </button>
          </div>
        </>
      )}
    </div>
  );
}
