// Texto de demonstração do M1. Dom Casmurro (Machado de Assis, 1899) é domínio público. As outras obras do exemplo
// ganham um texto curto que explica o que é a demonstração: a leitura de verdade (PDF e EPUB) chega no M4/M5.
import type { CapituloDemo } from '@fierium/contratos';

export const DOM_CASMURRO: CapituloDemo[] = [
  {
    titulo: 'I — Do título',
    paragrafos: [
      'Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos. A viagem era curta, e os versos pode ser que não fossem inteiramente maus. Sucedeu, porém, que, como eu estava cansado, fechei os olhos três ou quatro vezes; tanto bastou para que ele interrompesse a leitura e metesse os versos no bolso.',
      '— Continue, disse eu acordando.',
      '— Já acabei, murmurou ele.',
      '— São muito bonitos.',
      'Vi-lhe fazer um gesto para tirá-los outra vez do bolso, mas não passou do gesto; estava amuado. No dia seguinte entrou a dizer de mim nomes feios, e acabou alcunhando-me Dom Casmurro. Os vizinhos, que não gostam dos meus hábitos reclusos e calados, deram curso à alcunha, que afinal pegou. Nem por isso me zanguei. Contei a anedota aos amigos da cidade, e eles, por graça, chamam-me assim, alguns em bilhetes: "Dom Casmurro, domingo vou jantar com você." — "Vou para Petrópolis, Dom Casmurro; a casa é a mesma da Renânia; vê se deixas essa caverna do Engenho Novo, e vai lá passar uns quinze dias comigo." — "Meu caro Dom Casmurro, não cuide que o dispenso do teatro amanhã; venha e dormirá aqui na cidade; dou-lhe camarote, dou-lhe chá, dou-lhe cama; só não lhe dou moça."',
      'Não consultes dicionários. Casmurro não está aqui no sentido que eles lhe dão, mas no que lhe pôs o vulgo de homem calado e metido consigo. Dom veio por ironia, para atribuir-me fumos de fidalgo. Tudo por estar cochilando! Também não achei melhor título para a minha narração; se não tiver outro daqui até ao fim do livro, vai este mesmo. O meu poeta do trem ficará sabendo que não lhe guardo rancor. E com pequeno esforço, sendo o título seu, poderá cuidar que a obra é sua. Há livros que apenas terão isso dos seus autores; alguns nem tanto.',
    ],
  },
  {
    titulo: 'II — Do livro',
    paragrafos: [
      'Agora que expliquei o título, passo a escrever o livro. Antes disso, porém, digamos os motivos que me põem a pena na mão.',
      'Vivo só, com um criado. A casa em que moro é própria; fi-la construir de propósito, levado de um desejo tão particular que me vexa imprimi-lo, mas vá lá. Um dia, há bastantes anos, lembrou-me reproduzir no Engenho Novo a casa em que me criei na antiga Rua de Matacavalos, dando-lhe o mesmo aspecto e economia daquela outra, que desapareceu. Construtor e pintor entenderam bem as indicações que lhes fiz: é o mesmo prédio assobradado, três janelas de frente, varanda ao fundo, as mesmas alcovas e salas.',
      'Na principal destas, a pintura do teto e das paredes é mais ou menos igual, umas grinaldas de flores miúdas e grandes pássaros que as tomam nos bicos, de espaço a espaço. Nos quatro cantos do teto as figuras das estações, e ao centro das paredes os medalhões de César, Augusto, Nero e Massinissa, com os nomes por baixo... Não alcanço a razão de tais personagens. Quando fomos para a casa de Matacavalos, já ela estava assim decorada; vinha do decênio anterior. Naturalmente era gosto do tempo meter sabor clássico e figuras antigas em pinturas americanas. O mais é também análogo e parecido. Tenho chacarinha, flores, legume, uma casuarina, um poço e lavadouro. Uso louça velha e mobília velha. Enfim, agora, como outrora, há aqui o mesmo contraste da vida interior, que é pacata, com a exterior, que é ruidosa.',
      'O meu fim evidente era atar as duas pontas da vida, e restaurar na velhice a adolescência. Pois, senhor, não consegui recompor o que foi nem o que fui. Em tudo, se o rosto é igual, a fisionomia é diferente. Se só me faltassem os outros, vá; um homem consola-se mais ou menos das pessoas que perde; mas falto eu mesmo, e esta lacuna é tudo. O que aqui está é, mal comparando, semelhante à pintura que se põe na barba e nos cabelos, e que apenas conserva o hábito externo, como se diz nas autópsias; o interno não aguenta tinta.',
    ],
  },
];

/** Texto curto pras outras obras do exemplo. */
export function textoDeExemplo(titulo: string, autor: string): CapituloDemo[] {
  return [
    {
      titulo: 'Uma página de demonstração',
      paragrafos: [
        `Você abriu ${titulo}, de ${autor}. Esta biblioteca é um exemplo: as obras, as capas e as estatísticas existem só para mostrar como o Fierium funciona.`,
        'No marco 1 o leitor mostra este texto para você experimentar o jeito de ler: o portal que se abre, a interface que some quando você lê, os temas de papel, sépia, noite e tinta eletrônica, o tamanho e a fonte da letra.',
        'Selecione qualquer trecho deste parágrafo para marcar. Cada cor tem o significado que você escolher: importante, dúvida, citação, ideia. A marcação pode ganhar uma nota, e depois aparece na Marginália, junto com as marcações de todos os outros livros.',
        'A leitura de verdade dos seus PDFs chega no marco 4, e a dos seus EPUBs no marco 5. Até lá, Dom Casmurro, de Machado de Assis, tem os dois primeiros capítulos de verdade aqui dentro.',
      ],
    },
  ];
}
