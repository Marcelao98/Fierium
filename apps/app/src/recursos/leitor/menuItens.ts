// O que o menu do botão direito mostra em cada caso (puro, testável): com texto selecionado, em cima de uma
// marcação ou sem nada (a página). O componente só desenha; as ações vêm da casca do leitor.
import type { CorMarcacao } from '@fierium/contratos';
import type { NomeIcone } from '@fierium/ui';

export type CasoMenu = 'selecao' | 'marcacao' | 'pagina';

export type ItemMenu =
  | { tipo: 'sep' }
  | { tipo: 'cores'; cores: CorMarcacao[]; atual?: string | undefined; escolher(id: string): void }
  | {
      tipo: 'acao';
      id: string;
      rotulo: string;
      icone: NomeIcone;
      atalho?: string;
      perigo?: boolean;
      escolher(): void;
    };

export interface AcoesMenu {
  marcarCor(id: string): void;
  anotar(): void;
  salvarCitacao(): void;
  copiar(): void;
  copiarCitacao(): void;
  /** só existe quando o leitor tiver busca no livro */
  pesquisar?: () => void;
  editarNota(): void;
  trocarCor(id: string): void;
  apagar(): void;
  marcarPagina(): void;
  abrirNotas(): void;
  abrirTema(): void;
  copiarPagina(): void;
}

export interface EntradaMenu {
  caso: CasoMenu;
  cores: CorMarcacao[];
  /** cor da marcação sob o clique */
  corAtual?: string | undefined;
  formato: 'pdf' | 'epub' | 'texto';
  /** a página (ou o ponto) já tem marcador */
  paginaMarcada?: boolean;
  acoes: AcoesMenu;
}

const SEP: ItemMenu = { tipo: 'sep' };

export function itensDoMenu({ caso, cores, corAtual, formato, paginaMarcada, acoes: a }: EntradaMenu): ItemMenu[] {
  const acao = (
    id: string,
    rotulo: string,
    icone: NomeIcone,
    escolher: () => void,
    extra: { atalho?: string; perigo?: boolean } = {},
  ): ItemMenu => ({ tipo: 'acao', id, rotulo, icone, escolher, ...extra });

  if (caso === 'selecao') {
    return [
      { tipo: 'cores', cores, escolher: a.marcarCor },
      SEP,
      acao('anotar', 'Anotar…', 'nota', a.anotar),
      acao('citacao', 'Salvar como citação', 'estrela', a.salvarCitacao),
      SEP,
      acao('copiar', 'Copiar', 'baixar', a.copiar, { atalho: 'Ctrl+C' }),
      acao('copiar-citacao', 'Copiar como citação', 'ligar', a.copiarCitacao, { atalho: 'Ctrl+Shift+C' }),
      ...(a.pesquisar ? [SEP, acao('pesquisar', 'Pesquisar no livro', 'buscar', a.pesquisar)] : []),
    ];
  }
  if (caso === 'marcacao') {
    return [
      acao('editar-nota', 'Editar nota', 'nota', a.editarNota),
      { tipo: 'cores', cores, atual: corAtual, escolher: a.trocarCor },
      SEP,
      acao('copiar', 'Copiar trecho', 'baixar', a.copiar),
      acao('copiar-citacao', 'Copiar como citação', 'ligar', a.copiarCitacao, { atalho: 'Ctrl+Shift+C' }),
      SEP,
      acao('apagar', 'Apagar marcação', 'lixo', a.apagar, { perigo: true }),
    ];
  }
  return [
    acao(
      'marcar-pagina',
      paginaMarcada ? 'Tirar o marcador desta página' : 'Marcar esta página',
      'marcador',
      a.marcarPagina,
    ),
    acao('notas', 'Notas deste livro', 'marginalia', a.abrirNotas, { atalho: 'Ctrl+Shift+N' }),
    acao('tema', 'Tema da página…', 'letra', a.abrirTema),
    ...(formato === 'pdf' ? [SEP, acao('copiar-pagina', 'Copiar o número da página', 'indice', a.copiarPagina)] : []),
  ];
}
