// Início: continuar lendo em um clique, e em volta, poucas coisas, todas com motivo: o que está em andamento, uma
// marcação antiga que volta, obras que nunca foram abertas e o que chegou por último.
import { Anel, Icone } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import {
  autorDe,
  Capa,
  CartaoObra,
  fracaoDe,
  haQuanto,
  lerObra,
  Prateleira,
  tempoRestante,
} from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import type { Inicio } from './estado';
import './inicio.css';

function saudacao(h = new Date().getHours()) {
  return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function TelaInicio({ inicio }: { inicio: Inicio }) {
  const l = useFatia(inicio.store, (s) => s.limiar);
  useEffect(() => {
    void inicio.carregar().catch(() => undefined); // o aviso e o log já mostraram o erro
  }, [inicio]);
  if (!l) return <p className="carregando">Abrindo a biblioteca…</p>;
  const u = l.ultimo;
  return (
    <>
      <p className="inicio-saudacao">
        {saudacao()} · {l.totalObras} obras na sua biblioteca
      </p>
      {u ? (
        <section
          className="continuar"
          style={{ '--obra-matiz': u.matiz } as CSSProperties}
          aria-label="Continuar lendo"
        >
          <div className="continuar-capa">
            <Capa obra={u} />
          </div>
          <div>
            <span className="f-rotulo">Continuar lendo</span>
            <h1>{u.titulo}</h1>
            <p className="continuar-autor">{autorDe(u)}</p>
            <div className="continuar-progresso">
              <Anel fracao={fracaoDe(u)} tamanho={48} />
              <span>
                {tempoRestante(u) ? `${tempoRestante(u)} restantes no seu ritmo` : 'Quase no fim'}
                {u.relacao.ultimaLeitura ? ` · lido ${haQuanto(u.relacao.ultimaLeitura)}` : ''}
              </span>
            </div>
            <div className="continuar-acoes">
              <button className="f-botao" data-tipo="luz" onClick={(e) => lerObra(u, e)}>
                <Icone nome="ler" /> Continuar
              </button>
              <button className="f-botao" onClick={() => ir({ tela: 'obra', id: u.id })}>
                Sobre a obra
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="vazio">
          <h2>Nada sendo lido agora</h2>
          <p>Escolha uma obra na biblioteca para começar.</p>
          <button className="f-botao" data-tipo="luz" onClick={() => ir({ tela: 'biblioteca', lente: 'grade' })}>
            Abrir a biblioteca
          </button>
        </section>
      )}

      {l.eco && (
        <section className="eco" aria-label="Uma marcação antiga">
          <span className="f-rotulo">Você marcou {haQuanto(l.eco.marcacao.criadaEm)}</span>
          <blockquote>“{l.eco.marcacao.trecho}”</blockquote>
          <button onClick={(e) => lerObra(l.eco!.obra, e, l.eco!.marcacao.id)}>
            {l.eco.obra.titulo} — {autorDe(l.eco.obra)}
          </button>
        </section>
      )}

      {l.emAndamento.length > 0 && (
        <Prateleira titulo="Em andamento">
          {l.emAndamento.map((o) => (
            <CartaoObra key={o.id} obra={o} detalhe={`${Math.round(fracaoDe(o) * 100)}% · ${autorDe(o)}`} />
          ))}
        </Prateleira>
      )}

      <div className="inicio-colunas">
        {l.esquecidas.length > 0 && (
          <section className="prateleira">
            <header>
              <h2>Nunca abertos</h2>
            </header>
            <div className="esquecidas">
              {l.esquecidas.map((o) => (
                <button key={o.id} className="esquecida" onClick={() => ir({ tela: 'obra', id: o.id })}>
                  <Capa obra={o} compacto />
                  <div>
                    <strong>{o.titulo}</strong>
                    <span>
                      {autorDe(o)} · na biblioteca {haQuanto(o.relacao.adicionadaEm)}
                      {o.edicoes[0]?.paginas ? ` · ${o.edicoes[0].paginas} páginas` : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        <Prateleira
          titulo="Chegaram por último"
          acao={
            <button
              className="f-botao"
              data-tipo="fantasma"
              data-tamanho="p"
              onClick={() => ir({ tela: 'biblioteca', lente: 'grade' })}
            >
              Ver tudo
            </button>
          }
        >
          {l.novidades.slice(0, 6).map((o) => (
            <CartaoObra key={o.id} obra={o} />
          ))}
        </Prateleira>
      </div>
    </>
  );
}
