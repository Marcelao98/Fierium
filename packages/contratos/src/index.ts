// O contrato entre a interface e o núcleo (docs/CONTRATOS.md, docs/MODELO_DE_DADOS.md).
// PROVISÓRIO (D6): escrito à mão no M1; a partir do M2/M3 estes tipos são gerados a partir do Rust.
// Só tipos: este pacote não importa nada.

/** UUIDv7 em texto. */
export type Id = string;
/** Instante em milissegundos desde 1970 (UTC). */
export type Instante = number;

export type Formato = 'epub' | 'pdf' | 'cbz' | 'cbr' | 'audio';
export type EstadoLeitura = 'nao-lida' | 'lendo' | 'lida' | 'deixada';

export interface Criador {
  nome: string;
  papel: 'autor' | 'tradutor' | 'ilustrador' | 'narrador' | 'organizador';
}

export interface Arquivo {
  id: Id;
  nome: string;
  /** relativo à pasta da biblioteca, com "/" */
  caminho: string;
  tamanho: number;
  /** o arquivo está neste aparelho */
  disponivel: boolean;
}

export interface Progresso {
  /** posição no formato da edição: página ("12"), CFI do EPUB ou "capitulo:offset" no texto de demonstração */
  posicao: string;
  /** 0..1 */
  fracao: number;
  quando: Instante;
}

export interface Edicao {
  id: Id;
  obraId: Id;
  formato: Formato;
  idioma: string;
  descricao: string;
  paginas?: number;
  /** endereço da capa (imagem); sem capa = a interface desenha um selo */
  capa?: string;
  arquivos: Arquivo[];
  progresso?: Progresso;
}

export interface Relacao {
  estado: EstadoLeitura;
  favorita: boolean;
  adicionadaEm: Instante;
  ultimaLeitura?: Instante;
  terminadaEm?: Instante;
}

export interface Obra {
  id: Id;
  titulo: string;
  subtitulo?: string;
  criadores: Criador[];
  ano?: number;
  assuntos: string[];
  /** de onde ela é no reino: "romance", "filosofia", "ciência", "mangá"… (vira região no Atlas) */
  reino: string;
  serie?: { nome: string; volume: number };
  sinopse?: string;
  /** matiz (0..360) da capa gerada (selo) quando não há imagem */
  matiz: number;
  colecaoIds: Id[];
  edicoes: Edicao[];
  relacao: Relacao;
}

export interface Colecao {
  id: Id;
  nome: string;
  descricao: string;
  /** matiz (0..360) da atmosfera do espaço */
  matiz: number;
  obraIds: Id[];
  criadaEm: Instante;
}

/** Uma cor de marcação com o significado que a pessoa deu. */
export interface CorMarcacao {
  id: string;
  nome: string;
  /** cor em hex (#rrggbb) */
  cor: string;
}

export type Ancora =
  /** texto de demonstração do M1: capítulo + parágrafo + deslocamento em caracteres */
  | { tipo: 'texto'; capitulo: number; paragrafo: number; inicio: number; fim: number }
  /** EPUB (M5/M6) */
  | { tipo: 'epub'; cfiInicio: string; cfiFim: string }
  /** PDF (M4/M6): retângulos normalizados 0..1 na página */
  | { tipo: 'pdf'; pagina: number; retangulos: [number, number, number, number][] };

export type TipoMarcacao = 'destaque' | 'nota' | 'marcador';

export interface Marcacao {
  id: Id;
  obraId: Id;
  edicaoId: Id;
  tipo: TipoMarcacao;
  ancora: Ancora;
  /** o texto marcado (também conserta a âncora se o layout mudar) */
  trecho: string;
  /** id de uma CorMarcacao */
  cor: string;
  nota?: string;
  etiquetas: string[];
  /** ids de outras marcações ou obras ligadas a esta */
  ligacoes: Id[];
  criadaEm: Instante;
  editadaEm: Instante;
}

export interface CapituloDemo {
  titulo: string;
  paragrafos: string[];
}

/**
 * O que o leitor precisa pra abrir uma edição. `texto` = conteúdo embutido (demonstração); `arquivo` = endereço que
 * entrega o arquivo aos pedaços (Range), lido pelo motor do formato (PDF no M4, EPUB no M5, mangá no M6).
 */
export type FonteLeitura =
  | { tipo: 'texto'; edicaoId: Id; capitulos: CapituloDemo[] }
  | { tipo: 'arquivo'; edicaoId: Id; formato: Formato; url: string; tamanho: number };

export type Periodo = 'dia' | 'semana' | 'mes' | 'ano';
export type TipoMeta = 'livros' | 'paginas' | 'minutos';

export interface Meta {
  id: Id;
  periodo: Periodo;
  tipo: TipoMeta;
  alvo: number;
}

export interface SituacaoMeta {
  meta: Meta;
  feito: number;
  /** 0..1 */
  fracao: number;
}

export interface DiaDeLeitura {
  /** AAAA-MM-DD */
  dia: string;
  segundos: number;
  paginas: number;
}

