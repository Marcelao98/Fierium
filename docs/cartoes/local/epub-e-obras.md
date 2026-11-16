# Cartão local/epub-e-obras · EPUB abrindo no app de verdade + obra ≠ arquivo

**Estado:** em revisão
**Quem:** o Claude Code local do Marcelo (Fedora), que tem o app de verdade e os livros dele pra testar
**Branch:** `local/epub-e-obras`, saindo de `claude/eloquent-fermat-z05qmh`
**Atenção:** outro executor está mexendo em `packages/leitores/src/epub/`, `src/pdf/` e `apps/app/src/recursos/leitor/`
(marcações + menu do botão direito). Aqui, mexa no motor de EPUB **só o mínimo** pra ele renderizar; o orquestrador
junta as duas branches.

## Parte 1 — o EPUB aparece na biblioteca mas não abre (no app; no navegador o e2e passa)

1. Reproduza: `pnpm install && pnpm tauri dev`, adicione a pasta com o EPUB, abra. Com o app em modo dev, botão
   direito → Inspecionar abre o inspetor do WebKit: veja o console (erros de CSP aparecem lá). Veja também o log em
   `~/.local/share/fierium/logs/`.
2. Suspeita principal: o epub.js monta o capítulo num iframe e usa endereços `blob:` pras folhas de estilo, imagens e
   fontes do livro; a CSP em `crates/fierium-app/tauri.conf.json` não tem `blob:` em `style-src` nem em `font-src`
   (e talvez precise de `fierium:`/`http://fierium.localhost` também, e `data:` em `style-src`). Abra só o necessário,
   nunca `*`, e nunca `'unsafe-eval'`.
3. Outras causas possíveis, se a CSP não resolver: o `fetch` do arquivo inteiro pelo protocolo `fierium://` (ver como o
   PDF resolveu o transporte e o CORS em `crates/fierium-app/src/protocolo.rs`); o iframe do epub.js sem
   `allow-same-origin`/`allow-scripts` no WebKitGTK; o `book.ready` pendurado (o motor já tem um tempo limite? se não,
   ponha um e mostre o erro `EPUB_ILEGIVEL` com mensagem em português, nunca a tela parada).
4. Teste com o EPUB de verdade do Marcelo e com um EPUB sintético (o e2e `apps/app/e2e/epub.spec.ts` gera um). O
   arquivo de livro **nunca** entra no git.
5. Vale pra todo formato: confirme no app de verdade que PDF e EPUB abrem, rolam/mudam de capítulo, aplicam o tema da
   página e voltam no lugar ao reabrir.

## Parte 2 — uma obra é diferente do arquivo (MODELO_DE_DADOS §1–2, cartão m3/08)

Hoje `crates/fierium-biblioteca` cria **uma obra por arquivo**. O combinado é: a **obra** é o livro (*Guards! Guards!*);
cada **edição** é uma forma dele (o PDF, o EPUB, outra tradução); cada **arquivo** é a cópia no disco.

1. Migração nova numerada (v3, ou a próxima livre): arquivos do mesmo livro viram **edições da mesma obra**. Chave:
   título + primeiro autor normalizados (minúsculas, sem acento, sem artigo inicial, sem pontuação). O mesmo arquivo
   (mesma impressão blake3) em duas pastas = uma edição com dois arquivos, não duas edições. O progresso e as
   marcações continuam presos à edição certa (nada se perde na migração: teste com um banco da versão anterior).
2. Respostas no formato do contrato (`Obra.edicoes[]`, cada uma com `formato`, `arquivos[]`, `progresso`): a
   Biblioteca e o Início mostram **uma** capa por obra; a tela da obra lista as edições; "Continuar"/"Ler" abre a
   edição lida por último (ou a preferida: EPUB antes de PDF quando nunca abriu).
3. Juntar e separar à mão (comandos `obra.juntar {ids}` e `edicao.separar {edicaoId}`, no contrato e no exemplo em
   memória), e a varredura seguinte respeita a escolha da pessoa.
4. Testes Rust: PDF e EPUB do mesmo livro viram uma obra com duas edições; "O Alienista" e "Alienista, O" juntam;
   separar e varrer de novo não junta outra vez; migração sem perder progresso.

## Portões e entrega

`pnpm check`, `pnpm check:rust`, `pnpm e2e --trace off`. Commits em português, **sem nome de modelo de IA**. Entrada
no `docs/JORNAL.md`, ROADMAP atualizado (M3: cartão 08 feito). Envie com `git push -u origin local/epub-e-obras`.
Sem PR. Gere o executável (`pnpm build && cargo build --release -p fierium-app --features tauri/custom-protocol`) e
instale com `sh ferramentas/instalar-linux.sh` pra o Marcelo testar.

