# Cartão m4/02-zoom-pagina-dupla · Zoom e página dupla

**Estado:** a fazer
**Branch:** `agente/m4-02-zoom-pagina-dupla`, saindo de `marco/m4`
**Depende de:** 01 · **Destrava:** —

## Objetivo

Ajustar à largura, página inteira, zoom livre (Ctrl + roda, pinça) e página dupla (com a capa sozinha), lembrando a escolha por obra.

## Leia antes

- `AGENTS.md`
- `packages/leitores/src/motor.ts` (a tomada `MotorDeLeitura`) e `packages/leitores/src/texto/` (o motor de exemplo)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (`edicao.abrir` → `{tipo:'arquivo', url, tamanho}`)

## Pode mexer

- `packages/leitores/src/pdf/` (só os módulos de zoom/layout)
- o painel de aparência do leitor em `apps/app/src/recursos/leitor/` (só os controles de zoom)

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- o resto da casca do leitor

## Faça

1. Zoom que mantém o ponto sob o mouse/dedo parado; re-render nítido depois de parar (não a cada quadro).
2. Página dupla com capa sozinha opcional; a escolha vai pra configuração da obra.

## Pronto quando

- [ ] e2e: zoom in/out mantém a mesma página; página dupla mostra 2 e 3 lado a lado com capa sozinha
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
