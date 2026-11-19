// A primeira vez, em três passos curtos: (a) boas-vindas, (b) "Onde estão seus livros?", (c) o andamento real (a
// varredura das pastas e o catálogo chegando) com três clássicos pra abrir já. No fim cai no Início. No navegador
// (sem seletor de pasta) o passo (b) oferece a biblioteca de exemplo.
import { SeloFieri } from '@fierium/ui';
import { useEffect, useState } from 'react';
import { AvisoDoCatalogo, CapaItem, lerBaixado } from '../../compartilhado/Catalogo';
import { autorDoItem } from '../../compartilhado/catalogo';
import { useConfigApp, useFatia, useServicos } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import type { Abertura as EstadoAbertura } from './abertura';
import './inicio.css';

const PASSOS = ['boas-vindas', 'pasta', 'andamento'] as const;

function Passos({ atual }: { atual: string }) {
  const n = Math.max(0, PASSOS.indexOf(atual as (typeof PASSOS)[number]));
  return (
    <ol className="abertura-passos" aria-label={`Passo ${n + 1} de ${PASSOS.length}`}>
      {PASSOS.map((p, i) => (
        <li key={p} aria-current={i === n ? 'step' : undefined} data-feito={i < n || undefined} />
      ))}
    </ol>
  );
}

export function Abertura({ abertura }: { abertura: EstadoAbertura }) {
  const config = useConfigApp();
  const servicos = useServicos();
  const passo = useFatia(abertura.store, (s) => s.passo);
  const [total, setTotal] = useState(0);
  const [contagem, setContagem] = useState(0);
  const noApp = servicos.escolherPastas !== null;

  useEffect(() => {
    void abertura.carregarSugestoes(); // as de um clique (~/Livros, ~/Documentos…)
    return () => abertura.parar();
  }, [abertura]);

  /** sai da abertura: grava que já foi vista e vai pro destino (o Início, por padrão) */
  const concluir = async () => {
    await config.mudar((c) => ({ ...c, primeiraVez: false })).catch(() => undefined); // o aviso já saiu
    ir({ tela: 'inicio' });
  };

  const exemplo = () => {
    void servicos.chamar('obras.listar', {}).then(
      (l) => {
        setTotal(l.length);
        // biblioteca vazia: não há o que contar, entra direto
        if (!l.length) void concluir();
      },
      () => undefined, // o aviso já saiu; fica nesta tela pra tentar de novo
    );
    abertura.irPara('formando');
  };

  // a contagem animada do exemplo
  useEffect(() => {
    if (passo !== 'formando' || !total) return;
    let n = 0;
    const t = setInterval(() => {
      n = Math.min(total, n + Math.max(1, Math.ceil(total / 24)));
      setContagem(n);
      if (n >= total) {
        clearInterval(t);
        setTimeout(() => void concluir(), 700);
      }
    }, 60);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `concluir` só usa o config e o roteador
  }, [passo, total]);

  return (
    <div className="abertura" data-passo={passo}>
      <div className="abertura-miolo">
        {passo === 'boas-vindas' && <BoasVindas aoComecar={() => abertura.irPara('pasta')} />}
        {passo === 'pasta' && (
          <OndeEstao
            abertura={abertura}
            noApp={noApp}
            aoUsarExemplo={exemplo}
            aoPular={() => (noApp ? abertura.comecarAndamento() : void concluir())}
          />
        )}
        {passo === 'andamento' && <Andamento abertura={abertura} noApp={noApp} aoConcluir={concluir} />}
        {passo === 'formando' && (
          <>
            <div className="abertura-selo">
              <SeloFieri tamanho={96} />
            </div>
            <p className="abertura-formando" aria-live="polite">
              Reunindo a sua biblioteca… {contagem} obras
            </p>
          </>
        )}
        {passo !== 'formando' && <Passos atual={passo} />}
      </div>
    </div>
  );
}

function BoasVindas({ aoComecar }: { aoComecar: () => void }) {
  return (
    <>
      <div className="abertura-selo">
        <SeloFieri tamanho={132} />
      </div>
      <h1>Fierium</h1>
      <p>Toda biblioteca começa como uma coisa imaginada. Vamos montar a sua em dois minutos.</p>
      <div className="abertura-acoes">
        <button className="f-botao" data-tipo="luz" onClick={aoComecar}>
          Começar
        </button>
      </div>
    </>
  );
}

