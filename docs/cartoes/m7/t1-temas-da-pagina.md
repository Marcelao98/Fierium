# Cartão m7/t1 · Temas da página (o Pintor) — PDF e EPUB

**Estado:** a fazer
**Branch:** a do executor (ex.: `codex/m7`), saindo de `claude/eloquent-fermat-z05qmh`
**Depende de:** — · **Destrava:** M1, M2

## Objetivo

A página do livro com a cor que a pessoa quiser: os **22 temas do KOFlibrary**, mais uns **80 novos** (≈ 100 no
total, em grupos) e **personalização total**: cor do papel e cor da letra livres (seletor de cor + hex), brilho,
contraste, luz quente e "manter as figuras coloridas". É tema **da página** (PDF e EPUB), não do app.

## Como o KOFlibrary faz (porte isto, em TypeScript)

O **Pintor** repinta os pixels RGBA do canvas da página. No `preparar` monta 3 tabelas de 256 cores: pra cada tom
`v` (0..255), `t = limita((v-128)*contraste/100 + 128 + brilho*128/100)`, cor = `mistura(tinta, papel, t)` (t/255 do
caminho da tinta até o papel), e a luz quente multiplica G por `(256 - quente*50/100)/256` e B por
`(256 - quente*150/100)/256`. No `pintar`, cada pixel: se "manter cores" e `max(r,g,b) - min(r,g,b) > 48` (é figura),
no tema **claro** multiplica pelo papel (`r*papel.r/255`…), no tema **escuro** inverte o claro/escuro mantendo o matiz
(`d = 255 - max - min; r+=d; g+=d; b+=d`), e aplica a luz quente; senão, luminância `l = (77r + 151g + 28b) / 256` e
usa a tabela. Tema escuro = luminância do papel < luminância da tinta. "original" com brilho 0, contraste 100 e quente
0 não repinta nada. O fundo em volta das páginas acompanha o papel, um tom mais escuro.

Os 22 temas (id, nome, grupo, papel, tinta):
original Original Claros FFFFFF 000000 · papel "Papel macio" Claros F7F3EA 222222 · sepia Sépia Claros F4ECD8 5B4636 ·
cafe-com-leite "Café com leite" Claros E9D8BF 3B2A1E · pergaminho Pergaminho Claros F1E0B5 4A3520 ·
eink "Tinta eletrônica" Claros E6E4DF 2A2A2A · verde "Verde descanso" Claros D8ECD3 1F3A1F · rosa "Rosa chá" Claros
FBE9EC 4A2A33 · lavanda Lavanda Claros ECE6F5 2E2440 · solar Solarizado Claros FDF6E3 586E75 · cinza "Cinza chumbo"
Escuros 3A3A3A DCDCDC · noite Noite Escuros 141414 D6D6D6 · cafe-noite "Café à noite" Escuros 1E1611 E3CFB4 ·
meia-noite Meia-noite Escuros 0F1724 C8D6E8 · solar-escuro "Solarizado escuro" Escuros 002B36 93A1A1 · lousa Lousa
Escuros 22332B E8EFE9 · oled "Preto total" Escuros 000000 BDBDBD · terminal Terminal Retrô 050A05 33FF66 · ambar
"Monitor âmbar" Retrô 0D0700 FFB000 · gameboy "Game Boy" Retrô 9BBC0F 0F380F · alto-contraste "Alto contraste"
Acessível 000000 FFFF00 · branco-total "Branco total" Acessível FFFFFF 000000

## Leia antes

- `AGENTS.md`; `packages/leitores/src/pdf/motor-pdf.ts` (onde cada página vira canvas; o `aplicarTema` de hoje usa
  filtro CSS: troque pelo Pintor); `packages/leitores/src/epub/aparencia.ts`; `ConfigLeitura` em
  `packages/contratos/src/index.ts`; o painel de aparência do leitor em `apps/app/src/recursos/leitor/Tela.tsx`

## Pode mexer

- `packages/leitores/src/pintor/` (novo: `pintor.ts`, `temas.ts`, testes), `packages/leitores/src/pdf/`,
  `packages/leitores/src/epub/aparencia.ts`, `packages/contratos/src/index.ts` (só o que está abaixo),
  `packages/cliente/src/memoria/` (padrões da config), `apps/app/src/recursos/leitor/` (painel), testes e e2e

## Faça

1. `pintor.ts`: o algoritmo acima, puro (recebe `Uint8ClampedArray`), com testes de tabela: preto vira a tinta,
   branco vira o papel, pixel colorido no tema escuro mantém o matiz, "original" não muda nada.
2. `temas.ts`: os 22 acima **com os mesmos ids** + ~80 novos em grupos (sugestões: "Céu de Fieri" com o pergaminho e
   a noite azul e ouro do app, Natureza, Pastéis, Estações, Papéis antigos, Noturnos coloridos, Retrô, Acessível,
   Daltonismo). Teste que garante: ids únicos, nomes em português únicos, **contraste papel × tinta ≥ 4,5:1**
   (≥ 7:1 no grupo Acessível) e nenhum par quase igual a outro (distância de cor mínima entre temas).
3. Contrato: `ConfigLeitura.pagina = { tema: string; brilho: number; contraste: number; quente: number;
   manterCores: boolean }` e `ConfigLeitura.temasMeus: { id; nome; papel: string; tinta: string }[]` (hex `#rrggbb`),
   com padrão `{ tema: 'sepia', brilho: 0, contraste: 100, quente: 0, manterCores: true }` e `[]`. Config antiga sem
   esses campos continua abrindo (completa com o padrão).
4. PDF: cada página desenhada passa pelo Pintor (se o tema não for "original" puro); trocar o tema repinta as páginas
   visíveis sem recarregar o arquivo. Meça: repintar uma página A4 em 2× não pode passar de ~16 ms no Chromium; se
   passar, mova pra um worker (OffscreenCanvas) e diga no relatório.
5. EPUB: mesmo tema por cores (papel = fundo, tinta = texto, brilho/contraste por CSS `filter`) via
   `rendition.themes`; imagens não são repintadas.
6. Painel do leitor, seção "Página": grade de amostras (papel com um "Aa" na cor da tinta), agrupadas, com busca pelo
   nome; prévia ao passar o mouse; **"Personalizar"**: dois seletores de cor (papel e letra, aceitando hex digitado),
   brilho, contraste, luz quente e manter cores, com aviso se o contraste ficar < 4,5:1; **"Salvar como meu tema"**
   (nome) → aparece no grupo "Meus temas", que pode renomear e apagar. Os temas de cor do app (pergaminho/papel/sépia/
   noite/tinta da interface) continuam como estão.

## Pronto quando

- [ ] Testes do Pintor e do catálogo passando; ≈ 100 temas
- [ ] e2e: abrir o PDF de teste, trocar pra Noite e pra um tema personalizado (papel #102030, letra #F0E0C0), conferir
      a cor de um pixel de fundo e de um de texto na página; reabrir e o tema continua
- [ ] Print do painel com a grade de temas e do Personalizar
- [ ] `pnpm check`, `pnpm e2e --trace off` e `pnpm check:rust` passam

## Relatório (o executor preenche)

- **Feito:** · **Portões:** · **Prints:** · **Medição (ms por página):** · **Ficou de fora:**
