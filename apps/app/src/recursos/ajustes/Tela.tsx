import type { Tema } from '@fierium/contratos';
import { useConfig, useConfigApp, useServicos } from '../../nucleo/contexto';
import { inspetor } from '../../nucleo/navegacao';
import { PastasDeLivros } from './PastasDeLivros';
import type { Pastas } from './estado';
import './ajustes.css';

export function TelaAjustes({ pastas }: { pastas: Pastas }) {
  const c = useConfig();
  const { mudar: mudarConfig } = useConfigApp();
  const servicos = useServicos();
  if (!c) return null;
  return (
    <div className="ajustes">
      <div className="titulo-tela">
        <div>
          <h1>Ajustes</h1>
          <p>Fierium 0.1 · as suas pastas, o tema e o resto</p>
        </div>
      </div>
      <PastasDeLivros pastas={pastas} />
      <div className="ajuste">
        <div>
          Tema
          <small>Escuro, claro ou o mesmo do sistema</small>
        </div>
        <div className="alternar" role="group" aria-label="Tema">
          {(
            [
              ['noite', 'Escuro'],
              ['lucido', 'Claro'],
              ['sistema', 'Sistema'],
            ] as [Tema, string][]
          ).map(([v, n]) => (
            <button key={v} aria-pressed={c.tema === v} onClick={() => void mudarConfig((x) => ({ ...x, tema: v }))}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="ajuste">
        <div>
          Menos movimento
          <small>Sem estrelas se mexendo nem transições longas</small>
        </div>
        <input
          type="checkbox"
          aria-label="Menos movimento"
          checked={c.movimento === 'reduzido'}
          onChange={(e) => void mudarConfig((x) => ({ ...x, movimento: e.target.checked ? 'reduzido' : 'normal' }))}
        />
      </div>
      <div className="ajuste" style={{ alignItems: 'start' }}>
        <div>
          Cores das marcações
          <small>Cada cor tem o significado que você der</small>
        </div>
        <div className="cores-marcacao">
          {c.cores.map((cor, i) => (
            <div key={cor.id} className="cor-marcacao">
              <input
                type="color"
                value={cor.cor}
                aria-label={`Cor de ${cor.nome}`}
                onChange={(e) =>
                  void mudarConfig((x) => ({
                    ...x,
                    cores: x.cores.map((k, j) => (j === i ? { ...k, cor: e.target.value } : k)),
                  }))
                }
              />
              <input
                className="f-campo"
                value={cor.nome}
                aria-label="Significado"
                onChange={(e) =>
                  void mudarConfig((x) => ({
                    ...x,
                    cores: x.cores.map((k, j) => (j === i ? { ...k, nome: e.target.value } : k)),
                  }))
                }
              />
            </div>
          ))}
          {c.cores.length < 8 && (
            <button
              className="f-botao"
              data-tamanho="p"
              onClick={() =>
                void mudarConfig((x) => ({
                  ...x,
                  cores: [...x.cores, { id: `cor-${Date.now()}`, nome: 'Nova cor', cor: '#8fb4e8' }],
                }))
              }
            >
              Adicionar cor
            </button>
          )}
        </div>
      </div>
      <div className="ajuste">
        <div>
          Recomeçar o exemplo
          <small>Apaga o que você mudou na biblioteca de exemplo e mostra a abertura de novo</small>
        </div>
        <button
          className="f-botao"
          onClick={() => {
            if (!confirm('Recomeçar a biblioteca de exemplo do zero?')) return;
            servicos.avisar('Recomeçando…');
            location.href = location.pathname + '?novo=1';
          }}
        >
          Recomeçar
        </button>
      </div>
      <div className="ajuste">
        <div>
          Depuração
          <small>O que o app está fazendo agora: comandos, tempos e erros (Ctrl+Shift+D)</small>
        </div>
        <button className="f-botao" onClick={() => inspetor(true)}>
          Abrir o inspetor
        </button>
      </div>
    </div>
  );
}
