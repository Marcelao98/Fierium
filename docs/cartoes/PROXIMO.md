# Próximo agente: por onde continuar o roadmap

> Atualizado em 2026-11-14. Base: `claude/eloquent-fermat-z05qmh` (já contém a trilha "Lendo de verdade" do Codex).
> Leia o `AGENTS.md`. Trabalhe numa branch sua (ex.: `codex/<marco>`), commits em português sem nome de modelo de IA,
> sem PR. Pare em cada ⏸ (checkpoint) e deixe o roteiro pro Marcelo testar.

## Estado em uma linha por marco

| Marco | Estado |
|---|---|
| M0, M1, M2 | feitos; M1/M2 esperando o Marcelo dar o ok (⏸) |
| Trilha "Lendo de verdade" | **pronta**: pastas, varredura, SQLite, progresso, PDF (aos pedaços) e EPUB; `.deb` gera. Falta confirmar no app de verdade: EPUB abrindo e "fechar e reabrir volta no lugar" (PDF e EPUB) |
| M1.5 Identidade | I.1, I.2, I.5 feitos; **I.7 pronto em `agente/m1.5-i7`** (base antiga: juntar com cuidado); I.3, I.4, I.6, I.8 a fazer (as branches `agente/m1.5-i3`/`i6` estão vazias) |
| M3 | versão enxuta feita; faltam os cartões 03, 04, 05 (metadados de verdade dos arquivos), 08, 09, 10, 13 (o 01, 02, 06, 11, 12 foram cobertos pela trilha, de forma mais simples) |
| M4 | motor feito; faltam 02 (página dupla), 03, 04, 05, 07, 08 e conferir o 06 |
| M7 → M8 → M5 → M6 → M9 → M10 | não começados (M9 inclui importar as estatísticas do KOFlibrary) |

## Ordem recomendada (cada item = um commit ou mais; ⏸ = parar)

1. **CP "Lendo"** ⏸ — no app de verdade (Linux, `ferramentas/fumaca-linux.sh` ajuda): pasta sintética com PDF e EPUB,
   abrir, rolar, fechar, reabrir → volta no lugar. Consertar o que falhar. Gerar o `.deb`. Parar: o Marcelo instala e lê.
2. **Importar as estatísticas do KOFlibrary** (pedido do Marcelo) — ler `~/fierium-importar/koflibrary-estatisticas.json`
   (formato: `versao, origem, livros[], diario[], sessoes[], metas[], sequencia`): um comando Rust `importar.koflibrary`
   que grava sessões/diário e casa o progresso pelos livros de mesmo nome+tamanho; um botão em Ajustes; a tela de
   Estatísticas passando a ler o Rust. Cartão novo em `docs/cartoes/m9/importar-koflibrary.md` antes de codar. ⏸
3. **M3, o que falta** — cartões `docs/cartoes/m3/03`, `04`, `05` (título/autor/capa de dentro do arquivo), `08`, `09`,
   `10`, `13`. Os cartões existentes assumem a estrutura planejada (`fierium-dados`); adapte à crate que existe
   (`fierium-biblioteca`) e anote a diferença no relatório. ⏸ CP3
4. **M4, o que falta** — `docs/cartoes/m4/02`–`08`. ⏸ CP4
5. **M1.5, o que falta** — revisar e juntar `agente/m1.5-i7`; cartões `i3`, `i4`, `i6`, `i8`; depois I.9 (prints,
   README, pacote). ⏸ CP1.5
6. M7, M8… — fatiar em cartões quando chegar (veja `docs/ORQUESTRACAO.md`).

## Portões (sempre)

`pnpm check` · `pnpm check:rust` · `pnpm e2e --trace off` (um de cada vez na porta 4180) · ao fim de cada etapa:
entrada no `docs/JORNAL.md` e o `docs/ROADMAP.md` atualizado.
