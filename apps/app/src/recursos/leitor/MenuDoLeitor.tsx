// O menu de botão direito do leitor: monta os itens (menuItens.ts) ligando cada ação ao leitor, ao balão e aos painéis.
import type { Ancora, CorMarcacao, Marcacao, Obra } from '@fierium/contratos';
import type { PedidoMenu, Selecao } from '@fierium/leitor-base';
import { abrirCartao } from '../../nucleo/navegacao';
import type { Servicos } from '../../nucleo/servicos';
import { ancoraDaPosicao, type EstadoBalao } from './ancora';
import type { PainelAberto } from './BarraLeitor';
import type { Leitor as EstadoLeitor } from './estado';
import { MenuContexto } from './MenuContexto';
import { itensDoMenu, type CasoMenu } from './menuItens';

interface Props {
  menu: PedidoMenu;
  formato: 'pdf' | 'epub' | 'texto';
  marcacoes: Marcacao[];
  cores: CorMarcacao[];
  obra: Obra | null;
  leitor: EstadoLeitor;
  servicos: Servicos;
  /** a posição de leitura atual do motor (pra saber a página/lugar) */
  posicao: string;
  aoFechar(): void;
  marcarSelecao(s: Selecao, cor: string): Promise<Marcacao | null>;
  abrirBalao(b: EstadoBalao): void;
  abrirPainel(p: Exclude<PainelAberto, null>): void;
  marcarPagina(pagina?: number): void;
  copiar(texto: string, msg: string): void;
  copiarCitacao(t: { trecho: string; ancora: Ancora }): void;
}

export function MenuDoLeitor(p: Props) {
  const { menu, formato, marcacoes, cores, obra, leitor } = p;
  const corPadrao = cores.find((c) => c.id !== 'citacao')?.id ?? cores[0]?.id ?? '';
  const corCitacao = cores.find((c) => c.id === 'citacao')?.id ?? corPadrao;
  const marcada = menu.marcacaoId ? (marcacoes.find((m) => m.id === menu.marcacaoId) ?? null) : null;
  const caso: CasoMenu = menu.selecao ? 'selecao' : marcada ? 'marcacao' : 'pagina';
  const paginaDoMenu = menu.pagina ?? (formato === 'pdf' ? Number(p.posicao.split(':')[0]) : 0);
  const ancoraAtual = JSON.stringify(ancoraDaPosicao(formato, p.posicao));
  const paginaMarcada = marcacoes.some(
    (m) =>
      m.tipo === 'marcador' &&
      (formato === 'pdf'
        ? m.ancora.tipo === 'pdf' && m.ancora.pagina === paginaDoMenu
        : JSON.stringify(m.ancora) === ancoraAtual),
  );
  const fechar = p.aoFechar;
  const apagar = (id: string) => void leitor.apagarMarcacao(id).catch(() => undefined);

  return (
    <MenuContexto
      x={menu.x}
      y={menu.y}
      aoFechar={fechar}
      itens={itensDoMenu({
        caso,
        cores,
        corAtual: marcada?.cor,
        formato,
        paginaMarcada,
        acoes: {
          marcarCor: (cor) => {
            fechar();
            if (menu.selecao) void p.marcarSelecao(menu.selecao, cor);
          },
          anotar: () => {
            const s = menu.selecao;
            fechar();
            if (!s) return;
            void p
              .marcarSelecao(s, corPadrao)
              .then((m) => m && p.abrirBalao({ caixa: s.caixa, nova: null, marcacaoId: m.id, focar: true }));
          },
          salvarCitacao: () => {
            const s = menu.selecao;
            fechar();
            if (!s) return;
            void p.marcarSelecao(s, corCitacao).then((m) => m && p.servicos.avisar('Citação salva em Notas.'));
          },
          copiar: () => {
            fechar();
            const t = menu.selecao?.trecho ?? marcada?.trecho;
            if (t) p.copiar(t, 'Copiado.');
          },
          copiarCitacao: () => {
            fechar();
            const t = menu.selecao ?? marcada;
            if (t) p.copiarCitacao(t);
          },
          compartilhar: () => {
            fechar();
            const t = menu.selecao ?? marcada;
            if (t) abrirCartao({ trecho: t.trecho, autor: obra?.criadores[0]?.nome ?? '', livro: obra?.titulo ?? '' });
          },
          editarNota: () => {
            fechar();
            if (!marcada) return;
            leitor.selecionar(marcada.id);
            p.abrirBalao({
              caixa: { x: menu.x, y: menu.y, largura: 0, altura: 0 },
              nova: null,
              marcacaoId: marcada.id,
              focar: true,
            });
          },
          trocarCor: (cor) => {
            fechar();
            if (marcada) void leitor.mudarMarcacao(marcada.id, { cor }).catch(() => undefined);
          },
          apagar: () => {
            fechar();
            if (marcada) apagar(marcada.id);
          },
          marcarPagina: () => {
            fechar();
            p.marcarPagina(menu.pagina);
          },
          abrirNotas: () => {
            fechar();
            p.abrirPainel('notas');
          },
          abrirTema: () => {
            fechar();
            p.abrirPainel('aparencia');
          },
          copiarPagina: () => {
            fechar();
            const n = menu.pagina ?? Number(p.posicao.split(':')[0]);
            if (n) p.copiar(String(n), `Página ${n} copiada.`);
          },
        },
      })}
    />
  );
}
