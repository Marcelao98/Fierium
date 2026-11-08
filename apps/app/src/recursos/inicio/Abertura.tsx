// A primeira vez: uma luz, o nome, e a pergunta "onde moram os seus livros?". No M1 só existe a biblioteca de
// exemplo; escolher a pasta de verdade chega no M3.
import { useEffect, useState } from 'react';
import { useConfigApp, useServicos } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import './inicio.css';

export function Abertura() {
  const config = useConfigApp();
  const servicos = useServicos();
  const [passo, setPasso] = useState<'luz' | 'formando'>('luz');
  const [total, setTotal] = useState(0);
  const [contagem, setContagem] = useState(0);

  useEffect(() => {
    if (passo !== 'formando' || !total) return;
    let n = 0;
    const t = setInterval(() => {
      n = Math.min(total, n + Math.max(1, Math.ceil(total / 24)));
      setContagem(n);
      if (n >= total) {
        clearInterval(t);
        setTimeout(() => {
          ir({ tela: 'inicio' });
          void config.mudar((c) => ({ ...c, primeiraVez: false })).catch(() => undefined);
        }, 700);
      }
    }, 60);
    return () => clearInterval(t);
  }, [passo, total, config]);

  return (
    <div className="abertura">
      <div>
        <div className="abertura-luz" />
        <h1>Fierium</h1>
        {passo === 'luz' ? (
          <>
            <p>Toda biblioteca começa como uma coisa imaginada. Onde moram os seus livros?</p>
            <div className="abertura-acoes">
              <button
                className="f-botao"
                data-tipo="luz"
                onClick={() => {
                  void servicos.chamar('obras.listar', {}).then(
                    (l) => setTotal(l.length),
                    () => undefined,
                  );
                  setPasso('formando');
                }}
              >
                Usar a biblioteca de exemplo
              </button>
              <button className="f-botao" data-tipo="fantasma" disabled title="Chega no marco 3">
                Escolher a minha pasta (em breve)
              </button>
            </div>
          </>
        ) : (
          <p className="abertura-formando" aria-live="polite">
            Reunindo a sua biblioteca… {contagem} obras
          </p>
        )}
      </div>
    </div>
  );
}
