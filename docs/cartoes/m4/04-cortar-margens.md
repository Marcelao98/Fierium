# Cartão m4/04-cortar-margens · Cortar margens

**Estado:** a fazer
**Branch:** `agente/m4-04-cortar-margens`, saindo de `marco/m4`
**Depende de:** 01, 02 · **Destrava:** —

## Objetivo

Esconder as margens brancas (automático pela página ou manual), muito útil em PDF escaneado e em tela pequena.

## Leia antes

- `AGENTS.md`
- `packages/leitores/src/motor.ts` (a tomada `MotorDeLeitura`) e `packages/leitores/src/texto/` (o motor de exemplo)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (`edicao.abrir` → `{tipo:'arquivo', url, tamanho}`)

## Pode mexer

- `packages/leitores/src/pdf/` (corte)
- o controle no painel de aparência do leitor

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- o resto da casca

## Faça

1. Automático: detectar a caixa de conteúdo pelas páginas amostradas (pares e ímpares separados).
2. Manual: arrastar as bordas numa página e aplicar a todas; guardado por obra.

## Pronto quando

- [ ] Print antes/depois com um PDF gerado com margem grande
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
