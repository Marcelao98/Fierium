// Área "catálogo" (D30) no exemplo em memória: um punhado de itens de domínio público de mentira pra tela e os testes.
// No app de verdade quem responde é o Rust (crates/fierium-catalogo), com o catálogo do Gutenberg e outras fontes.
import type { ItemCatalogo } from '@fierium/contratos';
import { ErroFierium } from '../cliente';
import type { Tratadores } from './base';
import { normalizar } from './normalizar';

export const ESCREVEM_CATALOGO = ['catalogo.baixar', 'rede.definir', 'obra.editar', 'obra.aplicarSugestao'] as const;

const autor = (nome: string) => [{ nome, papel: 'autor' as const }];
const oferta = (n: number) => [
  {
    fonte: 'gutenberg',
    formato: 'epub' as const,
    url: `https://exemplo.invalid/${n}.epub`,
    licenca: 'Domínio público',
  },
];
// os assuntos imitam os do Gutenberg (em inglês): as coleções do Descobrir buscam por eles
const ITENS: ItemCatalogo[] = (
  [
    ['Quincas Borba', 'Machado de Assis', 1891, 55682, 'pt', 'Novels'],
    ['Memórias Póstumas de Brás Cubas', 'Machado de Assis', 1881, 54829, 'pt', 'Novels'],
    ['O Alienista', 'Machado de Assis', 1882, 57001, 'pt', 'Short Stories'],
    ['Iracema', 'José de Alencar', 1865, 44282, 'pt', 'Novels'],
    ['O Cortiço', 'Aluísio Azevedo', 1890, 34480, 'pt', 'Novels'],
    ['Frankenstein', 'Mary Shelley', 1818, 84, 'en', 'Science-Fiction & Fantasy'],
    ['Os Lusíadas', 'Luís de Camões', 1572, 3333, 'pt', 'Poetry'],
    ['Discourse on the Method', 'René Descartes', 1637, 59, 'en', 'Philosophy & Ethics'],
    ['On the Origin of Species', 'Charles Darwin', 1859, 1228, 'en', 'Science - Biology'],
  ] as const
).map(([titulo, nome, ano, n, idioma, assunto]) => ({
  id: `gutenberg:${n}`,
  tipo: 'livro',
  titulo,
  pessoas: autor(nome),
  idioma,
  ano,
  assuntos: [assunto],
  ofertas: oferta(n),
}));

export function comandosCatalogo(): Tratadores<
  | 'catalogo.buscar'
  | 'catalogo.item'
  | 'catalogo.baixar'
  | 'catalogo.fontes'
  | 'catalogo.atualizar'
  | 'catalogo.estado'
  | 'obra.sugestoes'
  | 'obra.aplicarSugestao'
  | 'obra.editar'
  | 'rede.ler'
  | 'rede.definir'
> {
  let rede = true;
  const achar = (id: string) => {
    const i = ITENS.find((x) => x.id === id);
    if (!i) throw new ErroFierium('NAO_ENCONTRADO', `item do catálogo não encontrado: ${id}`);
    return i;
  };
  return {
    'catalogo.buscar': ({ texto, idioma, autor: a, assunto, limite = 50, deslocamento = 0 }) => {
      const palavras = normalizar(texto ?? '')
        .split(/\s+/)
        .filter(Boolean);
      const r = ITENS.filter((i) => {
        const alvo = normalizar(`${i.titulo} ${i.pessoas.map((p) => p.nome).join(' ')}`);
        return (
          palavras.every((p) => alvo.includes(p)) &&
          (!idioma || i.idioma === idioma) &&
          (!assunto || i.assuntos.some((x) => normalizar(x).includes(normalizar(assunto)))) &&
          (!a || normalizar(i.pessoas.map((p) => p.nome).join(' ')).includes(normalizar(a)))
        );
      });
      return { itens: r.slice(deslocamento, deslocamento + limite), total: r.length };
    },
    'catalogo.item': ({ id }) => achar(id),
    'catalogo.baixar': ({ id }) => {
      achar(id);
      throw new ErroFierium('SEM_REDE', 'No navegador o Fierium não baixa livros: só no app instalado.');
    },
    'catalogo.fontes': () => [{ id: 'gutenberg', nome: 'Project Gutenberg', ligada: true, itens: ITENS.length }],
    'catalogo.atualizar': () => ({ id: 'gutenberg', nome: 'Project Gutenberg', ligada: true, itens: ITENS.length }),
    'catalogo.estado': () => ({ fase: 'pronto', itens: ITENS.length }),
    'obra.sugestoes': () => [],
    'obra.aplicarSugestao': ({ id }) => {
      throw new ErroFierium('NAO_ENCONTRADO', `sem sugestões pra ${id} no exemplo`);
    },
    'obra.editar': ({ id }) => {
      throw new ErroFierium('NAO_ENCONTRADO', `editar obra (${id}) só no app instalado`);
    },
    'rede.ler': () => ({ permitida: rede }),
    'rede.definir': ({ permitida }) => {
      rede = permitida;
      return { permitida: rede };
    },
  };
}
