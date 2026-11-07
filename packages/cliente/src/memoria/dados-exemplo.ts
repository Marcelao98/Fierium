// A biblioteca de exemplo do adaptador em memória: obras de domínio público (e duas séries de mangá inventadas), com
// progresso, coleções, marcações e um ano de sessões de leitura. Tudo determinístico (mesma semente = mesmos dados),
// pra os testes e os prints darem sempre igual.
import type { Colecao, CorMarcacao, Formato, Marcacao, Meta, Obra } from '@fierium/contratos';
import { DOM_CASMURRO } from './texto-demo';

export interface Sessao {
  id: string;
  obraId: string;
  edicaoId: string;
  inicio: number;
  segundos: number;
  paginas: number;
  aparelho: string;
}

export interface Estado {
  obras: Obra[];
  colecoes: Colecao[];
  marcacoes: Marcacao[];
  sessoes: Sessao[];
  metas: Meta[];
}

/** Gerador pseudoaleatório pequeno e determinístico (mulberry32). */
export function sorteador(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Um id no formato UUIDv7 (tempo + aleatório), como o Rust vai gerar. */
export function novoId(agora: number, aleatorio: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(aleatorio() * 16).toString(16)).join('');
  const t = Math.floor(agora).toString(16).padStart(12, '0').slice(-12);
  const variante = '89ab'[Math.floor(aleatorio() * 4)];
  return `${t.slice(0, 8)}-${t.slice(8)}-7${hex(3)}-${variante}${hex(3)}-${hex(12)}`;
}

export const CORES_PADRAO: CorMarcacao[] = [
  { id: 'importante', nome: 'Importante', cor: '#e8c26a' },
  { id: 'ideia', nome: 'Ideia', cor: '#7cc7b4' },
  { id: 'duvida', nome: 'Dúvida', cor: '#d98a9c' },
  { id: 'citacao', nome: 'Citação', cor: '#a99be6' },
];

type Linha = [
  titulo: string,
  autor: string,
  ano: number | undefined,
  reino: string,
  formato: Formato,
  paginas: number,
  assuntos: string[],
  serie?: [string, number],
];

