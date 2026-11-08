# Cartão m3/10-colecoes · Coleções no banco

**Estado:** a fazer
**Branch:** `agente/m3-10-colecoes`, saindo de `marco/m3`
**Depende de:** 01 · **Destrava:** 11

## Objetivo

Coleções (nome, descrição, atmosfera/matiz, obras) guardadas no banco, com os mesmos comandos que a interface já usa.

## Leia antes

- `AGENTS.md`
- [docs/MODELO_DE_DADOS.md](../../MODELO_DE_DADOS.md)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (a parte do M3, escrita na onda 0)
- os comandos `colecoes.listar`, `colecao.criar`, `colecao.definirObras` em CONTRATOS.md e como o adaptador de exemplo responde (`packages/cliente/src/memoria/`)

## Pode mexer

- `crates/fierium-dados/src/colecoes.rs` e os testes

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- `packages/cliente/`, `apps/`

## Faça

1. Criar, renomear, apagar (lápide), definir obras (conjunto: união/lápide pra sincronia), listar com contagem.
2. Mesmos erros do contrato (`ARGUMENTO_INVALIDO` pra nome vazio/repetido, `NAO_ENCONTRADO`).

## Pronto quando

- [ ] Testes cobrindo cada comando e cada erro, com as mesmas respostas do adaptador de exemplo pros mesmos dados
- [ ] `pnpm check:rust` passa (fmt, clippy sem aviso, testes)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
