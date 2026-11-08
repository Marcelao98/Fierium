# Cartão m3/09-busca · Busca sem acento (FTS5)

**Estado:** a fazer
**Branch:** `agente/m3-09-busca`, saindo de `marco/m3`
**Depende de:** 01 · **Destrava:** 11, 12

## Objetivo

Buscar por título, autor, assunto e texto das notas, sem ligar pra acento, maiúscula ou ordem das palavras, rápido com milhares de obras.

## Leia antes

- `AGENTS.md`
- [docs/MODELO_DE_DADOS.md](../../MODELO_DE_DADOS.md)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (a parte do M3, escrita na onda 0)
- o comando `busca.tudo` e o filtro de `obras.listar` em CONTRATOS.md

## Pode mexer

- `crates/fierium-dados/src/busca/` e uma migração nova numerada pra tabela FTS5

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- as migrações antigas
- `apps/`

## Faça

1. FTS5 com `unicode61 remove_diacritics 2`, alimentada por gatilhos (inserir/atualizar/apagar) das obras, criadores, assuntos e marcações.
2. Prefixo ("mach" acha Machado) e várias palavras em qualquer ordem.
3. Resultado separado em obras, autores, coleções e marcações, como o `busca.tudo` pede.

## Pronto quando

- [ ] "jose de alencar" acha "José de Alencar"; "casmurro dom" acha "Dom Casmurro"; "duvida" acha a nota "dúvida"
- [ ] Busca em 10.000 obras < 20 ms (teste)
- [ ] `pnpm check:rust` passa (fmt, clippy sem aviso, testes)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