const OBRAS: Linha[] = [
  ['Dom Casmurro', 'Machado de Assis', 1899, 'Romance', 'epub', 256, ['literatura brasileira', 'realismo']],
  ['Memórias Póstumas de Brás Cubas', 'Machado de Assis', 1881, 'Romance', 'epub', 288, ['literatura brasileira']],
  ['Quincas Borba', 'Machado de Assis', 1891, 'Romance', 'pdf', 312, ['literatura brasileira']],
  ['O Cortiço', 'Aluísio Azevedo', 1890, 'Romance', 'epub', 304, ['literatura brasileira', 'naturalismo']],
  ['Iracema', 'José de Alencar', 1865, 'Romance', 'epub', 160, ['literatura brasileira', 'romantismo']],
  ['Crime e Castigo', 'Fiódor Dostoiévski', 1866, 'Romance', 'epub', 608, ['literatura russa']],
  ['Os Irmãos Karamázov', 'Fiódor Dostoiévski', 1880, 'Romance', 'epub', 960, ['literatura russa']],
  ['Orgulho e Preconceito', 'Jane Austen', 1813, 'Romance', 'epub', 424, ['literatura inglesa']],
  ['Moby Dick', 'Herman Melville', 1851, 'Romance', 'pdf', 720, ['literatura americana', 'mar']],
  ['O Banquete', 'Platão', undefined, 'Filosofia', 'pdf', 128, ['filosofia antiga', 'amor']],
  ['A República', 'Platão', undefined, 'Filosofia', 'epub', 416, ['filosofia antiga', 'política']],
  ['Meditações', 'Marco Aurélio', undefined, 'Filosofia', 'epub', 224, ['estoicismo']],
  ['Ética a Nicômaco', 'Aristóteles', undefined, 'Filosofia', 'pdf', 352, ['filosofia antiga', 'ética']],
  ['Assim Falou Zaratustra', 'Friedrich Nietzsche', 1883, 'Filosofia', 'epub', 400, ['filosofia moderna']],
  ['Discurso do Método', 'René Descartes', 1637, 'Filosofia', 'pdf', 96, ['filosofia moderna', 'método']],
  ['A Origem das Espécies', 'Charles Darwin', 1859, 'Ciência', 'pdf', 512, ['biologia', 'evolução']],
  ['Diálogo sobre os Dois Máximos Sistemas', 'Galileu Galilei', 1632, 'Ciência', 'pdf', 480, ['astronomia', 'física']],
  ['Relatividade: a Teoria Especial e a Geral', 'Albert Einstein', 1916, 'Ciência', 'pdf', 168, ['física']],
  ['Os Elementos', 'Euclides', undefined, 'Ciência', 'pdf', 544, ['matemática', 'geometria']],
  ['Alice no País das Maravilhas', 'Lewis Carroll', 1865, 'Fantasia e mito', 'epub', 192, ['fantasia', 'sonho']],
  ['Frankenstein', 'Mary Shelley', 1818, 'Fantasia e mito', 'epub', 280, ['ficção científica', 'gótico']],
  ['Drácula', 'Bram Stoker', 1897, 'Fantasia e mito', 'epub', 418, ['gótico', 'horror']],
  ['A Odisseia', 'Homero', undefined, 'Fantasia e mito', 'epub', 560, ['mito', 'épico']],
  ['As Mil e Uma Noites', 'Anônimo', undefined, 'Fantasia e mito', 'pdf', 900, ['contos', 'mito']],
  ['O Mágico de Oz', 'L. Frank Baum', 1900, 'Fantasia e mito', 'epub', 176, ['fantasia']],
  ['Os Lusíadas', 'Luís de Camões', 1572, 'Poesia', 'epub', 400, ['épico', 'poesia portuguesa']],
  ['Folhas de Relva', 'Walt Whitman', 1855, 'Poesia', 'epub', 320, ['poesia americana']],
  ['Eu', 'Augusto dos Anjos', 1912, 'Poesia', 'pdf', 144, ['poesia brasileira']],
  ['Cálculo — Notas de Aula', 'Fierium (exemplo)', 2026, 'Estudos', 'pdf', 420, ['matemática', 'cálculo']],
  ['Termodinâmica — Apostila', 'Fierium (exemplo)', 2026, 'Estudos', 'pdf', 310, ['física', 'termodinâmica']],
  ['Introdução aos Algoritmos — Resumos', 'Fierium (exemplo)', 2026, 'Estudos', 'pdf', 180, ['computação']],
  ...[1, 2, 3, 4, 5, 6].map(
    (v): Linha => [`Lâmina do Crepúsculo vol. ${v}`, 'Série de exemplo', 2024, 'Mangá', 'cbz', 192, ['ação', 'fantasia'], ['Lâmina do Crepúsculo', v]],
  ),
  ...[1, 2, 3].map(
    (v): Linha => [`Jardim de Vidro vol. ${v}`, 'Série de exemplo', 2025, 'Mangá', 'cbz', 176, ['slice of life'], ['Jardim de Vidro', v]],
  ),
];

const DIA = 86_400_000;

