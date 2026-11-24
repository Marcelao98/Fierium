// O leitor: um modo por cima de tudo. Abre como um portal a partir de onde a pessoa clicou; a interface some enquanto
// se lê (o véu) e volta ao mexer o mouse ou tocar. A casca (barra, véu, temas, painel, balão) é a mesma pra todos os
// formatos; o conteúdo é desenhado pelo motor certo (um pacote @fierium/leitor-*, carregado sob demanda), montado num
// elemento e conversando por eventos. Trocar de formato = trocar de motor; a casca não muda.
import type { Ancora, ConfigLeitura, Marcacao, PaginaLeitura } from '@fierium/contratos';
import type { PedidoMenu, Selecao } from '@fierium/leitor-base';
import { Anel } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { citacao, formatoLembrado } from '../../compartilhado/citacao';
import { useCores } from '../../compartilhado/Marcacoes';
import { useConfig, useConfigApp, useFatia, useServicos } from '../../nucleo/contexto';
import { fecharLeitura, type Leitura } from '../../nucleo/navegacao';
import { ancoraDaPosicao, type EstadoBalao } from './ancora';
import { Balao } from './Balao';
import { BarraLeitor, type PainelAberto } from './BarraLeitor';
import type { Leitor as EstadoLeitor } from './estado';
import { MenuDoLeitor } from './MenuDoLeitor';
import { FONTES, PainelAparencia } from './PainelAparencia';
import { PainelModo } from './PainelModo';
import { PainelNotas } from './PainelNotas';
import { useModo } from './useModo';
import { usePalco } from './usePalco';
import { useVeuEMergulho } from './useVeuEMergulho';
import './leitor.css';

