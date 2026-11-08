# Cartão <marco>/<passo> · <título curto>

> Modelo de cartão ([ORQUESTRACAO.md](../ORQUESTRACAO.md)). Copie, preencha, apague as dicas entre parênteses.

**Estado:** a fazer · em execução (por quem) · em revisão · devolvido · junto
**Branch:** `agente/<marco>-<passo>`, saindo de `<branch do marco>`
**Depende de:** (cartões que precisam estar juntos antes) · **Destrava:** (cartões que esperam este)

## Objetivo

(Uma ou duas frases: o que muda pra quem usa.)

## Leia antes

- `AGENTS.md`
- (só os arquivos e trechos de doc que o executor precisa; com linha, se der)

## Pode mexer

- (pastas/arquivos)

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- (o que mais for de outra raia)

## Faça

1. (passos concretos)

## Pronto quando

- [ ] (conferível sem conversa: comando, teste, print)
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela; + `pnpm check:rust` se mexeu no Rust)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat` da branch)
- **Portões:** (saída resumida)
- **Prints:** (caminhos)
- **Dúvidas / o que ficou de fora:**
