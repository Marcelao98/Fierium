// O leitor: um modo por cima de tudo. Abre como um portal a partir de onde a pessoa clicou; a interface some enquanto
// se lê (o véu) e volta ao mexer o mouse ou tocar. A casca (barra, véu, temas, painel, balão) é a mesma pra todos os
// formatos; o conteúdo é desenhado pelo motor certo (@fierium/leitores), montado num elemento e conversando por
// eventos. Trocar de formato = trocar de motor; a casca não muda.
import type { ConfigLeitura, Marcacao, TemaLeitura } from '@fierium/contratos';
import { escolherMotor, MOTORES, type Caixa, type SessaoLeitura, type Selecao } from '@fierium/leitores';
import { Icone } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { corDe, useCores } from '../../compartilhado/Marcacoes';
import { useConfig, useConfigApp, useFatia, useServicos } from '../../nucleo/contexto';
import { fecharLeitura, type Leitura } from '../../nucleo/navegacao';
import { Balao } from './Balao';
import type { Leitor as EstadoLeitor } from './estado';
import './leitor.css';

const TEMAS: [TemaLeitura, string, string, string][] = [
  ['pergaminho', 'Pergaminho', '#f1e6c9', '#2b2216'],
  ['papel', 'Papel', '#f7f3ea', '#1f1b16'],
  ['sepia', 'Sépia', '#efe1c6', '#3b2b1a'],
  ['noite', 'Noite', '#12101f', '#ddd6c8'],
  ['tinta', 'Tinta', '#e9e9e4', '#111'],
];
const FONTES: [ConfigLeitura['fonte'], string, string][] = [
  ['cormorant', 'Cormorant', 'var(--fonte-titulo)'],
  ['literata', 'Literata', 'var(--fonte-leitura)'],
  ['inter', 'Inter', 'var(--fonte-ui)'],
];

type EstadoBalao = { caixa: Caixa; nova: Selecao | null; marcacaoId: string | null };

