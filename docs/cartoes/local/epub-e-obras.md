# Cartão local/epub-e-obras · EPUB abrindo no app de verdade + obra ≠ arquivo

**Estado:** a fazer
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

- **Causa do EPUB não abrir:** · **Feito:** · **Portões:** · **Ficou de fora:**
