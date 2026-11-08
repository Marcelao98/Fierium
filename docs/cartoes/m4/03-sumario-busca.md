# Cartão m4/03-sumario-busca · Sumário e busca no PDF

**Estado:** a fazer
**Branch:** `agente/m4-03-sumario-busca`, saindo de `marco/m4`
**Depende de:** 01 · **Destrava:** —

## Objetivo

O sumário (outline) do PDF navegável e a busca de texto no livro com os resultados marcados na página.

## Leia antes

- `AGENTS.md`
- `packages/leitores/src/motor.ts` (a tomada `MotorDeLeitura`) e `packages/leitores/src/texto/` (o motor de exemplo)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (`edicao.abrir` → `{tipo:'arquivo', url, tamanho}`)

## Pode mexer

- `packages/leitores/src/pdf/` (sumário e busca)
- um painel lateral do leitor em `apps/app/src/recursos/leitor/` (sumário + busca, comum aos formatos)

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- o motor de texto

## Faça

1. A tomada `SessaoLeitura` ganha `sumario()` e `buscar(texto)` opcionais (avise o orquestrador: mexe na interface do motor — confirme antes no relatório se precisar mudar `motor.ts`).
2. Busca sem acento, resultados com o trecho, ir pro resultado destaca na página.

## Pronto quando

- [ ] e2e com PDF gerado: clicar no sumário vai pra página; buscar acha N ocorrências e navega
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
