// Vitrine (só em desenvolvimento, #/vitrine): cada peça sozinha, com dados de exemplo, nos dois temas. Serve pra
// olhar e depurar um componente isolado, sem navegar pelo app até ele.
import { bibliotecaDeExemplo, CORES_PADRAO, resumoEstatisticas } from '@fierium/cliente';
import { Anel, Icone, Selo } from '@fierium/ui';
import { useMemo, useState } from 'react';
import { CartaoMarcacao } from '../compartilhado/Marcacoes';
import { CartaoObra } from '../compartilhado/Obras';
import { Mapa } from '../recursos/biblioteca/Mapa';
import { Calendario, Ultimos30 } from '../recursos/estatisticas/Graficos';
import { Balao } from '../recursos/leitor/Balao';

function Peca({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <section className="painel f-cartao" style={{ marginTop: 16 }}>
      <h2>{nome}</h2>
      {children}
    </section>
  );
}

export default function Vitrine() {
  const ex = useMemo(() => bibliotecaDeExemplo(Date.now()), []);
  const r = useMemo(() => resumoEstatisticas(ex.sessoes, ex.obras, ex.metas, Date.now()), [ex]);
  const [log, setLog] = useState('');
  const m = ex.marcacoes[0]!;
  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Vitrine</h1>
          <p>Cada componente sozinho. Troque o tema nos Ajustes ou com Ctrl+K.</p>
        </div>
      </div>
      <Peca nome="Selos (capas geradas)">
        <div className="grade">
          {ex.obras.slice(0, 8).map((o) => (
            <Selo key={o.id} titulo={o.titulo} autor={o.criadores[0]?.nome} matiz={o.matiz} />
          ))}
        </div>
      </Peca>
      <Peca nome="Botões, chips, anel, ícones">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="f-botao" data-tipo="luz">
            <Icone nome="ler" /> Luz
          </button>
          <button className="f-botao">Normal</button>
          <button className="f-botao" data-tipo="fantasma">
            Fantasma
          </button>
          <button className="f-botao" disabled>
            Desligado
          </button>
          <button className="f-chip" aria-pressed="true">
            Chip ligado
          </button>
          <button className="f-chip">Chip</button>
          <Anel fracao={0.62} />
          <Anel fracao={1} />
        </div>
      </Peca>
      <Peca nome="Cartões de obra">
        <div className="grade">
          {ex.obras.slice(0, 5).map((o) => (
            <CartaoObra key={o.id} obra={o} />
          ))}
        </div>
      </Peca>
      <Peca nome="Cartão de marcação">
        <CartaoMarcacao marcacao={m} cores={CORES_PADRAO} obra={ex.obras.find((o) => o.id === m.obraId)} />
      </Peca>
      <Peca nome="Balão de marcação (seleção nova e marcação existente)">
        <div style={{ position: 'relative', height: 200 }}>
          <Balao
            caixa={{ x: 260, y: 900, largura: 0, altura: 0 }}
            cores={CORES_PADRAO}
            marcacao={m}
            largura={600}
            aoEscolherCor={(c) => setLog(`cor: ${c}`)}
            aoSalvarNota={(n) => setLog(`nota: ${n}`)}
            aoApagar={() => setLog('apagar')}
            aoFechar={() => setLog('fechar')}
          />
        </div>
        <small>último evento: {log || '—'}</small>
      </Peca>
      <Peca nome="Gráficos">
        <Calendario dias={r.dias} />
        <div style={{ marginTop: 16 }}>
          <Ultimos30 dias={r.dias} />
        </div>
      </Peca>
      <Peca nome="Mapa">
        <Mapa obras={ex.obras} />
      </Peca>
    </>
  );
}
