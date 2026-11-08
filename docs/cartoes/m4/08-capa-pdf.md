# Cartão m4/08-capa-pdf · Capa dos PDFs

**Estado:** a fazer
**Branch:** `agente/m4-08-capa-pdf`, saindo de `marco/m4`
**Depende de:** 01 e o comando de capa do M3 · **Destrava:** —

## Objetivo

Os PDFs ganham capa: a primeira página desenhada pequena, guardada pelo núcleo e mostrada na biblioteca no lugar do selo gerado.

## Leia antes

- `AGENTS.md`
- `packages/leitores/src/motor.ts` (a tomada `MotorDeLeitura`) e `packages/leitores/src/texto/` (o motor de exemplo)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (`edicao.abrir` → `{tipo:'arquivo', url, tamanho}`)
- o protocolo `fierium://capa/<id>` e onde as capas ficam (cartão m3/11)

## Pode mexer

- `packages/leitores/src/pdf/capa.ts`
- um serviço pequeno em `apps/app/src/nucleo/` que gera capas que faltam em segundo plano, quando o app está parado

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- `crates/` (se precisar de um comando `capa.salvar`, peça ao orquestrador: é contrato)

## Faça

1. Desenhar a página 1 em 360 px de largura, WebP, e mandar pro núcleo salvar.
2. Fila em segundo plano, uma por vez, pausando quando a pessoa está lendo.

## Pronto quando

- [ ] Biblioteca com 50 PDFs gerados mostra as capas depois de alguns segundos sem travar a rolagem
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
