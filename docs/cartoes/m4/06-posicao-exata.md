# Cartão m4/06-posicao-exata · Posição exata salva

**Estado:** a fazer
**Branch:** `agente/m4-06-posicao-exata`, saindo de `marco/m4`
**Depende de:** 01, 02 · **Destrava:** —

## Objetivo

Fechar e abrir volta exatamente no mesmo ponto da mesma página, mesmo com outro zoom ou tamanho de janela.

## Leia antes

- `AGENTS.md`
- `packages/leitores/src/motor.ts` (a tomada `MotorDeLeitura`) e `packages/leitores/src/texto/` (o motor de exemplo)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (`edicao.abrir` → `{tipo:'arquivo', url, tamanho}`)

## Pode mexer

- `packages/leitores/src/pdf/` (posição)

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- `packages/contratos/` (o formato da posição é texto livre do motor)

## Faça

1. Posição = página + ponto do topo da tela em coordenadas da página (0..1), independente do zoom.
2. Salvar com atraso curto ao rolar e na hora ao fechar.

## Pronto quando

- [ ] e2e: rolar até o meio da página 37, fechar, mudar o tamanho da janela, abrir: mesma linha no topo
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
