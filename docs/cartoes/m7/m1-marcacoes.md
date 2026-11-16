# Cartão m7/m1 · Marcações no PDF e no EPUB, guardadas no Rust

**Estado:** em revisão
**Branch:** a mesma do T1 (sequencial)
**Depende de:** T1 · **Destrava:** M2

## Objetivo

Selecionar um trecho no PDF ou no EPUB, escolher a cor (que tem significado: Importante, Ideia, Dúvida, Citação… as
que já existem) e escrever uma nota; a marcação fica pintada no texto, sobrevive a fechar o app, a trocar o zoom/
fonte, e clicar nela abre o balão de novo. Também marcador de página (só lembrar o lugar).

## Leia antes

- `AGENTS.md`; `packages/leitores/src/motor.ts` (`selecao`, `marcacaoClicada`, `mostrarMarcacoes`, `limparSelecao`,
  `irPara({marcacaoId})`); `apps/app/src/recursos/leitor/Tela.tsx` e `Balao.tsx` (o balão já existe e funciona com o
  motor de texto); `Marcacao`/`Ancora` e os comandos `marcacao*` em `packages/contratos/src/index.ts`;
  `packages/cliente/src/memoria/marcacoes.ts` (o comportamento esperado); `crates/fierium-biblioteca/src/lib.rs` e
  `crates/fierium-app/src/comandos.rs`

## Pode mexer

- `crates/fierium-biblioteca/` (migração v2 + módulo de marcações), `crates/fierium-app/src/comandos.rs`,
  `packages/leitores/src/pdf/`, `packages/leitores/src/epub/`, `apps/app/src/recursos/leitor/`, testes e e2e

## Faça

1. Rust: tabela `marcacoes` (todos os campos de `Marcacao`, `ancora`/`etiquetas`/`ligacoes` em JSON, lápide
   `apagado_em`) e as cores com significado (as mesmas do exemplo em memória) por migração **v2** (banco v1 abre e
   migra). Comandos `marcacoes.listar` (filtros obraId, cor, texto sem acento; mais novas primeiro), `marcacao.criar`,
   `marcacao.atualizar`, `marcacao.apagar` (tira das ligações), com os mesmos erros do contrato. Entram no
   `app.comandos` (aí o adaptador combinado manda pro Rust). Testes.
2. PDF: camada de texto do pdf.js (`TextLayer`) nas páginas desenhadas, pra selecionar. Seleção →
   `eventos.selecao({ ancora: { tipo: 'pdf', pagina, retangulos: [x,y,l,a normalizados 0..1] }, trecho, caixa })`.
   `mostrarMarcacoes` desenha retângulos translúcidos da cor por cima da página (camada própria, que acompanha zoom e
   tema); clique num retângulo → `marcacaoClicada`. `irPara({marcacaoId})` rola até ela. Marcação que cruza páginas:
   um retângulo por página, uma marcação só.
3. EPUB: `rendition.on('selected')` → âncora `{ tipo: 'epub', cfiInicio, cfiFim }` + trecho; `mostrarMarcacoes` com
   `rendition.annotations.highlight` (cor da marcação); clique → `marcacaoClicada`; `irPara({marcacaoId})` vai pro CFI.
4. Leitor: conferir que o balão (cores + nota + apagar) funciona com os dois motores; marcador de página pelo botão
   de marcador da barra.

## Pronto quando

- [ ] e2e PDF e EPUB: selecionar, marcar como Dúvida com nota, fechar, reabrir → a marcação está pintada no mesmo
      lugar; clicar abre o balão com a nota; apagar some
- [ ] Teste Rust: banco v1 migra pra v2 sem perder obras e progresso
- [ ] `pnpm check`, `pnpm e2e --trace off`, `pnpm check:rust`

## Relatório (o executor preenche)

- **Feito:** marcações no PDF (camada de texto do pdf.js + camada própria de retângulos em %) e no EPUB (`selected` +
  `annotations.highlight`), âncoras do contrato, `irPara({marcacaoId})`, `limparSelecao`, clique na marcação → balão.
  **Menu do botão direito** (`MenuContexto.tsx` + `menuItens.ts`, motores avisam por `eventos.menu` novo e opcional em
  `motor.ts`): com seleção (cores, Anotar…, Salvar como citação, Copiar, Copiar como citação), em cima de marcação
  (editar nota, trocar cor, copiar, copiar como citação, apagar) e sem seleção (marcar página, Notas deste livro, Tema
  da página…, copiar nº da página no PDF); setas/Enter/Esc, tecla Menu e Shift+F10, Ctrl+Shift+C, dentro da tela, o menu
  do WebKit não aparece (nem no iframe do epub.js). **Painel "Notas deste livro"** (`PainelNotas.tsx`, Ctrl+Shift+N):
  ordem do livro, filtro por cor, busca, ir ao trecho, copiar citação, apagar. A formatação da citação foi pra
  `compartilhado/citacao.ts` (as Notas reexportam). Consertos achados no caminho: o Esc do balão também fechava o leitor;
  o PDF só avisava a posição depois de rolar (o botão "Marcar página" não fazia nada antes disso).
- **Portões:** `pnpm check` e `pnpm e2e --trace off` (19 testes) passam. `pnpm check:rust` não rodado (nada do Rust mudou
  nesta etapa).
- **Prints:** `apps/app/e2e/prints/m7-menu-{selecao,marcacao,pagina}-{pdf,epub}.png` e `m7-notas-do-livro-{pdf,epub}.png`.
- **Ficou de fora:** "Pesquisar no livro" (não existe busca no leitor; o item só aparece quando houver); menu no motor
  de texto corrido só tem o caso sem marcação; o teste Rust v1→v2 do cartão original não foi conferido aqui.