export function Leitor({ leitor, leitura }: { leitor: EstadoLeitor; leitura: Leitura }) {
  const { obra, fonte, marcacoes, selecionada, fracao } = useFatia(leitor.store, (s) => s);
  const cfg = useConfig()?.leitura;
  const config = useConfigApp();
  const servicos = useServicos();
  const cores = useCores();
  const [painel, setPainel] = useState<PainelAberto>(null);
  const [balao, setBalao] = useState<EstadoBalao | null>(null);
  const [menu, setMenu] = useState<PedidoMenu | null>(null);
  const [previa, setPrevia] = useState<PaginaLeitura | null>(null);
  const selecaoAtual = useRef<Selecao | null>(null);
  const alternarPainel = (p: Exclude<PainelAberto, null>) => setPainel((atual) => (atual === p ? null : p));

  // abrir a obra (e fechar ao sair: registra o tempo lido, grava a posição)
  useEffect(() => {
    void leitor.abrir(leitura.obraId, leitura.edicaoId).catch(() => fecharLeitura());
    const t = setInterval(() => leitor.tique(), 1000);
    return () => {
      clearInterval(t);
      void leitor.fechar().catch(() => undefined);
    };
  }, [leitor, leitura.obraId, leitura.edicaoId]);

  const { palco, sessao, posicaoAtual, viva } = usePalco({
    leitor,
    servicos,
    fonte,
    obra,
    edicaoId: leitura.edicaoId,
    marcacaoId: leitura.marcacaoId,
    cfg,
    cores,
    ganchos: {
      aoSelecionar: (s) => {
        selecaoAtual.current = s;
        leitor.selecionar(null);
        setMenu(null);
        setBalao(s ? { caixa: s.caixa, nova: s, marcacaoId: null } : null);
      },
      aoClicarMarcacao: (id, caixa) => {
        leitor.selecionar(id);
        setMenu(null);
        setBalao({ caixa, nova: null, marcacaoId: id });
      },
      aoPedirMenu: (p) => {
        selecaoAtual.current = p.selecao;
        if (p.marcacaoId) leitor.selecionar(p.marcacaoId);
        setBalao(null);
        setMenu(p);
      },
      aoTocar: () => {
        setBalao(null);
        setMenu(null);
        leitor.selecionar(null);
        veu.alternar();
      },
    },
  });
  const modo = useModo(viva);

  useEffect(() => {
    if (cfg) sessao.current?.aplicarAparencia(previa ? { ...cfg, pagina: previa } : cfg);
  }, [cfg, previa, sessao]);
  useEffect(() => {
    sessao.current?.mostrarMarcacoes(marcacoes, cores, selecionada);
  }, [marcacoes, cores, selecionada, sessao]);

  const formato: 'pdf' | 'epub' | 'texto' =
    fonte?.tipo === 'arquivo' ? (fonte.formato === 'pdf' ? 'pdf' : 'epub') : 'texto';
  const copiar = async (texto: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      servicos.avisar(msg);
    } catch {
      servicos.avisar('Não consegui copiar: o sistema não deixou acessar a área de transferência.', 'erro');
    }
  };
  const copiarCitacao = (t: { trecho: string; ancora: Ancora }) =>
    void copiar(citacao(t, obra ?? undefined, formatoLembrado()), 'Citação copiada.');
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

  const veu = useVeuEMergulho({
    leitor,
    servicos,
    aberto: { painel, balao: !!balao, menu: !!menu },
    aoEsc: () => {
      if (menu) setMenu(null);
      else if (balao) setBalao(null);
      else if (painel) setPainel(null);
      else return false;
      return true;
    },
    aoMenuPeloTeclado: () => {
      const s = selecaoAtual.current;
      const r = palco.current?.getBoundingClientRect();
      setBalao(null);
      setMenu({
        x: s ? s.caixa.x + s.caixa.largura / 2 : (r?.left ?? 0) + (r?.width ?? innerWidth) / 2,
        y: s ? s.caixa.y + s.caixa.altura : (r?.top ?? 0) + (r?.height ?? innerHeight) / 3,
        selecao: s,
        marcacaoId: s ? null : leitor.store.getState().selecionada,
      });
    },
    aoAlternarNotas: () => alternarPainel('notas'),
    aoCopiarCitacao: () => {
      const s = selecaoAtual.current;
      if (s) copiarCitacao(s);
      return !!s;
    },
    aoMergulhar: () => setPainel(null),
  });

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
      data-veu={veu.escondida && !painel && !balao && !menu}
      data-mergulho={veu.mergulho}
      data-barra={veu.barraNoTopo}
      style={
        {
          '--origem-x': `${leitura.origem.x}px`,
          '--origem-y': `${leitura.origem.y}px`,
          // 'fraunces' (config antiga) cai na Cormorant, que tomou o lugar dela nos títulos
          '--l-fonte': FONTES.find((f) => f[0] === cfg.fonte)?.[2] ?? 'var(--fonte-titulo)',
        } as CSSProperties
      }
      onPointerMove={(e) => veu.aoMoverPonteiro(e.clientY)}
      // o menu do navegador nunca aparece aqui; PDF e EPUB pedem o nosso pelo motor, o texto corrido pela casca
      onContextMenu={(e) => {
        e.preventDefault();
        if (formato === 'texto' && palco.current?.contains(e.target as Node)) {
          setBalao(null);
          setMenu({ x: e.clientX, y: e.clientY, selecao: selecaoAtual.current, marcacaoId: null });
        }
      }}
    >
      <BarraLeitor
        obra={obra}
        edicao={edicao}
        fracao={fracao}
        quantasMarcacoes={marcacoes.length}
        painel={painel}
        alternarPainel={alternarPainel}
        marcarPagina={() => marcarPagina()}
        mergulhar={() => veu.mergulhar(true)}
        modo={modo.id}
        estadoModo={modo.estado}
        alternarModo={modo.alternar}
      />

      {painel === 'aparencia' && <PainelAparencia cfg={cfg} mudar={mudar} previa={setPrevia} />}
      {painel === 'modo' && (
        <PainelModo
          capacidades={viva?.capacidades}
          modo={modo.id}
          aoEscolher={modo.mudar}
          velocidade={modo.velocidade}
          aoMudarVelocidade={modo.mudarVelocidade}
          estado={modo.estado}
          aoAlternar={modo.alternar}
        />
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
        <MenuDoLeitor
          menu={menu}
          formato={formato}
          marcacoes={marcacoes}
          cores={cores}
          obra={obra}
          leitor={leitor}
          servicos={servicos}
          posicao={posicaoAtual.current}
          aoFechar={() => setMenu(null)}
          marcarSelecao={marcarSelecao}
          abrirBalao={setBalao}
          abrirPainel={setPainel}
          marcarPagina={marcarPagina}
          copiar={(t, m) => void copiar(t, m)}
          copiarCitacao={copiarCitacao}
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
      {veu.mergulho && (
        <div className="leitor-anel">
          <Anel fracao={fracao} tamanho={34} />
        </div>
      )}
    </div>
  );
}
