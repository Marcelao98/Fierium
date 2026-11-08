# Cartão m3/01-banco · Banco SQLite, migrações e modelo

**Estado:** a fazer
**Branch:** `agente/m3-01-banco`, saindo de `marco/m3`
**Depende de:** onda 0 · **Destrava:** 08, 09, 10, 11

## Objetivo

O Fierium passa a guardar a biblioteca num SQLite: obra → edição → arquivo, criadores, séries, coleções, relação pessoal, progresso, marcações, sessões, com UUIDv7, relógio lógico (HLC) e registro de mudanças, prontos pra sincronia (D8).

## Leia antes

- `AGENTS.md`
- [docs/MODELO_DE_DADOS.md](../../MODELO_DE_DADOS.md)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (a parte do M3, escrita na onda 0)
- `crates/fierium-dados/` (o esqueleto da onda 0) e `crates/fierium-core/src/erro.rs` (os erros com código)

## Pode mexer

- `crates/fierium-dados/` (módulos `banco`, `migracoes/`, `modelo`, `mudancas`, `hlc`)

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- `crates/fierium-app/`, `crates/fierium-biblioteca/`, `apps/`

## Faça

1. Migrações numeradas em arquivos `.sql` (`0001_inicio.sql`…), aplicadas em ordem dentro de uma transação, com a versão em `PRAGMA user_version`.
2. Tabelas do MODELO_DE_DADOS §1 (arquivo guarda pasta + caminho relativo + impressão + tamanho + aparelho); WAL ligado; chaves estrangeiras ligadas.
3. Toda escrita passa por funções do módulo (nada de SQL solto fora dele) e gera uma linha em `mudancas` (entidade, id, campo, HLC, aparelho).
4. HLC: relógio físico + contador + id do aparelho, com teste de que nunca anda pra trás.
5. Lápide (`apagado_em`) em vez de apagar de verdade.

## Pronto quando

- [ ] Teste: banco vazio → última versão; banco da versão N-1 (criado no teste) → última, sem perder dados
- [ ] Teste: criar obra + edição + arquivo, ler de volta igual; apagar vira lápide; cada escrita gera mudança
- [ ] Teste de desempenho: inserir 2.000 obras com edição e arquivo em < 1 s numa transação
- [ ] `pnpm check:rust` passa (fmt, clippy sem aviso, testes)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
