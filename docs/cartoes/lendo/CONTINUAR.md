# Cartão lendo/CONTINUAR · Terminar a trilha "Lendo de verdade" (passagem pro Codex)

**Estado:** em revisão
**Branch:** `codex/lendo-de-verdade`, saindo de `claude/eloquent-fermat-z05qmh`
**Objetivo:** o Marcelo instala o Fierium no Linux HOJE, aponta a pasta de livros dele e lê PDF e EPUB, voltando
onde parou.

## Onde parou (2026-11-08)

Já está junto na `claude/eloquent-fermat-z05qmh`, e `pnpm check` + `pnpm check:rust` passam:
- **Rust** (`crates/fierium-biblioteca`, ligada em `crates/fierium-app/src/comandos.rs` e `main.rs`): SQLite em
  `~/.local/share/fierium/fierium.db`, pastas, varredura (PDF/EPUB, blake3), obra pelo nome do arquivo, `obras.listar`,
  `obra.obter/atualizar`, `biblioteca.limiar`, `edicao.abrir` → `fierium://localhost/arquivo/<id>`, `progresso.salvar`.
  `app.comandos` lista os 13 comandos que o Rust atende; o resto (marcações, coleções, estatísticas, config) continua
  no exemplo em memória (adaptador combinado, D22).
- **Tela**: Ajustes → "Pastas de livros" (digitar/colar o caminho, adicionar, remover, "Procurar livros agora");
  Abertura no Tauri oferece "Escolher a pasta dos meus livros"; evento `biblioteca-mudou` recarrega Início e Biblioteca.
- **Leitores** (`packages/leitores/src/pdf/` e `src/epub/`, registrados em `MOTORES`): PDF aos pedaços (Range),
  páginas sob demanda, zoom, posição `pagina:fracao`; EPUB com epub.js, um capítulo por vez, posição = CFI.
  Páginas de desenvolvimento `?dev=pdf&url=…` e `?dev=epub&url=…` (main.tsx) usadas pelos e2e.
- CSP do Tauri já permite `fierium:` no connect-src e iframe `blob:` pro epub.js.

**Ainda NÃO conferido:** o app de verdade (Tauri, janela) abrindo um PDF/EPUB real do começo ao fim; e o `pnpm e2e`
completo depois de juntar tudo (cada parte passou sozinha).

## Faça, nesta ordem

1. `pnpm install`, `pnpm check`, `pnpm check:rust`, `pnpm e2e --trace off` (sem outro servidor na porta 4180). Se
   algo falhar, conserte o mínimo.
2. **Teste ponta a ponta no app de verdade** (Linux, com tela virtual se precisar: veja `ferramentas/fumaca-linux.sh`):
   gere uma pasta com 2 PDFs e 1 EPUB **sintéticos** (nunca livro de verdade no repositório), rode o app
   (`pnpm tauri dev` ou o executável), adicione a pasta nos Ajustes, abra o PDF, role, feche, reabra (tem que voltar
   na mesma página), e o mesmo no EPUB. Conserte o que quebrar. Pontos de risco conhecidos:
   - o leitor (`apps/app/src/recursos/leitor/Tela.tsx`) usa `edicao.abrir` e `progresso.salvar` com os ids que vêm do
     Rust: confira que vai tudo pro Rust (adaptador combinado em `packages/cliente/`), e não pro exemplo;
   - marcações/sessões do leitor ainda vão pro exemplo em memória: não pode dar erro na tela por isso (se der, faça o
     leitor ignorar com log, sem esconder erro de verdade);
   - o pdf.js precisa do worker e do Range pelo protocolo `fierium://` no WebKitGTK; o epub.js baixa o arquivo inteiro
     por `fetch` (ok por enquanto).
3. **Pacote Linux**: `pnpm build && pnpm tauri build` (gera `.deb` e AppImage em `target/release/bundle/`).
4. **Docs**: entrada no `docs/JORNAL.md` (modelo no topo) e marque no `docs/ROADMAP.md` o que foi feito; README com
   como instalar o `.deb` se mudou.
5. Commits em português, **sem nome de modelo de IA**; envie a branch `codex/lendo-de-verdade` (sem PR).

## Pronto quando

- [ ] Os quatro portões passam
- [ ] No app de verdade: pasta adicionada, PDF e EPUB abrem, fechar/reabrir volta no lugar (prints)
- [ ] `.deb` gerado; o caminho dele está no relatório
- [ ] JORNAL e ROADMAP atualizados

## Depois (não agora)

Importar as estatísticas do KOFlibrary: o Marcelo vai gerar `~/fierium-importar/koflibrary-estatisticas.json` com o
Claude local (formato combinado na conversa: livros, diario, sessoes, metas, sequencia). Vira um cartão próprio.

## Relatório (o executor preenche)

- **Feito:** análise do estado inicial; `pnpm install`; build web; revisão dos testes de PDF/EPUB; testes Rust isolados;
  atualização deste relatório, do JORNAL e do ROADMAP. Nenhuma correção de código foi necessária nos portões que
  puderam ser executados.
- **Portões:** `pnpm check` ✅; `pnpm e2e --trace off` ✅ (9/9); `pnpm build` ✅; `cargo fmt --all --check` ✅;
  `cargo clippy -p fierium-core -p fierium-biblioteca --all-targets --offline -- -D warnings` ✅;
  `cargo test -p fierium-core -p fierium-biblioteca --offline` ✅ (10 testes). `pnpm check:rust` ⚠️ e o build Tauri
  ⚠️ não completaram: falta `gdk-3.0` (GTK 3) no Fedora. A instalação do conjunto GTK/WebKit/Xvfb não foi possível
  porque o `sudo` desta sessão exige senha. O build Tauri iniciado da raiz também selecionou a configuração da cópia
  local não rastreada `Fierium/`; executado a partir de `crates/fierium-app`, chegou à compilação e parou pela falta
  de GTK.
- **Prints / caminho do .deb:** prints do e2e em `apps/app/e2e/prints/` (interface web); `.deb` não gerado: a
  compilação Tauri depende das bibliotecas GTK ausentes. O passo de leitura no app Tauri real e a retomada do progresso
  no WebKitGTK continuam sem conferência.
- **O que ficou de fora:** teste no app real com pasta sintética de 2 PDFs e 1 EPUB; geração do `.deb` e AppImage.
  Dependem da instalação do GTK 3, WebKitGTK 4.1, bibliotecas de desenvolvimento relacionadas e Xvfb no sistema.
