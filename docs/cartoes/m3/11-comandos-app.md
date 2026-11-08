# Cartão m3/11-comandos-app · Comandos do app ligando tudo

**Estado:** a fazer
**Branch:** `agente/m3-11-comandos-app`, saindo de `marco/m3`
**Depende de:** 01, 02, 03–06, 08, 09, 10 · **Destrava:** 12, 13

## Objetivo

O `fierium-app` atende de verdade os comandos da biblioteca: pastas, varredura com progresso, obras, coleções, busca e capas — pela mesma porta `chamar` (D21).

## Leia antes

- `AGENTS.md`
- [docs/MODELO_DE_DADOS.md](../../MODELO_DE_DADOS.md)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (a parte do M3, escrita na onda 0)
- `crates/fierium-app/src/comandos.rs` e `protocolo.rs`
- D21 e D22 em DECISOES.md

## Pode mexer

- `crates/fierium-app/src/` (comandos, estado do app com o banco aberto, eventos de progresso, protocolo de capas)
- `crates/fierium-app/capabilities/` só se o diálogo de pastas pedir

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- `crates/fierium-dados/` e `crates/fierium-biblioteca/` (se faltar algo lá, anote no relatório)
- `apps/`

## Faça

1. Banco em `~/.local/share/fierium/fierium.db`, aberto na partida (migra se precisar).
2. `pastas.listar/adicionar/remover` (adicionar abre o diálogo do sistema pelo `tauri-plugin-dialog`); `biblioteca.varrer` em segundo plano, emitindo `biblioteca.progresso` e `biblioteca.mudou`.
3. `obras.listar`, `obra.obter/atualizar`, `biblioteca.limiar`, `colecoes.*`, `busca.tudo` respondendo do banco; `app.comandos` lista todos os que o Rust já atende.
4. Capas: salvas em `~/.cache/fierium/capas/<impressao>.webp` e servidas por `fierium://capa/<id>`.

## Pronto quando

- [ ] Teste de cada comando chamando `chamar` com um banco temporário
- [ ] Varrer a pasta do gerador (cartão 07) pelo comando e ler a biblioteca de volta
- [ ] `pnpm check:rust` passa (fmt, clippy sem aviso, testes)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
