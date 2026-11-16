import { useEffect } from 'react';
import { haQuanto } from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import type { Internet } from './internet';

export function InternetECatalogos({ internet }: { internet: Internet }) {
  const { permitida, fontes, atualizando, erro } = useFatia(internet.store, (s) => s);
  useEffect(() => {
    void internet.carregar();
  }, [internet]);
  return (
    <section aria-label="Internet e catálogos">
      <div className="ajuste" style={{ alignItems: 'start' }}>
        <div>
          Internet
          <small>
            Usada só pelo catálogo, por baixar livros e por corrigir dados de uma obra. Nada além de título, autor e
            ISBN sai do computador: nunca os seus arquivos, marcações ou notas. Desligada, o Fierium funciona 100% sem
            rede.
          </small>
        </div>
        <input
          type="checkbox"
          aria-label="Permitir internet"
          checked={permitida}
          onChange={(e) => void internet.definir(e.target.checked)}
        />
      </div>
      <div className="ajuste" style={{ alignItems: 'start' }}>
        <div>
          Catálogos
          <small>Só fontes de domínio público ou licença aberta.</small>
          {fontes.map((f) => (
            <small key={f.id}>
              {f.nome}: {f.itens.toLocaleString('pt-BR')} itens ·{' '}
              {f.atualizadaEm ? `atualizado ${haQuanto(f.atualizadaEm)}` : 'ainda não atualizado'}
              {f.ligada ? '' : ' · desligada'}
            </small>
          ))}
          {erro && (
            <small role="alert" style={{ color: 'var(--perigo)' }}>
              {erro}
            </small>
          )}
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {fontes.map((f) => (
            <button
              key={f.id}
              className="f-botao"
              data-tamanho="p"
              disabled={atualizando.includes(f.id) || !permitida}
              title={permitida ? undefined : 'Ligue a internet pra atualizar'}
              aria-label={`Atualizar ${f.nome} agora`}
              onClick={() => void internet.atualizar(f.id)}
            >
              {atualizando.includes(f.id) ? 'Atualizando…' : 'Atualizar agora'}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
