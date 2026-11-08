# Cartão m3/02-varredura · Varredura das pastas

**Estado:** a fazer
**Branch:** `agente/m3-02-varredura`, saindo de `marco/m3`
**Depende de:** onda 0 · **Destrava:** 07 (usa), 11

## Objetivo

Dadas as pastas escolhidas, achar os arquivos de livro (PDF, EPUB, CBZ, CBR) e dizer o que é novo, o que mudou de lugar e o que sumiu, reconhecendo o arquivo pelo conteúdo (renomear ou mover não perde nada).

## Leia antes

- `AGENTS.md`
- [docs/MODELO_DE_DADOS.md](../../MODELO_DE_DADOS.md)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (a parte do M3, escrita na onda 0)
- MODELO_DE_DADOS §2 (identidade pela impressão)
- `crates/fierium-biblioteca/` (esqueleto da onda 0)

## Pode mexer

- `crates/fierium-biblioteca/src/varredura/` e os testes dele

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- `crates/fierium-dados/` (a varredura não grava: devolve as mudanças; quem grava é o comando no cartão 11)
- `apps/`

## Faça

1. Percorrer as pastas (walkdir), ignorando ocultos e atalhos que saem da pasta; extensões em minúsculas.
2. Impressão rápida: blake3 de (primeiros 64 KiB + últimos 64 KiB + tamanho); a impressão completa (arquivo inteiro) fica numa função separada pra desempate em segundo plano.
3. Função pura `comparar(anterior: &[ArquivoConhecido], atual: &[ArquivoAchado]) -> Vec<Mudanca>` com `Novo`, `Movido{de,para}`, `Sumiu`, `Alterado` (mesmo caminho, outra impressão).
4. Progresso por callback (quantos achados / quantos lidos), cancelável.

## Pronto quando

- [ ] Testes com pasta temporária gerada no teste: renomear, mover entre subpastas, apagar, trocar o conteúdo, mesmo livro em duas pastas
- [ ] 2.000 arquivos gerados varridos em < 2 s (só impressão rápida), medido no teste
- [ ] `pnpm check:rust` passa (fmt, clippy sem aviso, testes)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
