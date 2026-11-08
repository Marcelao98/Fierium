# Cartão m3/07-gerador-de-teste · Gerador de biblioteca de teste (2.000 arquivos)

**Estado:** a fazer
**Branch:** `agente/m3-07-gerador-de-teste`, saindo de `marco/m3`
**Depende de:** onda 0 · **Destrava:** 13

## Objetivo

Uma ferramenta que cria uma pasta com milhares de arquivos PDF, EPUB e CBZ **válidos e sintéticos** (texto e imagens gerados), com nomes e metadados variados, pra medir e testar sem nenhum livro de verdade.

## Leia antes

- `AGENTS.md`
- `AGENTS.md` (regra: nunca commitar livro)

## Pode mexer

- `ferramentas/gerar-biblioteca/` (Node, sem dependência nova: monte o PDF, o ZIP e o XML na mão) e uma linha `"gerar:biblioteca"` no `package.json` da raiz

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- `crates/`, `apps/`

## Faça

1. `pnpm gerar:biblioteca -- --pasta /tmp/x --quantidade 2000 --semente 42`: mesma semente, mesma pasta.
2. Mistura: 50% PDF (1 a 300 páginas, alguns de 200 MB com `--grande`), 35% EPUB (com e sem capa/série), 15% CBZ (com e sem ComicInfo); nomes nos formatos do cartão 06; subpastas de autor/série; alguns duplicados e alguns quebrados de propósito.
3. Um `manifesto.json` na pasta dizendo o que cada arquivo deveria ter (pros testes conferirem).

## Pronto quando

- [ ] Gerar 2.000 arquivos em < 30 s; a pasta gerada abre no leitor de PDF/EPUB do sistema (conferir 3 de cada à mão)
- [ ] Nada gerado entra no git (`.gitignore`)
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
