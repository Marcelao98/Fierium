# Cartão m3/12-front-pastas · Interface: pastas, varredura e biblioteca do Rust

**Estado:** a fazer
**Branch:** `agente/m3-12-front-pastas`, saindo de `marco/m3`
**Depende de:** 11 (ou o contrato da onda 0, com o exemplo) · **Destrava:** 13

## Objetivo

No app de verdade, a biblioteca vem do Rust: a pessoa escolhe as pastas, vê a varredura andando e as capas aparecendo; no `pnpm dev` e nos testes, o exemplo em memória continua.

## Leia antes

- `AGENTS.md`
- [docs/CONTRATOS.md](../../CONTRATOS.md)
- `apps/app/src/recursos/ajustes/` e `apps/app/src/nucleo/servicos.ts`
- `packages/cliente/src/` (o adaptador combinado, D22)

## Pode mexer

- `apps/app/src/recursos/ajustes/` (seção Pastas) e uma faixa de progresso em `apps/app/src/casca/`
- `packages/cliente/src/memoria/` (o exemplo passa a responder `pastas.*` e `biblioteca.varrer` de mentira)
- testes e e2e

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- `crates/`
- `packages/contratos/`

## Faça

1. Ajustes → Pastas: listar, adicionar (diálogo), remover, "Procurar livros agora".
2. Primeira abertura sem pasta: a Abertura oferece "Escolher a pasta dos meus livros" além do exemplo.
3. Faixa de progresso discreta na casca durante a varredura; a biblioteca atualiza sozinha no `biblioteca.mudou`.
4. Capa por `fierium://capa/<id>` quando houver; senão o selo gerado.

## Pronto quando

- [ ] e2e com o exemplo: adicionar pasta, ver o progresso, obras aparecendo
- [ ] Print dos Ajustes → Pastas e da faixa de progresso
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
