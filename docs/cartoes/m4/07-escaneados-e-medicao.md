# Cartão m4/07-escaneados-e-medicao · PDF escaneado (JPEG 2000, JBIG2) e medição no WebKitGTK

**Estado:** a fazer
**Branch:** `agente/m4-07-escaneados-e-medicao`, saindo de `marco/m4`
**Depende de:** 01 · **Destrava:** CP4

## Objetivo

PDF escaneado abre direito (JPEG 2000 e JBIG2 pelos decodificadores do pdf.js) e a gente mede o PDF grande dentro do app de verdade no Linux (pendência do M2).

## Leia antes

- `AGENTS.md`
- `packages/leitores/src/motor.ts` (a tomada `MotorDeLeitura`) e `packages/leitores/src/texto/` (o motor de exemplo)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (`edicao.abrir` → `{tipo:'arquivo', url, tamanho}`)
- a pendência "Medição do PDF grande no WebKitGTK" no M2 do ROADMAP
- `ferramentas/fumaca-linux.sh`

## Pode mexer

- `packages/leitores/src/pdf/` (configurar os decodificadores wasm empacotados)
- `ferramentas/` (script de medição no app empacotado)

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- a casca

## Faça

1. Empacotar os wasm de JPEG 2000/JBIG2 do pdf.js junto (sem CDN) e apontar o motor pra eles.
2. Medir no executável do Linux (tela virtual): tempo até a 1ª página e memória com um PDF gerado de 300 MB escaneado.

## Pronto quando

- [ ] PDF gerado com imagens JPEG 2000 e JBIG2 aparece certo (print)
- [ ] Relatório com os números do WebKitGTK contra o orçamento do PLANO.md
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
