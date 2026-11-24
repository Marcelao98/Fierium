// O catálogo de temas da página: os 22 do KOFlibrary (mesmos ids) + os novos, em grupos. Cada tema é só um par
// papel/tinta; brilho, contraste e luz quente são ajustes por cima (ConfigLeitura.pagina).
import type { PaginaLeitura, TemaMeu } from '@fierium/contratos';
import { PAGINA_PADRAO, type ParametrosPintor } from './pintor';

export interface TemaPagina {
  id: string;
  nome: string;
  grupo: string;
  /** `#rrggbb` */
  papel: string;
  /** `#rrggbb` */
  tinta: string;
}

/** Ordem dos grupos na grade (o "Meus temas" vem antes de todos, na tela). */
export const GRUPOS_TEMAS = [
  'Claros',
  'Escuros',
  'Céu de Fieri',
  'Natureza',
  'Pastéis',
  'Estações',
  'Papéis antigos',
  'Noturnos coloridos',
  'Neutros',
  'Retrô',
  'Acessível',
  'Daltonismo',
] as const;

// [id, nome, grupo, papel, tinta]
type Linha = [string, string, string, string, string];

const LINHAS: Linha[] = [
  // ---- os 22 do KOFlibrary ----
  ['original', 'Original', 'Claros', 'ffffff', '000000'],
  ['papel', 'Papel macio', 'Claros', 'f7f3ea', '222222'],
  ['sepia', 'Sépia', 'Claros', 'f4ecd8', '5b4636'],
  ['cafe-com-leite', 'Café com leite', 'Claros', 'e9d8bf', '3b2a1e'],
  ['pergaminho', 'Pergaminho', 'Claros', 'f1e0b5', '4a3520'],
  ['eink', 'Tinta eletrônica', 'Claros', 'e6e4df', '2a2a2a'],
  ['verde', 'Verde descanso', 'Claros', 'd8ecd3', '1f3a1f'],
  ['rosa', 'Rosa chá', 'Claros', 'fbe9ec', '4a2a33'],
  ['lavanda', 'Lavanda', 'Claros', 'ece6f5', '2e2440'],
  ['solar', 'Solarizado', 'Claros', 'fdf6e3', '586e75'],
  ['cinza', 'Cinza chumbo', 'Escuros', '3a3a3a', 'dcdcdc'],
  ['noite', 'Noite', 'Escuros', '141414', 'd6d6d6'],
  ['cafe-noite', 'Café à noite', 'Escuros', '1e1611', 'e3cfb4'],
  ['meia-noite', 'Meia-noite', 'Escuros', '0f1724', 'c8d6e8'],
  ['solar-escuro', 'Solarizado escuro', 'Escuros', '002b36', '93a1a1'],
  ['lousa', 'Lousa', 'Escuros', '22332b', 'e8efe9'],
  ['oled', 'Preto total', 'Escuros', '000000', 'bdbdbd'],
  ['terminal', 'Terminal', 'Retrô', '050a05', '33ff66'],
  ['ambar', 'Monitor âmbar', 'Retrô', '0d0700', 'ffb000'],
  ['gameboy', 'Game Boy', 'Retrô', '9bbc0f', '0f380f'],
  ['alto-contraste', 'Alto contraste', 'Acessível', '000000', 'ffff00'],
  ['branco-total', 'Branco total', 'Acessível', 'ffffff', '000000'],

  // ---- Céu de Fieri (a identidade do app) ----
  ['ceu-pergaminho', 'Pergaminho de Fieri', 'Céu de Fieri', 'f1e6c9', '2b2216'],
  ['ceu-noite', 'Noite de Fieri', 'Céu de Fieri', '12101f', 'e8d9b0'],
  ['ceu-ouro', 'Ouro na noite', 'Céu de Fieri', '12101f', 'd9b56a'],
  ['ceu-alvorada', 'Alvorada', 'Céu de Fieri', 'f6e3d0', '3a2540'],
  ['ceu-crepusculo', 'Crepúsculo', 'Céu de Fieri', '2a1b3d', 'f0c987'],
  ['ceu-astrolabio', 'Astrolábio', 'Céu de Fieri', '0e1b2c', 'e0c27a'],
  ['ceu-aurora', 'Aurora', 'Céu de Fieri', '10262a', 'bfe8d8'],

  // ---- Natureza ----
  ['floresta', 'Floresta', 'Natureza', '1b2e1f', 'd5e8c8'],
  ['musgo', 'Musgo', 'Natureza', 'c9d6b0', '2b3a1c'],
  ['oceano', 'Oceano', 'Natureza', '0b2a3a', 'bfe3f0'],
  ['areia', 'Areia', 'Natureza', 'e2c48e', '3b2a10'],
  ['lago', 'Lago', 'Natureza', 'bfdbe8', '10303f'],
  ['campo', 'Campo', 'Natureza', 'f0f0b0', '3a4a00'],
  ['pedra', 'Pedra', 'Natureza', 'd4d2cc', '2f2e2b'],
  ['neblina', 'Neblina', 'Natureza', 'e3e8ea', '2d3a40'],
  ['orvalho', 'Orvalho', 'Natureza', 'cfeadd', '0f3a2a'],
  ['vulcao', 'Vulcão', 'Natureza', '2a0d05', 'ff9a6a'],

  // ---- Pastéis ----
  ['pastel-pessego', 'Pêssego', 'Pastéis', 'ffe5d4', '5a3320'],
  ['pastel-menta', 'Menta', 'Pastéis', 'ddf5e6', '21493a'],
  ['pastel-ceu', 'Céu claro', 'Pastéis', 'dcebfa', '1f3a5f'],
  ['pastel-lilas', 'Lilás', 'Pastéis', 'eadcf8', '3f2a5c'],
  ['pastel-limao', 'Limão suave', 'Pastéis', 'f6f7d2', '4a4a16'],
  ['pastel-coral', 'Coral', 'Pastéis', 'ffdad6', '6b2a2a'],
  ['pastel-algodao', 'Algodão-doce', 'Pastéis', 'fdecf4', '5a2e45'],
  ['pastel-oliva', 'Oliva clara', 'Pastéis', 'e8ebd0', '3e4524'],
  ['pastel-turquesa', 'Turquesa suave', 'Pastéis', 'c4efee', '0d3b3b'],
  ['pastel-damasco', 'Damasco', 'Pastéis', 'fbe3c2', '5e3b14'],

  // ---- Estações ----
  ['primavera', 'Primavera', 'Estações', 'e9f5d8', '2d4a1e'],
  ['verao', 'Verão', 'Estações', 'fff3c4', '5c3a00'],
  ['outono', 'Outono', 'Estações', 'f0d9bc', '5a2d12'],
  ['inverno', 'Inverno', 'Estações', 'e3edf7', '1e2f45'],
  ['primavera-noite', 'Primavera à noite', 'Estações', '16231a', 'c9e6b8'],
  ['verao-noite', 'Verão à noite', 'Estações', '261d0a', 'f5d98a'],
  ['outono-noite', 'Outono à noite', 'Estações', '33160a', 'ffc78f'],
  ['inverno-noite', 'Inverno à noite', 'Estações', '0a1f33', 'dcecff'],

  // ---- Papéis antigos ----
  ['papiro', 'Papiro', 'Papéis antigos', 'e0d28a', '4a2f08'],
  ['manuscrito', 'Manuscrito', 'Papéis antigos', 'f5ead8', '5a1f1a'],
  ['jornal-velho', 'Jornal velho', 'Papéis antigos', 'cfc9b0', '1f1e1a'],
  ['carta-amarelada', 'Carta amarelada', 'Papéis antigos', 'f7e08a', '4a3a10'],
  ['mapa-antigo', 'Mapa antigo', 'Papéis antigos', 'd9c08c', '1f3a2c'],
  ['papel-pardo', 'Papel pardo', 'Papéis antigos', 'cdb798', '2e2012'],
  ['livro-de-razao', 'Livro de razão', 'Papéis antigos', 'efe9d6', '1e3a5c'],
  ['pergaminho-escuro', 'Pergaminho escuro', 'Papéis antigos', 'c9ae7c', '2a1d0e'],

  // ---- Noturnos coloridos ----
  ['noite-azul', 'Azul profundo', 'Noturnos coloridos', '081c3a', '9ec5ff'],
  ['noite-roxa', 'Noite roxa', 'Noturnos coloridos', '1a1030', 'd8c4ff'],
  ['noite-vinho', 'Noite de vinho', 'Noturnos coloridos', '2a0f1a', 'f2c4d0'],
  ['noite-verde', 'Noite verde', 'Noturnos coloridos', '0c1f17', 'b5f0cf'],
  ['noite-ciano', 'Noite ciano', 'Noturnos coloridos', '08242b', 'a8ebf5'],
  ['noite-magenta', 'Noite magenta', 'Noturnos coloridos', '2b0f28', 'f5b8eb'],
  ['noite-ouro', 'Noite dourada', 'Noturnos coloridos', '1a1405', 'ead27a'],
  ['noite-rubi', 'Noite rubi', 'Noturnos coloridos', '2a0a0a', 'ffb8b0'],
  ['noite-indigo', 'Noite índigo', 'Noturnos coloridos', '14123a', 'c5c2ff'],
  ['noite-ardosia', 'Ardósia', 'Noturnos coloridos', '263238', 'cfd8dc'],
  ['noite-cobre', 'Noite de cobre', 'Noturnos coloridos', '261710', 'e8b48a'],
  ['noite-esmeralda', 'Esmeralda', 'Noturnos coloridos', '07281f', '9ff0d2'],

  // ---- Neutros ----
  ['cinza-claro', 'Cinza claro', 'Neutros', 'd9d9d9', '111111'],
  ['cinza-medio', 'Cinza médio', 'Neutros', '9a9a9a', '111111'],
  ['grafite', 'Grafite', 'Neutros', '2e2e2e', 'ffffff'],
  ['carvao', 'Carvão', 'Neutros', '1c1c1c', 'c4c4c4'],
  ['gelo', 'Gelo', 'Neutros', 'f4f9fc', '0f2433'],
  ['marfim', 'Marfim', 'Neutros', 'fffdf5', '1a1a1a'],

  // ---- Retrô ----
  ['retro-ciano', 'Fósforo ciano', 'Retrô', '001a1f', '4df0ff'],
  ['retro-magenta', 'Neon magenta', 'Retrô', '1a0020', 'ff66e8'],
  ['tela-azul', 'Tela azul', 'Retrô', '0000aa', 'ffffff'],
  ['commodore', 'Commodore', 'Retrô', '352879', 'a0a0ff'],
  ['fosforo-branco', 'Fósforo branco', 'Retrô', '101010', 'e8f0e8'],
  ['sinal-vermelho', 'Sinal vermelho', 'Retrô', '140000', 'ff4040'],

  // ---- Acessível (contraste ≥ 7:1) ----
  ['acess-ciano', 'Ciano no preto', 'Acessível', '000000', '00ffff'],
  ['acess-verde', 'Verde no preto', 'Acessível', '000000', '7cff7c'],
  ['acess-amarelo', 'Preto no amarelo', 'Acessível', 'fff176', '000000'],
  ['acess-azul', 'Branco no azul', 'Acessível', '003366', 'ffffff'],
  ['acess-vinho', 'Branco no vinho', 'Acessível', '4a0000', 'ffffff'],
  ['acess-azul-ouro', 'Amarelo no azul', 'Acessível', '00205b', 'ffeb3b'],
  ['acess-creme', 'Preto no creme', 'Acessível', 'f5e9c0', '000000'],

  // ---- Daltonismo (azul × laranja, sem depender de vermelho × verde) ----
  ['dalt-azul-laranja', 'Azul sobre creme', 'Daltonismo', 'fff4e0', '003b73'],
  ['dalt-deuter', 'Azul-gelo', 'Daltonismo', 'ffe9c7', '0a2a5c'],
  ['dalt-prot', 'Creme e índigo', 'Daltonismo', 'fff8e1', '2b2b5c'],
  ['dalt-trit', 'Branco e vinho', 'Daltonismo', 'f2f7f7', '4a1f2b'],
  ['dalt-escuro-azul', 'Azul e laranja', 'Daltonismo', '0b1f3a', 'ffd58a'],
  ['dalt-escuro-laranja', 'Carvão e azul-claro', 'Daltonismo', '1f1a14', '8ec8ff'],
];

