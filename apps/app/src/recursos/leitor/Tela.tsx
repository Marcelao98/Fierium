// O leitor: um modo por cima de tudo. Abre como um portal a partir de onde a pessoa clicou; a interface some enquanto
// se lê (o véu) e volta ao mexer o mouse ou tocar. A casca (barra, véu, temas, painel, balão) é a mesma pra todos os
// formatos; o conteúdo é desenhado pelo motor certo (@fierium/leitores), montado num elemento e conversando por
// eventos. Trocar de formato = trocar de motor; a casca não muda.
import type { Ancora, ConfigLeitura, Marcacao, PaginaLeitura, TemaLeitura } from '@fierium/contratos';
import {
  escolherMotor,
  MOTORES,
  type Caixa,
  type PedidoMenu,
  type SessaoLeitura,
  type Selecao,
} from '@fierium/leitores';
import { Anel, Icone } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { citacao, formatoLembrado } from '../../compartilhado/citacao';
import { useCores } from '../../compartilhado/Marcacoes';
import { useConfig, useConfigApp, useFatia, useServicos } from '../../nucleo/contexto';
import { abrirCartao, fecharLeitura, type Leitura } from '../../nucleo/navegacao';
import { Balao } from './Balao';
import { MenuContexto } from './MenuContexto';
import { PainelNotas } from './PainelNotas';
import { itensDoMenu, type CasoMenu } from './menuItens';
import { PainelPagina } from './PainelPagina';
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

type EstadoBalao = { caixa: Caixa; nova: Selecao | null; marcacaoId: string | null; focar?: boolean };

