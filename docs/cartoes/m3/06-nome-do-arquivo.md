# Cartão m3/06-nome-do-arquivo · Título, autor e volume pelo nome do arquivo

**Estado:** a fazer
**Branch:** `agente/m3-06-nome-do-arquivo`, saindo de `marco/m3`
**Depende de:** onda 0 · **Destrava:** 08

## Objetivo

Quando o arquivo não diz nada (ou diz errado), deduzir pelo nome: "Machado de Assis - Dom Casmurro (1899).pdf", "Berserk v02.cbz", "[Autor] Título.epub".

## Leia antes

- `AGENTS.md`
- o tipo `Metadados` em `crates/fierium-biblioteca/src/metadados/mod.rs`

## Pode mexer

- `crates/fierium-biblioteca/src/metadados/nome.rs` e os testes dele

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- os outros formatos de `metadados/`

## Faça

1. Função pura `pelo_nome(nome: &str) -> Metadados` cobrindo: "Autor - Título", "Título - Autor" (decide pelo que parece nome de pessoa), ano entre parênteses, "vol./v/volume/tomo/#" + número, colchetes, sublinhados e pontos como espaço.
2. Função `completar(do_arquivo, do_nome)`: o do arquivo vence, o nome só preenche o que falta; título que é claramente lixo ("Untitled", "Microsoft Word - …", só números) é trocado pelo do nome.

## Pronto quando

- [ ] Tabela de pelo menos 40 nomes reais de formatos comuns (inventados, sem livro) com o resultado esperado, todos passando
- [ ] `pnpm check:rust` passa (fmt, clippy sem aviso, testes)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
