// A barra de cima do leitor: voltar, título e progresso, marcador de página, notas, modo, mergulho e aparência.
import type { Edicao, Obra } from '@fierium/contratos';
import type { EstadoModo, IdModo } from '@fierium/leitor-base';
import { Icone } from '@fierium/ui';
import { modoPorId } from '@fierium/leitor-base';
import { fecharLeitura } from '../../nucleo/navegacao';

export type PainelAberto = 'aparencia' | 'notas' | 'modo' | null;

interface Props {
  obra: Obra | null;
  edicao: Edicao | undefined;
  fracao: number;
  quantasMarcacoes: number;
  painel: PainelAberto;
  alternarPainel(p: Exclude<PainelAberto, null>): void;
  marcarPagina(): void;
  mergulhar(): void;
  modo: IdModo;
  estadoModo: EstadoModo;
  alternarModo(): void;
}

export function BarraLeitor(p: Props) {
  const { obra, edicao, fracao, painel } = p;
  return (
    <header className="leitor-barra">
      <button className="f-botao" data-tamanho="p" onClick={() => fecharLeitura()} aria-label="Voltar">
        <Icone nome="voltar" tamanho={16} /> Voltar
      </button>
      <span className="leitor-titulo">
        {obra ? `${obra.titulo} · ${Math.round(fracao * 100)}%` : 'Abrindo…'}
        {edicao ? ` · ${edicao.formato.toUpperCase()}` : ''}
      </span>
      {p.modo !== 'rolagem' && (
        <button
          className="f-botao"
          data-tamanho="p"
          aria-label={p.estadoModo === 'rodando' ? 'Pausar a leitura' : 'Retomar a leitura'}
          onClick={p.alternarModo}
        >
          {p.estadoModo === 'rodando' ? 'Pausar' : p.estadoModo === 'fim' ? 'Recomeçar' : 'Retomar'}
        </button>
      )}
      <button
        className="f-botao"
        data-tamanho="p"
        aria-label="Modo de leitura"
        aria-pressed={painel === 'modo'}
        title="Modo de leitura: Rolagem, Automático ou Guiado"
        onClick={() => p.alternarPainel('modo')}
      >
        <Icone nome="ler" tamanho={16} /> Modo: {modoPorId(p.modo).rotulo}
      </button>
      <button className="f-botao" data-tamanho="p" aria-label="Marcador de página" onClick={p.marcarPagina}>
        <Icone nome="marcador" tamanho={16} /> Marcar página
      </button>
      <button
        className="f-botao"
        data-tamanho="p"
        aria-pressed={painel === 'notas'}
        aria-label="Marcações deste livro"
        title="Notas deste livro (Ctrl+Shift+N)"
        onClick={() => p.alternarPainel('notas')}
      >
        <Icone nome="marcador" tamanho={16} /> {p.quantasMarcacoes}
      </button>
      <button
        className="f-botao"
        data-tamanho="p"
        aria-label="Modo mergulho"
        title="Modo mergulho: tela cheia, só o livro (F11)"
        onClick={p.mergulhar}
      >
        <Icone nome="lua" tamanho={16} /> Mergulho
      </button>
      <button
        className="f-botao"
        data-tamanho="p"
        aria-label="Aparência"
        aria-pressed={painel === 'aparencia'}
        onClick={() => p.alternarPainel('aparencia')}
      >
        <Icone nome="letra" tamanho={16} /> Aa
      </button>
    </header>
  );
}