function OndeEstao({
  abertura,
  noApp,
  aoUsarExemplo,
  aoPular,
}: {
  abertura: EstadoAbertura;
  noApp: boolean;
  aoUsarExemplo: () => void;
  aoPular: () => void;
}) {
  const sugestoes = useFatia(abertura.store, (s) => s.sugestoes);
  return (
    <>
      <div className="abertura-selo">
        <SeloFieri tamanho={72} />
      </div>
      <h2 className="abertura-titulo">Onde estão seus livros?</h2>
      <p>
        {noApp
          ? 'Escolha a pasta onde ficam os seus PDF e EPUB. O Fierium só lê: não mexe em nenhum arquivo.'
          : 'No navegador não dá pra escolher uma pasta do computador (isso é só no app). Dá pra explorar com a biblioteca de exemplo.'}
      </p>
      <div className="abertura-acoes">
        {noApp ? (
          <>
            <button className="f-botao" data-tipo="luz" onClick={() => void abertura.escolherPasta()}>
              Escolher pasta…
            </button>
            {sugestoes.length > 0 && (
              <div className="abertura-sugestoes" role="group" aria-label="Pastas sugeridas">
                <small>Ou, com um clique:</small>
                {sugestoes.slice(0, 4).map((c) => (
                  <button key={c} className="f-botao" data-tamanho="p" onClick={() => void abertura.usarPastas([c])}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <button className="f-botao" data-tipo="fantasma" onClick={aoPular}>
              Pular, só quero explorar
            </button>
          </>
        ) : (
          <>
            <button className="f-botao" data-tipo="luz" onClick={aoUsarExemplo}>
              Usar a biblioteca de exemplo
            </button>
            <button className="f-botao" data-tipo="fantasma" disabled title="Só no app">
              Escolher a minha pasta (só no app)
            </button>
            <button className="f-botao" data-tipo="fantasma" onClick={aoPular}>
              Pular, só quero explorar
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Andamento({
  abertura,
  noApp,
  aoConcluir,
}: {
  abertura: EstadoAbertura;
  noApp: boolean;
  aoConcluir: () => Promise<void>;
}) {
  const config = useConfigApp();
  const { classicos, buscou, usouPasta, varrendo, livros, erroPasta: erro } = useFatia(abertura.store, (s) => s);
  const fases = useFatia(abertura.baixador.store, (s) => s);

  const lerClassico = async (id: string) => {
    const r = await abertura.baixador.baixar(id);
    if (!r) return; // o cartão mostra o motivo e dá pra tentar de novo
    await config.mudar((c) => ({ ...c, primeiraVez: false })).catch(() => undefined);
    lerBaixado(r);
  };

  return (
    <>
      <h2 className="abertura-titulo">Montando a sua biblioteca</h2>

      <section className="abertura-bloco" aria-label="Seus livros" aria-live="polite">
        {!usouPasta ? (
          <>
            <p>
              Você ainda não escolheu uma pasta, então a biblioteca começa vazia. Sem pressa: dá pra escolher depois em
              Ajustes → Pastas de livros.
            </p>
            {noApp && (
              <button className="f-botao" data-tamanho="p" onClick={() => void abertura.escolherPasta()}>
                Escolher pasta…
              </button>
            )}
          </>
        ) : varrendo || (livros === null && !erro) ? (
          <>
            <p>Procurando PDF e EPUB nas suas pastas…</p>
            <progress aria-label="Procurando livros" />
          </>
        ) : erro ? (
          <p role="alert">Não consegui ler a pasta: {erro}</p>
        ) : livros !== null && livros > 0 ? (
          <p>
            <strong>{livros}</strong> {livros === 1 ? 'livro encontrado' : 'livros encontrados'}. Eles já estão na sua
            biblioteca.
          </p>
        ) : (
          <>
            <p>
              Não achei nenhum PDF ou EPUB nessa pasta (procuro também nas pastas de dentro). Escolha outra pasta, ou
              comece pelo catálogo logo abaixo.
            </p>
            {noApp && (
              <button className="f-botao" data-tamanho="p" onClick={() => void abertura.escolherPasta()}>
                Escolher outra pasta…
              </button>
            )}
          </>
        )}
      </section>

      <AvisoDoCatalogo vigia={abertura.vigia} />

      <section className="abertura-bloco" aria-label="Comece por…">
        <h3>Comece por…</h3>
        {classicos.length > 0 ? (
          <ul className="abertura-classicos">
            {classicos.map((i) => {
              const fase = fases[i.id];
              return (
                <li key={i.id}>
                  <span className="abertura-capa" aria-hidden="true">
                    <CapaItem item={i} compacto />
                  </span>
                  <strong>{i.titulo}</strong>
                  <small>{autorDoItem(i)}</small>
                  <button
                    className="f-botao"
                    data-tamanho="p"
                    data-tipo="luz"
                    disabled={fase?.fase === 'baixando'}
                    aria-label={`Baixar e ler ${i.titulo}`}
                    onClick={() => void lerClassico(i.id)}
                  >
                    {fase?.fase === 'baixando' ? 'Baixando…' : 'Baixar e ler'}
                  </button>
                  {fase?.fase === 'erro' && <span role="alert">{fase.mensagem}</span>}
                </li>
              );
            })}
          </ul>
        ) : buscou ? (
          <p>
            Ainda não achei os clássicos no catálogo. Quando ele chegar, eles aparecem aqui; ou explore em “Descobrir”
            depois.
          </p>
        ) : (
          <p>Procurando três clássicos pra você abrir já…</p>
        )}
      </section>

      <div className="abertura-acoes">
        <button className="f-botao" data-tipo="luz" onClick={() => void aoConcluir()}>
          Entrar na biblioteca
        </button>
      </div>
    </>
  );
}