/** Monta a biblioteca de exemplo com o "agora" dado (os testes passam um fixo). */
export function bibliotecaDeExemplo(agora: number): Estado {
  const r = sorteador(1899);
  const id = () => novoId(agora - 400 * DIA + Math.floor(r() * 300 * DIA), r);
  const obras: Obra[] = OBRAS.map(([titulo, autor, ano, reino, formato, paginas, assuntos, serie], i) => {
    const obraId = id();
    const edicaoId = id();
    const nome = `${autor} - ${titulo}.${formato}`;
    const obra: Obra = {
      id: obraId,
      titulo,
      criadores: [{ nome: autor, papel: 'autor' }],
      assuntos,
      reino,
      matiz: Math.floor(r() * 360),
      colecaoIds: [],
      edicoes: [
        {
          id: edicaoId,
          obraId,
          formato,
          idioma: 'pt-BR',
          descricao: formato === 'pdf' ? 'PDF' : formato === 'cbz' ? 'Mangá (CBZ)' : 'EPUB',
          paginas,
          arquivos: [
            {
              id: id(),
              nome,
              caminho: `${reino}/${serie ? serie[0] + '/' : ''}${nome}`,
              tamanho: Math.round(paginas * (formato === 'pdf' ? 90_000 : formato === 'cbz' ? 400_000 : 4_000)),
              disponivel: true,
            },
          ],
        },
      ],
      relacao: { estado: 'nao-lida', favorita: false, adicionadaEm: agora - Math.floor(r() * 600) * DIA },
      ...(ano !== undefined ? { ano } : {}),
      ...(serie ? { serie: { nome: serie[0], volume: serie[1] } } : {}),
    };
    // Dom Casmurro é o "último sonho"; algumas lidas, algumas em andamento, o resto nunca aberto
    const sorte = r();
    const ed = obra.edicoes[0]!;
    if (i === 0) {
      obra.relacao = { ...obra.relacao, estado: 'lendo', favorita: true, ultimaLeitura: agora - 3 * 3_600_000 };
      ed.progresso = { posicao: '1:2:0', fracao: 0.62, quando: agora - 3 * 3_600_000 };
    } else if (sorte < 0.18) {
      const quando = agora - Math.floor(2 + r() * 20) * DIA;
      obra.relacao = { ...obra.relacao, estado: 'lendo', ultimaLeitura: quando };
      ed.progresso = { posicao: '0:0:0', fracao: Math.round((0.05 + r() * 0.85) * 100) / 100, quando };
    } else if (sorte < 0.4) {
      const quando = agora - Math.floor(20 + r() * 330) * DIA;
      obra.relacao = { ...obra.relacao, estado: 'lida', ultimaLeitura: quando, terminadaEm: quando, favorita: r() < 0.3 };
      ed.progresso = { posicao: '0:0:0', fracao: 1, quando };
    }
    return obra;
  });
  const porTitulo = (t: string) => obras.find((o) => o.titulo.startsWith(t))!;

  const colecao = (nome: string, descricao: string, matiz: number, filtro: (o: Obra) => boolean): Colecao => {
    const c: Colecao = { id: id(), nome, descricao, matiz, obraIds: [], criadaEm: agora - 200 * DIA };
    for (const o of obras.filter(filtro)) {
      c.obraIds.push(o.id);
      o.colecaoIds.push(c.id);
    }
    return c;
  };
  const colecoes = [
    colecao('Clássicos brasileiros', 'Machado, Alencar, Aluísio: a casa onde a gente aprendeu a ler.', 32, (o) =>
      o.assuntos.includes('literatura brasileira'),
    ),
    colecao('Os antigos', 'Perguntas de dois mil anos que ainda não acabaram.', 215, (o) =>
      o.assuntos.includes('filosofia antiga') || o.assuntos.includes('estoicismo') || o.titulo === 'A Odisseia',
    ),
    colecao('Semestre 2027.1', 'Cálculo, termodinâmica e algoritmos. Foco.', 190, (o) => o.reino === 'Estudos'),
    colecao('Mundos de sonho', 'Por onde a imaginação foge.', 285, (o) =>
      ['sonho', 'fantasia', 'mito'].some((a) => o.assuntos.includes(a)),
    ),
  ];

  // marcações: em Dom Casmurro com âncora no texto de verdade; nas outras, de PDF/EPUB (só pra Marginália)
  const marcacoes: Marcacao[] = [];
  const dc = porTitulo('Dom Casmurro');
  const marcarTexto = (cap: number, par: number, frase: string, cor: string, nota?: string, diasAtras = 30) => {
    const p = DOM_CASMURRO[cap]!.paragrafos[par]!;
    const inicio = p.indexOf(frase);
    if (inicio < 0) throw new Error(`frase não achada no texto de exemplo: ${frase}`);
    const quando = agora - diasAtras * DIA;
    marcacoes.push({
      id: id(),
      obraId: dc.id,
      edicaoId: dc.edicoes[0]!.id,
      tipo: 'destaque',
      ancora: { tipo: 'texto', capitulo: cap, paragrafo: par, inicio, fim: inicio + frase.length },
      trecho: frase,
      cor,
      etiquetas: [],
      ligacoes: [],
      criadaEm: quando,
      editadaEm: quando,
      ...(nota ? { nota } : {}),
    });
  };
  marcarTexto(0, 5, 'Há livros que apenas terão isso dos seus autores; alguns nem tanto.', 'citacao', 'A ironia do Machado logo na primeira página.', 380);
  marcarTexto(1, 3, 'O meu fim evidente era atar as duas pontas da vida, e restaurar na velhice a adolescência.', 'importante', 'O livro inteiro está nesta frase.', 12);
  marcarTexto(1, 3, 'mas falto eu mesmo, e esta lacuna é tudo.', 'ideia', undefined, 12);
  const solta = (titulo: string, trecho: string, cor: string, pagina: number, nota: string | undefined, diasAtras: number) => {
    const o = porTitulo(titulo);
    const quando = agora - diasAtras * DIA;
    marcacoes.push({
      id: id(),
      obraId: o.id,
      edicaoId: o.edicoes[0]!.id,
      tipo: 'destaque',
      ancora: { tipo: 'pdf', pagina, retangulos: [[0.12, 0.3, 0.76, 0.04]] },
      trecho,
      cor,
      etiquetas: [],
      ligacoes: [],
      criadaEm: quando,
      editadaEm: quando,
      ...(nota ? { nota } : {}),
    });
  };
  solta('Meditações', 'A felicidade da tua vida depende da qualidade dos teus pensamentos.', 'importante', 41, undefined, 200);
  solta('O Banquete', 'O amor é o desejo de possuir o bem para sempre.', 'citacao', 77, 'Comparar com a Ética a Nicômaco, livro VIII.', 95);
  solta('Termodinâmica', 'A entropia de um sistema isolado nunca diminui.', 'duvida', 58, 'Por que "isolado" e não "fechado"? Perguntar na monitoria.', 6);
  solta('Alice no País das Maravilhas', 'Quem sou eu no mundo? Ah, esse é o grande enigma.', 'ideia', 23, undefined, 150);
  // uma ligação entre livros (o "fio" da Marginália)
  const banquete = marcacoes.find((m) => m.trecho.startsWith('O amor'))!;
  const lacuna = marcacoes.find((m) => m.trecho.startsWith('mas falto'))!;
  banquete.ligacoes.push(lacuna.id);
  lacuna.ligacoes.push(banquete.id);

  // um ano de sessões, nas obras lendo/lidas, com hábito à noite
  const sessoes: Sessao[] = [];
  const lidas = obras.filter((o) => o.relacao.estado !== 'nao-lida');
  for (let d = 365; d >= 0; d--) {
    if (d > 2 && r() < 0.28) continue; // dias sem leitura; os últimos dias sempre têm (sequência)
    const n = 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const o = d < 3 ? dc : lidas[Math.floor(r() * lidas.length)]!;
      const hora = r() < 0.6 ? 21 + Math.floor(r() * 3) : 7 + Math.floor(r() * 12);
      const segundos = 300 + Math.floor(r() * 3000);
      sessoes.push({
        id: id(),
        obraId: o.id,
        edicaoId: o.edicoes[0]!.id,
        inicio: diaInicio(agora - d * DIA) + hora * 3_600_000,
        segundos,
        paginas: Math.max(1, Math.round(segundos / 90)),
        aparelho: 'pc-exemplo',
      });
    }
  }

  const metas: Meta[] = [
    { id: id(), periodo: 'ano', tipo: 'livros', alvo: 24 },
    { id: id(), periodo: 'dia', tipo: 'minutos', alvo: 20 },
  ];
  return { obras, colecoes, marcacoes, sessoes, metas };
}

/** Meia-noite (hora local) do dia de `t`. */
export function diaInicio(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** AAAA-MM-DD na hora local. */
export function chaveDia(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