export interface ResumoEstatisticas {
  hoje: { segundos: number; paginas: number };
  semana: { segundos: number; paginas: number };
  /** dias seguidos com pelo menos 5 min (hoje sem leitura ainda não quebra) */
  sequencia: number;
  recorde: number;
  terminadasNoAno: number;
  /** últimos 365 dias, do mais antigo pro mais novo */
  dias: DiaDeLeitura[];
  metas: SituacaoMeta[];
  /** 0..23, ou null sem dados */
  horaFavorita: number | null;
  porReino: { reino: string; segundos: number }[];
}

export interface Limiar {
  /** o "último sonho": a obra que estava sendo lida por último */
  ultimo: Obra | null;
  emAndamento: Obra[];
  /** um destaque antigo que volta (eco) */
  eco: { marcacao: Marcacao; obra: Obra } | null;
  novidades: Obra[];
  /** obras que nunca foram abertas ("estrelas esquecidas") */
  esquecidas: Obra[];
  totalObras: number;
}

export type Ordem = 'recentes' | 'titulo' | 'autor' | 'progresso';

export interface FiltroObras {
  texto?: string;
  estado?: EstadoLeitura;
  formato?: Formato;
  colecaoId?: Id;
  reino?: string;
  favoritas?: boolean;
  ordem?: Ordem;
}

export interface ResultadoBusca {
  tipo: 'obra' | 'colecao' | 'marcacao' | 'criador';
  id: Id;
  titulo: string;
  detalhe: string;
  /** a obra a abrir (marcação, criador) */
  obraId?: Id;
}

export type Tema = 'noite' | 'lucido' | 'sistema';
export type TemaLeitura = 'papel' | 'sepia' | 'noite' | 'tinta';

export interface ConfigLeitura {
  fonte: 'literata' | 'inter' | 'fraunces';
  /** px */
  tamanho: number;
  entrelinha: number;
  /** largura máxima da coluna em caracteres (ch) */
  largura: number;
  tema: TemaLeitura;
}

export interface Config {
  tema: Tema;
  movimento: 'normal' | 'reduzido';
  leitura: ConfigLeitura;
  cores: CorMarcacao[];
  primeiraVez: boolean;
}

export interface InfoApp {
  versao: string;
  plataforma: string;
  /** qual adaptador está respondendo: "memória" no M1 */
  adaptador: string;
}

/** Erro do núcleo: sempre um código estável e uma mensagem em português. */
export interface ErroContrato {
  codigo: string;
  mensagem: string;
}

/** Todos os comandos: nome → [argumentos, resposta]. */
export interface Comandos {
  'app.info': [Record<string, never>, InfoApp];
  /** quais comandos o núcleo Rust já atende (o resto ainda vem do exemplo em memória) */
  'app.comandos': [Record<string, never>, string[]];
  /** uma linha do log da interface no arquivo de log do núcleo */
  'log.escrever': [
    { nivel: 'debug' | 'info' | 'aviso' | 'erro'; origem: string; mensagem: string; dados?: unknown },
    null,
  ];
  'biblioteca.limiar': [Record<string, never>, Limiar];
  'obras.listar': [FiltroObras, Obra[]];
  'obra.obter': [{ id: Id }, Obra];
  'obra.atualizar': [{ id: Id; favorita?: boolean; estado?: EstadoLeitura }, Obra];
  'colecoes.listar': [Record<string, never>, Colecao[]];
  'colecao.criar': [{ nome: string; descricao: string; matiz: number }, Colecao];
  'colecao.definirObras': [{ id: Id; obraIds: Id[] }, Colecao];
  'edicao.abrir': [{ edicaoId: Id }, FonteLeitura];
  'progresso.salvar': [{ edicaoId: Id; posicao: string; fracao: number }, null];
  'marcacoes.listar': [{ obraId?: Id; cor?: string; texto?: string }, Marcacao[]];
  'marcacao.criar': [Omit<Marcacao, 'id' | 'criadaEm' | 'editadaEm'>, Marcacao];
  'marcacao.atualizar': [{ id: Id; cor?: string; nota?: string; etiquetas?: string[]; ligacoes?: Id[] }, Marcacao];
  'marcacao.apagar': [{ id: Id }, null];
  'sessao.registrar': [{ edicaoId: Id; segundos: number; paginas: number }, null];
  'estatisticas.resumo': [Record<string, never>, ResumoEstatisticas];
  'metas.salvar': [{ metas: Meta[] }, SituacaoMeta[]];
  'config.ler': [Record<string, never>, Config];
  'config.gravar': [{ config: Config }, Config];
  'busca.tudo': [{ texto: string }, ResultadoBusca[]];
}

export type NomeComando = keyof Comandos;
export type ArgsDe<C extends NomeComando> = Comandos[C][0];
export type RespostaDe<C extends NomeComando> = Comandos[C][1];

export const VERSAO_CONTRATO = 1;
