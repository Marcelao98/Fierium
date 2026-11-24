// A "tomada" dos leitores (docs/ARQUITETURA.md §4). Um motor sabe desenhar UM tipo de conteúdo (texto, PDF, EPUB,
// mangá) dentro de um elemento e avisar o que acontece (posição, seleção, clique numa marcação). Não sabe de React,
// do núcleo, nem de onde vêm as marcações: a casca do leitor (no app) cuida da barra, do véu, dos temas e do balão
// de marcação, que são iguais pra todos os formatos.
import type { Ancora, ConfigLeitura, CorMarcacao, FonteLeitura, Marcacao } from '@fierium/contratos';

export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface Selecao {
  ancora: Ancora;
  trecho: string;
  /** onde a seleção está na tela (pra posicionar o balão) */
  caixa: Caixa;
}

/** Botão direito (ou a tecla Menu) no conteúdo: onde foi, o que há ali e a página (PDF). A casca desenha o menu. */
export interface PedidoMenu {
  /** posição na janela (já descontado o iframe do EPUB) */
  x: number;
  y: number;
  selecao: Selecao | null;
  marcacaoId: string | null;
  pagina?: number | undefined;
}

export interface EventosMotor {
  /** a posição de leitura mudou (formato do motor) e quanto do total já passou (0..1) */
  posicao(posicao: string, fracao: number): void;
  /** a pessoa selecionou um trecho (ou desfez a seleção: null) */
  selecao(s: Selecao | null): void;
  marcacaoClicada(id: string, caixa: Caixa): void;
  /** botão direito / tecla Menu (o motor já impediu o menu do navegador); opcional: motores sem menu não chamam */
  menu?(p: PedidoMenu): void;
  /** toque/clique no conteúdo sem selecionar nada (a casca alterna o véu) */
  toque(): void;
  /** algo deu errado dentro do motor (vai pro log e pro aviso) */
  erro(codigo: string, mensagem: string, detalhe?: string): void;
}

export interface OpcoesMotor {
  fonte: FonteLeitura;
  /** onde abrir (a posição salva) ou uma marcação pra mostrar */
  alvo?: { posicao: string } | { marcacaoId: string } | undefined;
  aparencia: ConfigLeitura;
  marcacoes: Marcacao[];
  cores: CorMarcacao[];
  eventos: EventosMotor;
}

/** O que a sessão sabe fazer além do básico. Os modos de leitura (modos/) só usam peças declaradas aqui. */
export interface Capacidades {
  /** `paginar` e `paginaAtual` (virar página/capítulo) */
  paginar: boolean;
  /** `linhas` (as linhas de texto visíveis com a posição na tela) */
  linhas: boolean;
  /** `rolarPor` e `rolagem` (rolar por código e saber onde está) */
  rolar: boolean;
  /** `destacarTrecho` (faixa passageira, que não é marcação) */
  destacar: boolean;
  /** `sumario` (índice do livro) */
  sumario?: boolean;
  /** `buscar` (procurar texto no livro) */
  buscar?: boolean;
}

/** Nenhuma peça comum (o ponto de partida de um motor que ainda não tem nenhuma). */
export const SEM_CAPACIDADES: Capacidades = { paginar: false, linhas: false, rolar: false, destacar: false };

/**
 * Uma linha de texto visível: `id` estável (o mesmo enquanto a linha existe, mesmo rolando; compare só por igualdade),
 * o texto e onde está na tela. `linhas()` devolve de cima pra baixo só as que têm o centro dentro da área visível.
 */
export interface Linha {
  id: string;
  texto: string;
  caixa: Caixa;
}

/** O destaque passageiro dos modos guiado/ouvir: uma faixa em coordenadas da tela (a mesma de `Linha.caixa`). */
export interface Faixa {
  caixa: Caixa;
}

