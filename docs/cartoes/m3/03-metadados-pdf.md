# Cartão m3/03-metadados-pdf · Metadados de PDF

**Estado:** a fazer
**Branch:** `agente/m3-03-metadados-pdf`, saindo de `marco/m3`
**Depende de:** onda 0 · **Destrava:** 08, 11

## Objetivo

Tirar de um arquivo PDF o título, os criadores, o ano, a série e (quando dá) a capa, sem abrir o arquivo inteiro na memória (D10).

## Leia antes

- `AGENTS.md`
- [docs/MODELO_DE_DADOS.md](../../MODELO_DE_DADOS.md)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (a parte do M3, escrita na onda 0)
- o tipo `Metadados` em `crates/fierium-biblioteca/src/metadados/mod.rs` (onda 0)
- dependências: `lopdf` (pedida na onda 0)

## Pode mexer

- `crates/fierium-biblioteca/src/metadados/pdf.rs` e os testes dele

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- os outros arquivos de `metadados/` (cada formato é um cartão)
- `crates/fierium-dados/`, `apps/`

## Faça

1. Do dicionário Info e do XMP: título, autor, ano, assunto, idioma; número de páginas.
2. A capa do PDF **não** sai aqui (precisa desenhar a página): fica com o leitor de PDF (M4, cartão m4/08). Devolva `capa: None`.
3. PDF quebrado ou com senha: erro com código (`ARQUIVO_ILEGIVEL`, `ARQUIVO_PROTEGIDO`), nunca pânico.
4. Arquivos de teste **gerados no próprio teste** (nunca um livro de verdade no repositório).

## Pronto quando

- [ ] Testes com arquivos gerados: com todos os campos, sem nenhum, quebrado
- [ ] Ler os metadados de um arquivo de 500 MB gerado não passa de 50 MB de memória
- [ ] `pnpm check:rust` passa (fmt, clippy sem aviso, testes)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
