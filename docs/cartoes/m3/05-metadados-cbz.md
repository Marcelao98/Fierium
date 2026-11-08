# Cartão m3/05-metadados-cbz · Metadados de CBZ e CBR

**Estado:** a fazer
**Branch:** `agente/m3-05-metadados-cbz`, saindo de `marco/m3`
**Depende de:** onda 0 · **Destrava:** 08, 11

## Objetivo

Tirar de um arquivo CBZ o título, os criadores, o ano, a série e (quando dá) a capa, sem abrir o arquivo inteiro na memória (D10).

## Leia antes

- `AGENTS.md`
- [docs/MODELO_DE_DADOS.md](../../MODELO_DE_DADOS.md)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (a parte do M3, escrita na onda 0)
- o tipo `Metadados` em `crates/fierium-biblioteca/src/metadados/mod.rs` (onda 0)
- dependências: `zip` + `quick-xml` (onda 0); CBR: a biblioteca de RAR é decisão do orquestrador (licença) — se não estiver na onda 0, faça só CBZ e anote

## Pode mexer

- `crates/fierium-biblioteca/src/metadados/cbz.rs` e os testes dele

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- os outros arquivos de `metadados/` (cada formato é um cartão)
- `crates/fierium-dados/`, `apps/`

## Faça

1. CBZ: as páginas são as imagens em ordem natural ("2" antes de "10"); capa = a primeira.
2. `ComicInfo.xml` quando existir: série, volume, número, título, roteiro/arte, ano.
3. Sem metadados: deixa vazio (o cartão 06 completa pelo nome).
4. Arquivos de teste **gerados no próprio teste** (nunca um livro de verdade no repositório).

## Pronto quando

- [ ] Testes com arquivos gerados: com todos os campos, sem nenhum, quebrado
- [ ] Ler os metadados de um arquivo de 500 MB gerado não passa de 50 MB de memória
- [ ] `pnpm check:rust` passa (fmt, clippy sem aviso, testes)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
