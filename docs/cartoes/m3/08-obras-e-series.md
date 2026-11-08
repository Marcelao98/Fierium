# Cartão m3/08-obras-e-series · Reconhecer obra e série; juntar e separar

**Estado:** a fazer
**Branch:** `agente/m3-08-obras-e-series`, saindo de `marco/m3`
**Depende de:** 01, 03–06 · **Destrava:** 11

## Objetivo

Arquivos diferentes do mesmo livro viram edições da mesma obra; volumes viram uma série; a pessoa pode juntar duas obras ou separar uma edição quando o Fierium errar.

## Leia antes

- `AGENTS.md`
- [docs/MODELO_DE_DADOS.md](../../MODELO_DE_DADOS.md)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (a parte do M3, escrita na onda 0)
- `crates/fierium-dados/` (as funções de escrita do cartão 01)

## Pode mexer

- `crates/fierium-biblioteca/src/obras/` (regra) e, em `crates/fierium-dados/`, só funções novas de consulta/escrita que essa regra precisar

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- migrações já existentes (se precisar de coluna nova, migração nova numerada)
- `apps/`

## Faça

1. Chave de obra: título + primeiro criador normalizados (minúsculas, sem acento, sem artigo inicial, sem pontuação); mesma chave = mesma obra, outra edição.
2. Série: pelos metadados (EPUB/ComicInfo) ou pelo nome (cartão 06); volume ordena.
3. Juntar e separar à mão ficam registrados (a varredura seguinte respeita a escolha da pessoa).

## Pronto quando

- [ ] Testes: PDF e EPUB do mesmo livro viram uma obra com duas edições; "O Alienista" e "Alienista, O" juntam; volumes 1–10 numa série em ordem; separar e varrer de novo não junta outra vez
- [ ] `pnpm check:rust` passa (fmt, clippy sem aviso, testes)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