export const TEMAS_PAGINA: readonly TemaPagina[] = LINHAS.map(([id, nome, grupo, papel, tinta]) => ({
  id,
  nome,
  grupo,
  papel: `#${papel}`,
  tinta: `#${tinta}`,
}));

const POR_ID = new Map(TEMAS_PAGINA.map((t) => [t.id, t]));

export const temaPorId = (id: string): TemaPagina | undefined => POR_ID.get(id);

/** Filtra por nome (ou grupo), sem diferenciar maiúsculas nem acentos. */
export function buscarTemas<T extends { nome: string; grupo?: string }>(temas: readonly T[], busca: string): T[] {
  const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = sem(busca.trim());
  if (!q) return [...temas];
  return temas.filter((t) => sem(t.nome).includes(q) || sem(t.grupo ?? '').includes(q));
}

export interface TemaResolvido {
  /** id do tema do catálogo, id de "meus temas" ou "personalizado" */
  id: string;
  nome: string;
  papel: string;
  tinta: string;
}

/**
 * Descobre o papel e a tinta da página: tema do catálogo, um dos "meus temas" ou as cores livres. Id desconhecido
 * (tema apagado, config de outra versão) cai no padrão, sem erro.
 */
export function resolverTema(pagina: PaginaLeitura, meus: readonly TemaMeu[] = []): TemaResolvido {
  if (pagina.tema === 'personalizado' && pagina.papel && pagina.tinta)
    return { id: 'personalizado', nome: 'Personalizado', papel: pagina.papel, tinta: pagina.tinta };
  const meu = meus.find((m) => m.id === pagina.tema);
  if (meu) return { id: meu.id, nome: meu.nome, papel: meu.papel, tinta: meu.tinta };
  const t = POR_ID.get(pagina.tema) ?? POR_ID.get(PAGINA_PADRAO.tema)!;
  return { id: t.id, nome: t.nome, papel: t.papel, tinta: t.tinta };
}

/** Parâmetros prontos pro Pintor (tema resolvido + ajustes). */
export function parametrosDaPagina(pagina: PaginaLeitura, meus: readonly TemaMeu[] = []): ParametrosPintor {
  const t = resolverTema(pagina, meus);
  return {
    papel: t.papel,
    tinta: t.tinta,
    brilho: pagina.brilho,
    contraste: pagina.contraste,
    quente: pagina.quente,
    manterCores: pagina.manterCores,
  };
}