export function Leitor({ leitor, leitura }: { leitor: EstadoLeitor; leitura: Leitura }) {
  const { obra, fonte, marcacoes, selecionada, fracao } = useFatia(leitor.store, (s) => s);
  const cfg = useConfig()?.leitura;
  const config = useConfigApp();
  const servicos = useServicos();
  const cores = useCores();
  const [veu, setVeu] = useState(false);
  const [painel, setPainel] = useState<'aparencia' | 'notas' | null>(null);
  const [balao, setBalao] = useState<EstadoBalao | null>(null);
  const [menu, setMenu] = useState<PedidoMenu | null>(null);
  // modo mergulho: tela cheia, sem barra nem painéis; a barra volta com Esc ou com o mouse no topo
  const [mergulho, setMergulho] = useState(false);
  const [barraNoTopo, setBarraNoTopo] = useState(false);
  const mergulhoAtual = useRef(false);
  const selecaoAtual = useRef<Selecao | null>(null);
  const [previa, setPrevia] = useState<PaginaLeitura | null>(null);
  const palco = useRef<HTMLDivElement>(null);
  const sessao = useRef<SessaoLeitura | null>(null);
  const tempoVeu = useRef(0);
  const posicaoAtual = useRef('');

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
            posicao: (p, f) => {
              posicaoAtual.current = p;
              leitor.posicaoMudou(p, f);
            },
            selecao: (s) => {
              selecaoAtual.current = s;
              leitor.selecionar(null);
              setMenu(null);
              setBalao(s ? { caixa: s.caixa, nova: s, marcacaoId: null } : null);
            },
            marcacaoClicada: (id, caixa) => {
              leitor.selecionar(id);
              setMenu(null);
              setBalao({ caixa, nova: null, marcacaoId: id });
            },
            menu: (p) => {
              selecaoAtual.current = p.selecao;
              if (p.marcacaoId) leitor.selecionar(p.marcacaoId);
              setBalao(null);
              setMenu(p);
            },
            toque: () => {
              setBalao(null);
              setMenu(null);
              leitor.selecionar(null);
              setVeu((v) => !v);
            },
            erro: (codigo, mensagem, detalhe) => {
              servicos.log.registrar('erro', 'leitor', `${codigo}: ${mensagem}`, detalhe ? { detalhe } : undefined);
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
    if (cfg) sessao.current?.aplicarAparencia(previa ? { ...cfg, pagina: previa } : cfg);
  }, [cfg, previa]);
  useEffect(() => {
    sessao.current?.mostrarMarcacoes(marcacoes, cores, selecionada);
  }, [marcacoes, cores, selecionada]);

  useEffect(() => {
    if (mergulhoAtual.current === mergulho) return;
    mergulhoAtual.current = mergulho;
    setBarraNoTopo(false);
    if (mergulho) setPainel(null);
    void servicos.telaCheia(mergulho).then((ok) => {
      if (!ok && mergulho) servicos.log.registrar('aviso', 'leitor', 'tela cheia indisponível: mergulho só sem barra');
    });
  }, [mergulho, servicos]);
  useEffect(() => {
    // Esc no navegador sai da tela cheia por conta própria: o mergulho acompanha
    const mudou = () => {
      if (!document.fullscreenElement && mergulhoAtual.current) setMergulho(false);
    };
    document.addEventListener('fullscreenchange', mudou);
    return () => {
      document.removeEventListener('fullscreenchange', mudou);
      if (mergulhoAtual.current) void servicos.telaCheia(false);
    };
  }, [servicos]);

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
      if (e.key === 'F11') {
        e.preventDefault();
        setMergulho((m) => !m);
        return;
      }
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault();
        const s = selecaoAtual.current;
        const r = palco.current?.getBoundingClientRect();
        abrirMenu({
          x: s ? s.caixa.x + s.caixa.largura / 2 : (r?.left ?? 0) + (r?.width ?? innerWidth) / 2,
          y: s ? s.caixa.y + s.caixa.altura : (r?.top ?? 0) + (r?.height ?? innerHeight) / 3,
          selecao: s,
          marcacaoId: s ? null : leitor.store.getState().selecionada,
        });
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setPainel((p) => (p === 'notas' ? null : 'notas'));
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c' && selecaoAtual.current) {
        e.preventDefault();
        copiarCitacao(selecaoAtual.current);
        return;
      }
      if (e.key !== 'Escape') return;
      if (menu) setMenu(null);
      else if (balao) setBalao(null);
      else if (painel) setPainel(null);
      else if (mergulhoAtual.current) setMergulho(false);
      else fecharLeitura();
    };
    addEventListener('keydown', tecla);
    return () => {
      removeEventListener('keydown', tecla);
      clearTimeout(tempoVeu.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- acordar só usa refs e o leitor
  }, [painel, balao, menu, leitor]);

  const formato: 'pdf' | 'epub' | 'texto' =
    fonte?.tipo === 'arquivo' ? (fonte.formato === 'pdf' ? 'pdf' : 'epub') : 'texto';

  function abrirMenu(p: PedidoMenu) {
    setBalao(null);
    setMenu(p);
  }
  const copiar = async (texto: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      servicos.avisar(msg);
    } catch {
      servicos.avisar('Não consegui copiar: o sistema não deixou acessar a área de transferência.', 'erro');
    }
  };
  function copiarCitacao(t: { trecho: string; ancora: Ancora }) {
    void copiar(citacao(t, obra ?? undefined, formatoLembrado()), 'Citação copiada.');
  }
  const corPadrao = cores.find((c) => c.id !== 'citacao')?.id ?? cores[0]?.id ?? '';
  const corCitacao = cores.find((c) => c.id === 'citacao')?.id ?? corPadrao;
  /** marca o trecho selecionado; devolve a marcação (o chamador decide o que abrir depois) */
  const marcarSelecao = (s: Selecao, cor: string) => {
    sessao.current?.limparSelecao();
    selecaoAtual.current = null;
    return leitor.marcar(s.ancora, s.trecho, cor).catch(() => null);
  };

  /** Marcador de página: lembra o lugar (sem trecho). Clicar de novo no mesmo lugar tira. */
  const marcarPagina = (pagina?: number) => {
    const fmt = fonte?.tipo === 'arquivo' ? fonte.formato : 'texto';
    const ancora: Ancora | null =
      fmt === 'pdf' && pagina ? { tipo: 'pdf', pagina, retangulos: [] } : ancoraDaPosicao(fmt, posicaoAtual.current);
    if (!ancora) return;
    const igual = marcacoes.find((m) => m.tipo === 'marcador' && JSON.stringify(m.ancora) === JSON.stringify(ancora));
    if (igual) {
      void leitor.apagarMarcacao(igual.id).catch(() => undefined);
      return;
    }
    const rotulo = ancora.tipo === 'pdf' ? `Página ${ancora.pagina}` : `Marcador (${Math.round(fracao * 100)}%)`;
    void leitor.marcar(ancora, rotulo, cores[0]?.id ?? '', 'marcador').catch(() => undefined);
  };

  if (!cfg) return null;
  const mudar = (m: Partial<ConfigLeitura>) => void config.mudar((c) => ({ ...c, leitura: { ...c.leitura, ...m } }));
  const edicao = obra?.edicoes.find((e) => e.id === leitura.edicaoId);
  const marcada: Marcacao | null = balao?.marcacaoId
    ? (marcacoes.find((m) => m.id === balao.marcacaoId) ?? null)
    : null;

  const marcadaNoMenu = menu?.marcacaoId ? (marcacoes.find((m) => m.id === menu.marcacaoId) ?? null) : null;
  const casoDoMenu: CasoMenu = menu?.selecao ? 'selecao' : marcadaNoMenu ? 'marcacao' : 'pagina';
  const paginaDoMenu = menu?.pagina ?? (formato === 'pdf' ? Number(posicaoAtual.current.split(':')[0]) : 0);
  const paginaMarcada = marcacoes.some(
    (m) =>
      m.tipo === 'marcador' &&
      (formato === 'pdf'
        ? m.ancora.tipo === 'pdf' && m.ancora.pagina === paginaDoMenu
        : JSON.stringify(m.ancora) === JSON.stringify(ancoraDaPosicao(formato, posicaoAtual.current))),
  );

  return (
    <div
      className="leitor"
      role="dialog"
      aria-label={obra ? `Lendo ${obra.titulo}` : 'Abrindo'}
      data-tema={cfg.tema}
      data-veu={veu && !painel && !balao && !menu}
      data-mergulho={mergulho}
      data-barra={barraNoTopo}
      style={
        {
          '--origem-x': `${leitura.origem.x}px`,
          '--origem-y': `${leitura.origem.y}px`,
          // 'fraunces' (config antiga) cai na Cormorant, que tomou o lugar dela nos títulos
          '--l-fonte': FONTES.find((f) => f[0] === cfg.fonte)?.[2] ?? 'var(--fonte-titulo)',
        } as CSSProperties
      }
      onPointerMove={(e) => {
        acordar();
        if (mergulhoAtual.current) setBarraNoTopo(e.clientY < (barraNoTopo ? 120 : 56));
      }}
      // o menu do navegador nunca aparece aqui; PDF e EPUB pedem o nosso pelo motor, o texto corrido pela casca
      onContextMenu={(e) => {
        e.preventDefault();
        if (formato === 'texto' && palco.current?.contains(e.target as Node))
          abrirMenu({ x: e.clientX, y: e.clientY, selecao: selecaoAtual.current, marcacaoId: null });
      }}
    >
      <header className="leitor-barra">
        <button className="f-botao" data-tamanho="p" onClick={() => fecharLeitura()} aria-label="Voltar">
          <Icone nome="voltar" tamanho={16} /> Voltar
        </button>
        <span className="leitor-titulo">
          {obra ? `${obra.titulo} · ${Math.round(fracao * 100)}%` : 'Abrindo…'}
          {edicao ? ` · ${edicao.formato.toUpperCase()}` : ''}
        </span>
        <button className="f-botao" data-tamanho="p" aria-label="Marcador de página" onClick={() => marcarPagina()}>
          <Icone nome="marcador" tamanho={16} /> Marcar página
        </button>
        <button
          className="f-botao"
          data-tamanho="p"
          aria-pressed={painel === 'notas'}
          aria-label="Marcações deste livro"
          title="Notas deste livro (Ctrl+Shift+N)"
          onClick={() => setPainel(painel === 'notas' ? null : 'notas')}
        >
          <Icone nome="marcador" tamanho={16} /> {marcacoes.length}
        </button>
        <button
          className="f-botao"
          data-tamanho="p"
          aria-label="Modo mergulho"
          title="Modo mergulho: tela cheia, só o livro (F11)"
          onClick={() => setMergulho(true)}
        >
          <Icone nome="lua" tamanho={16} /> Mergulho
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
          <PainelPagina cfg={cfg} mudar={mudar} previa={setPrevia} />
          <h3>Cor da interface</h3>
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

      {painel === 'notas' && (
        <PainelNotas
          marcacoes={marcacoes}
          cores={cores}
          aoIr={(m) => {
            sessao.current?.irPara({ marcacaoId: m.id });
            leitor.selecionar(m.id);
          }}
          aoCopiarCitacao={copiarCitacao}
          aoApagar={(m) => void leitor.apagarMarcacao(m.id).catch(() => undefined)}
        />
      )}

      <div className="leitor-palco" ref={palco} />

      {menu && (
        <MenuContexto
          x={menu.x}
          y={menu.y}
          aoFechar={() => setMenu(null)}
          itens={itensDoMenu({
            caso: casoDoMenu,
            cores,
            corAtual: marcadaNoMenu?.cor,
            formato,
            paginaMarcada,
            acoes: {
              marcarCor: (cor) => {
                setMenu(null);
                if (menu.selecao) void marcarSelecao(menu.selecao, cor);
              },
              anotar: () => {
                const s = menu.selecao;
                setMenu(null);
                if (!s) return;
                void marcarSelecao(s, corPadrao).then(
                  (m) => m && setBalao({ caixa: s.caixa, nova: null, marcacaoId: m.id, focar: true }),
                );
              },
              salvarCitacao: () => {
                const s = menu.selecao;
                setMenu(null);
                if (!s) return;
                void marcarSelecao(s, corCitacao).then((m) => m && servicos.avisar('Citação salva em Notas.'));
              },
              copiar: () => {
                setMenu(null);
                const t = menu.selecao?.trecho ?? marcadaNoMenu?.trecho;
                if (t) void copiar(t, 'Copiado.');
              },
              copiarCitacao: () => {
                setMenu(null);
                const t = menu.selecao ?? marcadaNoMenu;
                if (t) copiarCitacao(t);
              },
              compartilhar: () => {
                setMenu(null);
                const t = menu.selecao ?? marcadaNoMenu;
                if (t)
                  abrirCartao({ trecho: t.trecho, autor: obra?.criadores[0]?.nome ?? '', livro: obra?.titulo ?? '' });
              },
              editarNota: () => {
                setMenu(null);
                if (!marcadaNoMenu) return;
                leitor.selecionar(marcadaNoMenu.id);
                setBalao({
                  caixa: { x: menu.x, y: menu.y, largura: 0, altura: 0 },
                  nova: null,
                  marcacaoId: marcadaNoMenu.id,
                  focar: true,
                });
              },
              trocarCor: (cor) => {
                setMenu(null);
                if (marcadaNoMenu) void leitor.mudarMarcacao(marcadaNoMenu.id, { cor }).catch(() => undefined);
              },
              apagar: () => {
                setMenu(null);
                if (marcadaNoMenu) void leitor.apagarMarcacao(marcadaNoMenu.id).catch(() => undefined);
              },
              marcarPagina: () => {
                setMenu(null);
                marcarPagina(menu.pagina);
              },
              abrirNotas: () => {
                setMenu(null);
                setPainel('notas');
              },
              abrirTema: () => {
                setMenu(null);
                setPainel('aparencia');
              },
              copiarPagina: () => {
                setMenu(null);
                const n = menu.pagina ?? Number(posicaoAtual.current.split(':')[0]);
                if (n) void copiar(String(n), `Página ${n} copiada.`);
              },
            },
          })}
        />
      )}

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
          focarNota={balao.focar}
        />
      )}
      <div className="leitor-progresso" aria-hidden="true">
        <span style={{ width: `${fracao * 100}%` }} />
      </div>
      {mergulho && (
        <div className="leitor-anel">
          <Anel fracao={fracao} tamanho={34} />
        </div>
      )}
    </div>
  );
}

/** A posição de leitura do motor → a âncora de um marcador de página (sem trecho). */
export function ancoraDaPosicao(formato: string, posicao: string): Ancora | null {
  if (!posicao) return null;
  if (formato === 'pdf') {
    const pagina = Number(posicao.split(':')[0]);
    return Number.isInteger(pagina) && pagina >= 1 ? { tipo: 'pdf', pagina, retangulos: [] } : null;
  }
  if (formato === 'epub') return { tipo: 'epub', cfiInicio: posicao, cfiFim: posicao };
  const [capitulo, paragrafo] = posicao.split(':').map(Number);
  return Number.isInteger(capitulo) && Number.isInteger(paragrafo)
    ? { tipo: 'texto', capitulo: capitulo!, paragrafo: paragrafo!, inicio: 0, fim: 0 }
    : null;
}
