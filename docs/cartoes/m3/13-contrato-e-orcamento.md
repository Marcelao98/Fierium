# Cartão m3/13-contrato-e-orcamento · Teste de contrato e orçamento com 2.000 arquivos

**Estado:** a fazer
**Branch:** `agente/m3-13-contrato-e-orcamento`, saindo de `marco/m3`
**Depende de:** 07, 11, 12 · **Destrava:** CP3

## Objetivo

Garantir que o exemplo em memória e o Rust respondem igual (mesmos formatos, mesmos erros), e que abrir uma biblioteca de 2.000 arquivos cabe no orçamento.

## Leia antes

- `AGENTS.md`
- [docs/CONTRATOS.md](../../CONTRATOS.md)
- [docs/PLANO.md](../../PLANO.md) (os orçamentos de desempenho)

## Pode mexer

- `packages/cliente/src/contrato.test.ts` (novo) e um teste de integração em `crates/fierium-app/tests/`
- `ferramentas/` (script de medição)

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- código de produção (se o teste achar diferença, anote no relatório: vira cartão de correção)

## Faça

1. Uma lista de chamadas com dados fixos rodada contra o exemplo e contra o Rust (via `chamar` num binário de teste), comparando o formato das respostas e os códigos de erro.
2. Medição: varrer a pasta de 2.000 arquivos (cartão 07) do zero e de novo (sem mudança), e abrir a Biblioteca; anote os tempos.

## Pronto quando

- [ ] Relatório com a tabela de diferenças (ou "nenhuma") e os tempos contra o orçamento do PLANO.md
- [ ] `pnpm check`, `pnpm check:rust` e `pnpm e2e` passam

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