export function Leitor({ leitor, leitura }: { leitor: EstadoLeitor; leitura: Leitura }) {
  const { obra, fonte, marcacoes, selecionada, fracao } = useFatia(leitor.store, (s) => s);
  const cfg = useConfig()?.leitura;
  const config = useConfigApp();
  const servicos = useServicos();
  const cores = useCores();
  const [veu, setVeu] = useState(false);
  const [painel, setPainel] = useState<'aparencia' | 'marcacoes' | null>(null);
  const [balao, setBalao] = useState<EstadoBalao | null>(null);
  const palco = useRef<HTMLDivElement>(null);
  const sessao = useRef<SessaoLeitura | null>(null);
  const tempoVeu = useRef(0);

  // abrir a obra (e fechar ao sair: registra o tempo lido, grava a posição)
  useEffect(() => {
    void leitor.abrir(leitura.obraId, leitura.edicaoId).catch(() => fecharLeitura());
    const t = setInterval(() => leitor.tique(), 1000);
    return () => {
      clearInterval(t);
      void leitor.fechar().catch(() => undefined);
    };
  }, [leitor, leitura.obraId, leitura.edicaoId]);

  // montar o motor quando a fonte chega
  useEffect(() => {
    const el = palco.current;
    if (!el || !fonte || !cfg) return;
    let vivo = true;
    let motorNome = '';
    try {
      const motor = escolherMotor(MOTORES, fonte);
      motorNome = motor.nome;
      const salvo = obra?.edicoes.find((e) => e.id === leitura.edicaoId)?.progresso?.posicao;
      void motor
        .montar(el, {
          fonte,
          alvo: leitura.marcacaoId ? { marcacaoId: leitura.marcacaoId } : salvo ? { posicao: salvo } : undefined,
          aparencia: cfg,
          marcacoes: leitor.store.getState().marcacoes,
          cores,
          eventos: {
            posicao: (p, f) => leitor.posicaoMudou(p, f),
            selecao: (s) => {
              leitor.selecionar(null);
              setBalao(s ? { caixa: s.caixa, nova: s, marcacaoId: null } : null);
            },
            marcacaoClicada: (id, caixa) => {
              leitor.selecionar(id);
              setBalao({ caixa, nova: null, marcacaoId: id });
            },
            toque: () => {
              setBalao(null);
              leitor.selecionar(null);
              setVeu((v) => !v);
            },
            erro: (codigo, mensagem) => {
              servicos.log.registrar('erro', 'leitor', `${codigo}: ${mensagem}`);
              servicos.avisar(`${mensagem} (${codigo})`, 'erro');
            },
          },
        })
        .then(
          (s) => {
            if (vivo) sessao.current = s;
            else s.desmontar();
            if (leitura.marcacaoId) leitor.selecionar(leitura.marcacaoId);
          },
          (e: unknown) =>
            servicos.log.registrar('erro', 'leitor', `motor ${motorNome} não montou`, { erro: String(e) }),
        );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      servicos.avisar(m, 'erro');
      servicos.log.registrar('erro', 'leitor', m);
    }
    return () => {
      vivo = false;
      sessao.current?.desmontar();
      sessao.current = null;
    };
    // remonta só quando a fonte muda (aparência e marcações vão pela sessão, abaixo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonte]);

  useEffect(() => {
    if (cfg) sessao.current?.aplicarAparencia(cfg);
  }, [cfg]);
  useEffect(() => {
    sessao.current?.mostrarMarcacoes(marcacoes, cores, selecionada);
  }, [marcacoes, cores, selecionada]);

  // o véu: a interface some 2,5 s depois do último movimento (nunca com painel ou balão aberto)
  const acordar = () => {
    leitor.mexeu();
    setVeu(false);
    clearTimeout(tempoVeu.current);
    tempoVeu.current = window.setTimeout(() => setVeu(true), 2500);
  };
  useEffect(() => {
    acordar();
    const tecla = (e: KeyboardEvent) => {
      leitor.mexeu();
      if (e.key !== 'Escape') return;
      if (balao) setBalao(null);
      else if (painel) setPainel(null);
      else fecharLeitura();
    };
    addEventListener('keydown', tecla);
    return () => {
      removeEventListener('keydown', tecla);
      clearTimeout(tempoVeu.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- acordar só usa refs e o leitor
  }, [painel, balao, leitor]);

  if (!cfg) return null;
  const mudar = (m: Partial<ConfigLeitura>) => void config.mudar((c) => ({ ...c, leitura: { ...c.leitura, ...m } }));
  const edicao = obra?.edicoes.find((e) => e.id === leitura.edicaoId);
  const marcada: Marcacao | null = balao?.marcacaoId
    ? (marcacoes.find((m) => m.id === balao.marcacaoId) ?? null)
    : null;

  return (
    <div
      className="leitor"
      role="dialog"
      aria-label={obra ? `Lendo ${obra.titulo}` : 'Abrindo'}
      data-tema={cfg.tema}
      data-veu={veu && !painel && !balao}
      style={
        {
          '--origem-x': `${leitura.origem.x}px`,
          '--origem-y': `${leitura.origem.y}px`,
          // 'fraunces' (config antiga) cai na Cormorant, que tomou o lugar dela nos títulos
          '--l-fonte': FONTES.find((f) => f[0] === cfg.fonte)?.[2] ?? 'var(--fonte-titulo)',
        } as CSSProperties
      }
      onPointerMove={acordar}
    >
      <header className="leitor-barra">
        <button className="f-botao" data-tamanho="p" onClick={() => fecharLeitura()} aria-label="Voltar">
          <Icone nome="voltar" tamanho={16} /> Voltar
        </button>
        <span className="leitor-titulo">
          {obra ? `${obra.titulo} · ${Math.round(fracao * 100)}%` : 'Abrindo…'}
          {edicao ? ` · ${edicao.formato.toUpperCase()}` : ''}
        </span>
        <button
          className="f-botao"
          data-tamanho="p"
          aria-pressed={painel === 'marcacoes'}
          aria-label="Marcações deste livro"
          onClick={() => setPainel(painel === 'marcacoes' ? null : 'marcacoes')}
        >
          <Icone nome="marcador" tamanho={16} /> {marcacoes.length}
        </button>
        <button
          className="f-botao"
          data-tamanho="p"
          aria-label="Aparência"
          aria-pressed={painel === 'aparencia'}
          onClick={() => setPainel(painel === 'aparencia' ? null : 'aparencia')}
        >
          <Icone nome="letra" tamanho={16} /> Aa
        </button>
      </header>

      {painel === 'aparencia' && (
        <aside className="leitor-painel" aria-label="Aparência da leitura">
          <h3>Tema</h3>
          <div className="temas-leitura">
            {TEMAS.map(([v, n, f, t]) => (
              <button
                key={v}
                aria-pressed={cfg.tema === v}
                style={{ background: f, color: t }}
                onClick={() => mudar({ tema: v })}
              >
                {n}
              </button>
            ))}
          </div>
          <h3>Fonte</h3>
          <div className="chips">
            {FONTES.map(([v, n, f]) => (
              <button
                key={v}
                className="f-chip"
                style={{ fontFamily: f }}
                aria-pressed={cfg.fonte === v}
                onClick={() => mudar({ fonte: v })}
              >
                {n}
              </button>
            ))}
          </div>
          <h3>Texto</h3>
          <label className="leitor-controle">
            Tamanho
            <input
              type="range"
              min={14}
              max={32}
              value={cfg.tamanho}
              onChange={(e) => mudar({ tamanho: Number(e.target.value) })}
            />
            <span>{cfg.tamanho}</span>
          </label>
          <label className="leitor-controle">
            Entrelinha
            <input
              type="range"
              min={1.2}
              max={2.2}
              step={0.1}
              value={cfg.entrelinha}
              onChange={(e) => mudar({ entrelinha: Number(e.target.value) })}
            />
            <span>{cfg.entrelinha.toFixed(1)}</span>
          </label>
          <label className="leitor-controle">
            Largura
            <input
              type="range"
              min={40}
              max={100}
              step={2}
              value={cfg.largura}
              onChange={(e) => mudar({ largura: Number(e.target.value) })}
            />
            <span>{cfg.largura}</span>
          </label>
        </aside>
      )}

      {painel === 'marcacoes' && (
        <aside className="leitor-painel" aria-label="Marcações deste livro">
          <h3>Marcações deste livro</h3>
          {!marcacoes.length && <p>Selecione um trecho do texto para marcar.</p>}
          {marcacoes.map((m) => (
            <button
              key={m.id}
              className="painel-marcacao"
              style={{ '--cor-marca': corDe(cores, m.cor).cor } as CSSProperties}
              onClick={() => {
                sessao.current?.irPara({ marcacaoId: m.id });
                leitor.selecionar(m.id);
                setPainel(null);
              }}
            >
              {m.trecho.length > 120 ? m.trecho.slice(0, 118) + '…' : m.trecho}
              {m.nota && <small className="painel-marcacao-nota">✎ {m.nota}</small>}
            </button>
          ))}
        </aside>
      )}

      <div className="leitor-palco" ref={palco} />

      {balao && (balao.nova || marcada) && (
        <Balao
          caixa={balao.caixa}
          cores={cores}
          marcacao={balao.nova ? null : marcada}
          aoEscolherCor={(cor) => {
            if (balao.nova) {
              const n = balao.nova;
              sessao.current?.limparSelecao();
              void leitor.marcar(n.ancora, n.trecho, cor).then(
                (m) => m && setBalao({ caixa: balao.caixa, nova: null, marcacaoId: m.id }),
                () => undefined,
              );
            } else if (marcada) void leitor.mudarMarcacao(marcada.id, { cor }).catch(() => undefined);
          }}
          aoSalvarNota={(nota) => {
            if (marcada) void leitor.mudarMarcacao(marcada.id, { nota }).catch(() => undefined);
            setBalao(null);
            leitor.selecionar(null);
          }}
          aoApagar={() => {
            if (marcada) void leitor.apagarMarcacao(marcada.id).catch(() => undefined);
            setBalao(null);
          }}
          aoFechar={() => setBalao(null)}
        />
      )}
      <div className="leitor-progresso" aria-hidden="true">
        <span style={{ width: `${fracao * 100}%` }} />
      </div>
    </div>
  );
}