## Relatório (preencha)

- **Quem / quando:** Claude Code local do Marcelo (Fedora 44, WebKitGTK 2.54), 2026-11-16.
- **Causa do EPUB não abrir:** eram três coisas, nenhuma era a CSP (o `blob:` do commit `91c1231` já bastava; rodei o
  executável de release, com a CSP de verdade, e não houve nenhuma violação):
  1. **O EPUB nem entrava na biblioteca.** A varredura só rodava ao adicionar a pasta ou no botão dos Ajustes. O
     `shelley-frankenstein.epub` foi posto na pasta depois da última varredura (dia 9) e por isso não existia no banco.
     Agora o app procura livros novos toda vez que abre (e o comando roda fora da linha da janela).
  2. **Dentro do capítulo nada respondia.** O epub.js monta o capítulo num iframe `sandbox` sem `allow-scripts`, e o
     WebKit não roda NENHUM ouvinte de evento num iframe assim, nem os do próprio app ("Blocked script execution in
     'about:srcdoc'" no console). Resultado no app (no Chromium do e2e funciona): não dava pra selecionar/marcar, nem
     botão direito, nem teclado, nem o clique que esconde a barra. Liguei `allowScriptedContent` e, em troca, o motor
     arranca os `<script>`, os atributos `on*` e os `javascript:` do livro antes de montar (e a CSP continua barrando).
  3. **A coluna do texto ficava colada na esquerda:** o epub.js regrava `margin`/`padding` do `<body>`; a regra agora
     vai com `!important`.
  Também: tempo limite de 30 s no abrir (vira `EPUB_ILEGIVEL`, nunca tela parada) e a abertura não trava mais em
  "0 obras" quando se escolhe o exemplo com a biblioteca vazia.
- **Feito (Parte 1):** conferido no executável de release (`--features tauri/custom-protocol`), dirigido por um roteiro
  dentro da janela de verdade, com a pasta do Marcelo (13 PDFs + 1 EPUB): os 14 abrem; no EPUB e em 3 PDFs (334, 83 e
  775 páginas): mudar de capítulo/página, tema da página (Noite/Sépia), marcar com nota, fechar e reabrir no mesmo
  lugar com a marcação. Repetido na sessão gráfica real (Wayland), não só na tela virtual.
- **Feito (Parte 2):** `crates/fierium-biblioteca/src/obras.rs`. Migração **v3** (obra → edições → arquivos; o id da
  edição antiga é o id do arquivo, então progresso e marcações continuam valendo; cópia `fierium.db.v2.bak` antes).
  Chave = título + primeiro autor normalizados (sem acento, artigo inicial ou final, pontuação). Mesmo conteúdo em
  duas pastas = uma edição com dois arquivos. `obra.juntar {ids}` e `edicao.separar {edicaoId}` no contrato, no Rust
  e no exemplo em memória; a varredura só decide a obra de arquivo novo, então respeita as duas escolhas. `edicoes[0]`
  é a que "Continuar/Ler" abre (lida por último; nunca aberta, EPUB antes de PDF). Página da obra: lista as edições
  (com o quanto foi lido de cada uma), "Abrir" abre AQUELA edição, "Separar" e "Juntar com outra obra…". O leitor só
  mostra as marcações da edição aberta. Conferido no app de verdade com PDF + EPUB do mesmo nome e com uma cópia do
  banco do Marcelo (13 obras, 4 com progresso: tudo igual depois da migração, "Continuar" voltou na página 113).
- **Portões:** `pnpm check` ✓ (93 testes) · `pnpm check:rust` ✓ (fmt, clippy `-D warnings`, 25 testes; 7 novos de
  obras, incluindo a migração de um banco v2) · `pnpm e2e --trace off` ✓ (20/20; novo `obras.spec.ts`).
- **Fora do cartão, mas mexi (mínimo):** `packages/leitores/src/epub/` (3 pontos acima; atenção ao juntar com a
  branch das marcações), `apps/app/src/recursos/leitor/estado.ts` (filtro das marcações pela edição, 2 linhas).
- **Ficou de fora / dúvidas:**
  - O título e o autor ainda vêm só do **nome do arquivo** (cartões m3/03–06 não feitos). Então `Frankenstein.pdf` e
    `shelley-frankenstein.epub` NÃO juntam sozinhos (dá pra juntar à mão), e
    `Discworld.08.Guards!Guards!.198 - Pratchett, Terry.pdf` vira título "Pratchett, Terry". Ler o título de dentro
    do EPUB/PDF resolveria os dois.
  - Série e volume (resto do m3/08), editar título/autor da obra, e coleções com obras reais (ainda no exemplo).
  - Decisão de produto pra confirmar: ao separar, a obra nova pega o nome do arquivo da edição.
