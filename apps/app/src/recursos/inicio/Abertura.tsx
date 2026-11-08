// A primeira vez: uma luz, o nome, e a pergunta "onde moram os seus livros?". No M1 só existe a biblioteca de
// exemplo; escolher a pasta de verdade chega no M3.
import { SeloFieri } from '@fierium/ui';
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
  const [noApp, setNoApp] = useState(false);

  useEffect(() => {
    void servicos.chamar('app.info', {}).then(
      (i) => setNoApp(i.adaptador === 'tauri'),
      () => undefined, // sem a informação, fica a abertura do navegador
    );
  }, [servicos]);

  const exemplo = () => {
    void servicos.chamar('obras.listar', {}).then(
      (l) => setTotal(l.length),
      () => undefined,
    );
    setPasso('formando');
  };
  const escolher = () => {
    ir({ tela: 'ajustes' });
    void config.mudar((c) => ({ ...c, primeiraVez: false })).catch(() => undefined);
  };

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
        <div className="abertura-selo">
          <SeloFieri tamanho={132} />
        </div>
        <h1>Fierium</h1>
        {passo === 'luz' ? (
          <>
            <p>Toda biblioteca começa como uma coisa imaginada. Onde moram os seus livros?</p>
            <div className="abertura-acoes">
              {noApp ? (
                <>
                  <button className="f-botao" data-tipo="luz" onClick={escolher}>
                    Escolher a pasta dos meus livros
                  </button>
                  <button className="f-botao" data-tipo="fantasma" onClick={exemplo}>
                    Usar a biblioteca de exemplo
                  </button>
                </>
              ) : (
                <>
                  <button className="f-botao" data-tipo="luz" onClick={exemplo}>
                    Usar a biblioteca de exemplo
                  </button>
                  <button className="f-botao" data-tipo="fantasma" disabled title="Só no app">
                    Escolher a minha pasta (só no app)
                  </button>
                </>
              )}
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
