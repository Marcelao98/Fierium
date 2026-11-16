# Cartão m7/m2 · Citações e o jeito de achar tudo depois

**Estado:** a fazer
**Branch:** a mesma do M1 (sequencial)
**Depende de:** M1 · **Destrava:** CP7a

## Objetivo

Tudo que a pessoa marcou, em todos os livros, num lugar só e fácil de usar: buscar, filtrar, abrir no trecho, copiar
como citação pronta e exportar.

## Leia antes

- `AGENTS.md`; `apps/app/src/recursos/notas/` (a tela já existe, com exportar Markdown em `markdown.ts`: hoje lê do
  exemplo em memória); `apps/app/src/casca/Busca.tsx` (Ctrl+K); `biblioteca.limiar` (o `eco` hoje é sempre null no
  Rust); `busca.tudo` no contrato

## Pode mexer

- `apps/app/src/recursos/notas/`, `apps/app/src/casca/Busca.tsx` (só o que precisar), `crates/fierium-biblioteca/`
  (eco do limiar e `busca.tudo`), `crates/fierium-app/src/comandos.rs`, testes e e2e

## Faça

1. Notas lendo do Rust (vem sozinho pelo adaptador combinado depois do M1; conferir): lista agrupada por livro e
   ordenada pela posição no livro, com filtros por livro, cor/significado, tipo (marca-texto, nota, marcador) e texto
   (sem acento); contagem por filtro.
2. Cada marcação: o trecho, a nota, a página (PDF) ou capítulo (EPUB), a data; botões **Abrir no trecho** (abre o
   leitor em `{marcacaoId}`), **Copiar citação** (formato: `“trecho” — Autor, *Título*, p. 37` ou `cap. 4` no EPUB;
   escolha ABNT simples nos Ajustes da tela: "Sobrenome, Nome. Título. p. 37"), editar nota, apagar.
3. Aba/atalho **Citações**: só as marcações com o significado "Citação" (e as favoritas), num layout de leitura
   corrida, prontas pra copiar.
4. Exportar: Markdown (o que já existe) de **tudo**, de **um livro** ou do **filtro atual**; e copiar tudo do filtro.
5. Rust: `busca.tudo` (obras + marcações pelo trecho e pela nota, sem acento) e o `eco` do `biblioteca.limiar` (uma
   marcação com mais de 30 dias, sorteada por dia) passam a ser do Rust (entram no `app.comandos`).

## Pronto quando

- [ ] e2e: marcar em dois livros, ir em Notas, filtrar por "Citação", copiar a citação (conferir o texto copiado),
      abrir no trecho (o leitor abre na página certa), exportar o Markdown de um livro
- [ ] Ctrl+K "dúvida" acha a nota que tem "dúvida"
- [ ] Prints de Notas e de Citações; `pnpm check`, `pnpm e2e --trace off`, `pnpm check:rust`; `.deb` gerado
- [ ] JORNAL e ROADMAP atualizados; **parar no CP7a** com o roteiro de teste pro Marcelo

## Relatório (o executor preenche)

- **Feito:** · **Portões:** · **Prints / .deb:** · **Ficou de fora:**
