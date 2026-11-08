# Cartão m4/01-motor-pdf · Motor de PDF aos pedaços

**Estado:** a fazer
**Branch:** `agente/m4-01-motor-pdf`, saindo de `marco/m4`
**Depende de:** onda 0 (pdfjs-dist instalado, `fierium://arquivo` servindo PDF) · **Destrava:** 02–07

## Objetivo

Abrir PDF de qualquer tamanho na hora: o pdf.js lê o arquivo aos pedaços pelo protocolo (Range, D10) e só desenha as páginas perto da tela.

## Leia antes

- `AGENTS.md`
- `packages/leitores/src/motor.ts` (a tomada `MotorDeLeitura`) e `packages/leitores/src/texto/` (o motor de exemplo)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (`edicao.abrir` → `{tipo:'arquivo', url, tamanho}`)
- `crates/fierium-app/src/protocolo.rs` (como o Range é servido)

## Pode mexer

- `packages/leitores/src/pdf/` (novo) e o registro do motor em `packages/leitores/src/index.ts`

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- `apps/` (a casca do leitor é igual pra todos os motores)
- `crates/`

## Faça

1. Motor `pdf` que aceita `{tipo:'arquivo', formato:'pdf'}`: `getDocument` com `rangeChunkSize` e `disableAutoFetch`, worker do pdf.js empacotado (sem CDN).
2. Rolagem contínua com páginas virtualizadas (só as visíveis ± 2 em canvas, o resto com o tamanho reservado); camada de texto pra selecionar.
3. Posição no formato `"pagina:fração-da-página"`; `fracao` = página/total.
4. Erros com código (`PDF_ILEGIVEL`, `PDF_PROTEGIDO`) pelo `eventos.erro`.

## Pronto quando

- [ ] Teste com PDF gerado de 500 páginas: primeira página desenhada sem baixar o arquivo inteiro (contar bytes pedidos)
- [ ] Memória estável rolando do começo ao fim (relatório com o número)
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