export interface Rolagem {
  /** quanto já rolou (px) */
  atual: number;
  /** o máximo que dá pra rolar (px); 0 = cabe tudo na tela */
  total: number;
  /** a área visível do conteúdo na tela (as mesmas coordenadas de `Linha.caixa`) */
  area: Caixa;
}

/** Uma entrada do sumário (índice) do livro. */
export interface ItemSumario {
  titulo: string;
  /** a posição no formato do motor (serve pra `irPara`) */
  posicao: string;
  /** 0 = nível de cima */
  nivel: number;
}

/** Um resultado da busca no livro. */
export interface ResultadoBusca {
  trecho: string;
  posicao: string;
}

export interface PaginaAtual {
  /** 1..total */
  atual: number;
  total: number;
}

export interface SessaoLeitura {
  /** quais peças comuns esta sessão tem; ausente = nenhuma (ex.: o motor de texto) */
  capacidades?: Capacidades;
  /** (linhas) as linhas visíveis agora, de cima pra baixo, com o texto e a posição na tela. Barato: só o que se vê. */
  linhas?(): Linha[];
  /** (rolar) rola o conteúdo `px` pixels (negativo = pra cima). Uma atribuição de scrollTop: serve a cada quadro. */
  rolarPor?(px: number): void;
  /** (rolar) onde a rolagem está e quanto ainda cabe rolar */
  rolagem?(): Rolagem;
  /** (paginar) vira uma página (PDF) ou um capítulo (EPUB): +1 adiante, -1 atrás */
  paginar?(direcao: 1 | -1): void;
  /** (paginar) a página/capítulo atual e o total */
  paginaAtual?(): PaginaAtual;
  /** (destacar) mostra uma faixa passageira (acompanha a rolagem); null apaga. Nunca vira marcação nem é gravada. */
  destacarTrecho?(faixa: Faixa | null): void;
  /**
   * (rolar) avisa quando a PESSOA mexe no conteúdo (roda, toque, clique, tecla), nunca quando o código rola.
   * Devolve a função que desfaz o ouvinte. Os modos usam isto pra pausar.
   */
  aoInteragir?(ouvinte: () => void): () => void;
  /** (sumario) o índice do livro (próximos passos: só a assinatura está fixada) */
  sumario?(): Promise<ItemSumario[]>;
  /** (buscar) procura o texto no livro (próximos passos: só a assinatura está fixada) */
  buscar?(texto: string): Promise<ResultadoBusca[]>;
  aplicarAparencia(a: ConfigLeitura): void;
  mostrarMarcacoes(marcacoes: Marcacao[], cores: CorMarcacao[], selecionada?: string | null): void;
  irPara(alvo: { posicao: string } | { marcacaoId: string }): void;
  /** desfaz a seleção do texto (depois de marcar) */
  limparSelecao(): void;
  desmontar(): void;
}

export interface MotorDeLeitura {
  /** nome curto pro log ("texto", "pdf"…) */
  nome: string;
  aceita(f: FonteLeitura): boolean;
  montar(alvo: HTMLElement, op: OpcoesMotor): Promise<SessaoLeitura>;
}

export class ErroLeitor extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = 'ErroLeitor';
    this.codigo = codigo;
  }
}

export function erroSemLeitor(fonte: FonteLeitura): ErroLeitor {
  return new ErroLeitor(
    'FORMATO_SEM_LEITOR',
    fonte.tipo === 'arquivo' ? `ainda não sei ler ${fonte.formato.toUpperCase()}` : 'conteúdo sem leitor',
  );
}

/** Escolhe, entre motores já carregados, o que aceita a fonte (os testes usam; o app usa `carregarMotor`). */
export function escolherMotor(motores: readonly MotorDeLeitura[], fonte: FonteLeitura): MotorDeLeitura {
  const m = motores.find((x) => x.aceita(fonte));
  if (!m) throw erroSemLeitor(fonte);
  return m;
}

export function caixaDe(r: DOMRect | { left: number; top: number; width: number; height: number }): Caixa {
  return { x: r.left, y: r.top, largura: r.width, altura: r.height };
}
