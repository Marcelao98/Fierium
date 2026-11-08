// Início = o Limiar do Sonho (D24): o selo, a frase de Fieri e, no astrolábio, a obra que você está lendo, a um
// clique de continuar. Embaixo, e em volta, poucas coisas, todas com motivo: o que está em andamento, uma
// marcação antiga que volta, obras que nunca foram abertas e o que chegou por último.
import { Anel, Icone, SeloFieri } from '@fierium/ui';
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
      <section className="limiar" aria-label="Continuar lendo">
        <div className="limiar-fala">
          <SeloFieri tamanho={104} />
          <span className="f-rotulo">{saudacao()} · o Limiar do Sonho</span>
          <p className="limiar-frase">
            Tudo que já foi <em>imaginado</em> está no mapa de Fieri.
          </p>
          <p className="limiar-sub">
            {l.totalObras} obras no seu pedaço do céu. Cada obra é uma estrela; cada série, uma constelação.
          </p>
        </div>
        {u ? (
          <div className="limiar-obra" style={{ '--obra-matiz': u.matiz } as CSSProperties}>
            <Astrolabio />
            <div className="limiar-capa">
              <Capa obra={u} />
            </div>
            <span className="f-rotulo">Continuar lendo</span>
            <h1>{u.titulo}</h1>
            <p className="limiar-autor">{autorDe(u)}</p>
            <div className="limiar-progresso">
              <Anel fracao={fracaoDe(u)} tamanho={44} />
              <span>
                {tempoRestante(u) ? `${tempoRestante(u)} restantes no seu ritmo` : 'Quase no fim'}
                {u.relacao.ultimaLeitura ? ` · lido ${haQuanto(u.relacao.ultimaLeitura)}` : ''}
              </span>
            </div>
            <div className="limiar-acoes">
              <button className="f-botao" data-tipo="luz" onClick={(e) => lerObra(u, e)}>
                <Icone nome="ler" /> Continuar
              </button>
              <button className="f-botao" data-tipo="fantasma" onClick={() => ir({ tela: 'obra', id: u.id })}>
                Sobre a obra
              </button>
            </div>
          </div>
        ) : (
          <div className="limiar-obra vazio">
            <h2>Nada sendo lido agora</h2>
            <p>Escolha uma estrela na biblioteca para começar.</p>
            <button className="f-botao" data-tipo="luz" onClick={() => ir({ tela: 'biblioteca', lente: 'grade' })}>
              Abrir a biblioteca
            </button>
          </div>
        )}
      </section>

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

/** O anel do astrolábio em volta da obra em leitura: marcas de grau, a eclíptica inclinada e o ponteiro. */
const MARCAS = Array.from({ length: 120 }, (_, i) => {
  const a = (i * 3 * Math.PI) / 180;
  const d = i % 10 ? 232 : 216;
  return [280 + Math.cos(a) * 240, 250 + Math.sin(a) * 240, 280 + Math.cos(a) * d, 250 + Math.sin(a) * d] as const;
});
function Astrolabio() {
  return (
    <svg className="limiar-astrolabio" viewBox="0 0 560 500" fill="none" stroke="var(--luz)" aria-hidden="true">
      <circle cx="280" cy="250" r="240" strokeOpacity="0.28" />
      <circle cx="280" cy="250" r="226" strokeOpacity="0.16" />
      <g className="limiar-astrolabio-marcas" strokeOpacity="0.38">
        {MARCAS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <ellipse
        cx="280"
        cy="250"
        rx="262"
        ry="92"
        strokeOpacity="0.22"
        strokeDasharray="3 5"
        transform="rotate(-20 280 250)"
      />
    </svg>
  );
}
