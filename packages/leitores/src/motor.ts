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

export interface EventosMotor {
  /** a posição de leitura mudou (formato do motor) e quanto do total já passou (0..1) */
  posicao(posicao: string, fracao: number): void;
  /** a pessoa selecionou um trecho (ou desfez a seleção: null) */
  selecao(s: Selecao | null): void;
  marcacaoClicada(id: string, caixa: Caixa): void;
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

export interface SessaoLeitura {
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

export function escolherMotor(motores: readonly MotorDeLeitura[], fonte: FonteLeitura): MotorDeLeitura {
  const m = motores.find((x) => x.aceita(fonte));
  if (!m)
    throw new ErroLeitor(
      'FORMATO_SEM_LEITOR',
      fonte.tipo === 'arquivo' ? `ainda não sei ler ${fonte.formato.toUpperCase()}` : 'conteúdo sem leitor',
    );
  return m;
}

export function caixaDe(r: DOMRect | { left: number; top: number; width: number; height: number }): Caixa {
  return { x: r.left, y: r.top, largura: r.width, altura: r.height };
}
