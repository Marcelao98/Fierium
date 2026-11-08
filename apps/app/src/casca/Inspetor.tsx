// Inspetor de depuração (Ctrl+Shift+D): o que o app está fazendo, ao vivo. Cada comando pro núcleo (com tempo e
// erro), cada evento entre funcionalidades, cada erro de tela. "Copiar relatório" junta tudo num texto pra mandar.
import type { Nivel, Registro } from '@fierium/diagnostico';
import { relatorio } from '@fierium/diagnostico';
import { Icone } from '@fierium/ui';
import { useEffect, useState } from 'react';
import { useServicos } from '../nucleo/contexto';
import { inspetor, useNavegacao } from '../nucleo/navegacao';

const NIVEIS: Nivel[] = ['debug', 'info', 'aviso', 'erro'];

export function Inspetor() {
  const aberto = useNavegacao((s) => s.inspetorAberto);
  const { log, avisar } = useServicos();
  const [registros, setRegistros] = useState<readonly Registro[]>([]);
  const [minimo, setMinimo] = useState<Nivel>('debug');
  const [origem, setOrigem] = useState('');

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        inspetor(!useNavegacao.getState().inspetorAberto);
      }
    };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, []);
  useEffect(() => {
    if (!aberto) return;
    setRegistros([...log.recentes()]);
    return log.assinar(() => setRegistros([...log.recentes()]));
  }, [aberto, log]);

  if (!aberto) return null;
  const origens = [...new Set(registros.map((r) => r.origem))].sort();
  const visiveis = registros
    .filter((r) => NIVEIS.indexOf(r.nivel) >= NIVEIS.indexOf(minimo) && (!origem || r.origem === origem))
    .slice(-300)
    .reverse();
  const erros = registros.filter((r) => r.nivel === 'erro').length;
  return (
    <aside className="inspetor" aria-label="Inspetor de depuração">
      <header>
        <strong>Inspetor</strong>
        <span className="inspetor-resumo">
          {registros.length} registros · {erros} {erros === 1 ? 'erro' : 'erros'}
        </span>
        <select
          className="f-campo"
          value={minimo}
          onChange={(e) => setMinimo(e.target.value as Nivel)}
          aria-label="Nível mínimo"
        >
          {NIVEIS.map((n) => (
            <option key={n} value={n}>
              {n}+
            </option>
          ))}
        </select>
        <select className="f-campo" value={origem} onChange={(e) => setOrigem(e.target.value)} aria-label="Origem">
          <option value="">todas as origens</option>
          {origens.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <button
          className="f-botao"
          data-tamanho="p"
          onClick={() =>
            void navigator.clipboard
              .writeText(relatorio(log, { versao: '0.1.0', endereco: location.href, navegador: navigator.userAgent }))
              .then(
                () => avisar('Relatório copiado'),
                () => avisar('Não consegui copiar (permissão da área de transferência)', 'erro'),
              )
          }
        >
          Copiar relatório
        </button>
        <button
          className="f-botao f-icone-botao"
          data-tamanho="p"
          onClick={() => log.limpar()}
          aria-label="Limpar"
          title="Limpar"
        >
          <Icone nome="lixo" tamanho={16} />
        </button>
        <button
          className="f-botao f-icone-botao"
          data-tamanho="p"
          onClick={() => inspetor(false)}
          aria-label="Fechar inspetor"
        >
          <Icone nome="fechar" tamanho={16} />
        </button>
      </header>
      <ol>
        {visiveis.map((r) => (
          <li key={r.n} data-nivel={r.nivel}>
            <time>{new Date(r.quando).toLocaleTimeString('pt-BR')}</time>
            <span className="inspetor-origem">{r.origem}</span>
            <span className="inspetor-msg">
              {r.mensagem}
              {typeof r.dados?.ms === 'number' && <em> · {r.dados.ms} ms</em>}
            </span>
            {r.dados && (
              <details>
                <summary>dados</summary>
                <pre>{JSON.stringify(r.dados, null, 2)}</pre>
              </details>
            )}
          </li>
        ))}
        {!visiveis.length && <li className="inspetor-vazio">Nada registrado com esses filtros.</li>}
      </ol>
    </aside>
  );
}
