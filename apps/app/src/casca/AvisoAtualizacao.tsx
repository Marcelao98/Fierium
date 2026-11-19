import { instalarAtualizacao, useAtualizacao } from '../nucleo/atualizacao';
import { useServicos } from '../nucleo/contexto';

/** Faixa discreta no canto: só aparece quando há versão nova (e só no app). */
export function AvisoAtualizacao() {
  const servicos = useServicos();
  const { versao, fase } = useAtualizacao();
  if (!versao) return null;
  return (
    <div className="aviso-atualizacao" role="status">
      <span>Versão {versao} disponível</span>
      <button
        type="button"
        disabled={fase === 'instalando'}
        onClick={() => void instalarAtualizacao(servicos.log, servicos.avisar)}
      >
        {fase === 'instalando' ? 'Atualizando…' : 'Atualizar e reiniciar'}
      </button>
    </div>
  );
}
