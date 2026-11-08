# Jornal do Fierium

Uma entrada por sessão de trabalho, **a mais nova em cima**. Modelo:

```markdown
## AAAA-MM-DD · Marcos · título curto

**Pedido:** o que o Marcelo pediu, resumido.
**Feito:** o que mudou (arquivos ou módulos principais).
**Decidido:** decisões novas (número em DECISOES.md).
**Medido / conferido:** testes, números.
**Deu errado / aprendido:** o que quebrou, o que não fazer de novo.
**Onde parou:** estado exato e o próximo passo (e se está esperando o Marcelo).
```

---

## 2026-11-08 · M1.5 · três direções e três selos em print

**Pedido:** continuar de onde parou: as três direções do IDENTIDADE.md em print (Nebulosa, Céu antigo, Aurora) e três
versões do Selo de Fieri; parar pra o Marcelo escolher.
**Feito:** protótipo estático fora do app em `ferramentas/identidade/` (`prototipo.html?d=…&t=…`, `selos.html`,
`selos.js` com os três selos, `prints.mjs` que tira os prints com o Chromium). 10 prints em `docs/imagens/identidade/`
(Início, Biblioteca e leitor de cada direção + a folha dos selos), com a tabela no fim do IDENTIDADE.md. Nada do app
mudou.
**Medido / conferido:** `pnpm check` passa; prints 1440×900, deterministas (céu gerado com semente fixa).
**Deu errado / aprendido:** as fontes dos protótipos vêm do Google Fonts (só pra comparar Cormorant/Cinzel); no app
vão embutidas pelo `@fontsource`, como as outras. O `prints.mjs` acha o Playwright por `createRequire` (o do sistema serve).
**Onde parou:** ⏸ o Marcelo escolhe a direção (A, B, C ou mistura) e o selo. Depois: aplicar no app (tokens, fundo,
selo, Início, capas, transições), checkpoint com prints e pacote Linux, e seguir o M3.

## 2026-11-08 · Pausa no M3 · a identidade de Fieri

**Pedido:** o Marcelo não gostou tanto do front: Fieri é a primordial dos sonhos e da imaginação, a biblioteca de
tudo que já foi imaginado; a pessoa tem que sentir que explora outros mundos e constelações. Manter o modo normal de
navegar por enquanto. Pediu a proposta, onde estamos, e o símbolo; continuar em outra sessão.
**Feito:** proposta em [IDENTIDADE.md](IDENTIDADE.md) (o Selo de Fieri: centelha, lua crescente, órbita aberta) e o
marco M1.5 no roadmap. Nenhum código do M3 escrito (só as versões das bibliotecas conferidas: rusqlite 0.41, uuid 1.29,
blake3 1.8, walkdir 2.5, zip 2.6, quick-xml 0.37, tauri-plugin-dialog 2.8).
**Onde parou:** ⏸ o Marcelo aprova a direção do M1.5. Depois: três direções em print + três selos → ele escolhe →
aplicar → seguir o M3. O repositório agora existe: github.com/Marcelao98/Fierium (main + tags m1 e m2), com o
README novo (o Selo de Fieri desenhado em SVG e prints). **A próxima sessão começa aqui: ler IDENTIDADE.md e fazer as
três direções em print + três selos, e parar pra ele escolher.**

## 2026-11-08 · M2 · Tauri no Linux

**Pedido:** seguir até o M4 sem parar; Linux desde o começo; um commit por marco, com teste.
**Feito:** workspace Rust (`fierium-core`: erros com código, log em arquivo por dia guardando 14 dias, leitura aos
pedaços com Range; `fierium-app`: Tauri 2, porta única `chamar`, protocolo `fierium://arquivo/<id>`, ícone, CSP e
permissões mínimas). Na interface: adaptador Tauri + adaptador combinado (Rust no que já existe, exemplo no resto) e o
log da tela indo pro arquivo do Rust. `.deb` e AppImage. Teste de fumaça do executável (`ferramentas/fumaca-linux.sh`).
CI com o job do núcleo no Linux.
**Decidido:** D19–D23.
**Medido / conferido:** `pnpm check` (39 testes), `pnpm check:rust` (8 testes, clippy sem aviso), fumaça: a interface
carrega no WebKitGTK e fala com o Rust em ~1,2 s; `.deb` 3,6 MB, AppImage 79 MB (leva o WebKitGTK junto).
**Deu errado / aprendido:** o `registrar` do protocolo só é usado no M3 (marcado explicitamente, sem esconder o aviso).
A medição do PDF grande no WebKitGTK ficou pro M4 (é o leitor de PDF que lê pelo protocolo).
**Onde parou:** ⏸ CP2 (o Marcelo instala o pacote). Seguindo direto pro M3 (biblioteca de verdade), como ele pediu.

## 2026-11-08 · M0 e M1 · fundação, protótipo de interface e arquitetura modular

**Pedido:** visão do produto, plano e roadmap de engenharia com checkpoints; arquitetura "de engenharia de software de
verdade" (modular, fácil de isolar e depurar); seguir até o M4 e depois M7 e M8 (lê mais PDF agora); Linux desde o
começo; um commit por marco, com teste.
**Feito:** monorepo (pnpm, TS estrito, ESLint com regras de camadas e de fronteira entre funcionalidades, CI);
docs (visão, plano, roadmap, arquitetura, modelo de dados, contratos, como estender, decisões); `@fierium/contratos`,
`@fierium/cliente` (porta + rastro + adaptador em memória dividido por área), `@fierium/leitores` (MotorDeLeitura +
motor de texto), `@fierium/ui` (temas, fontes embutidas, ícones, selos), `@fierium/diagnostico` (log central); app com
`nucleo/` (serviços injetados, eventos tipados), `casca/` (barras, busca Ctrl+K, inspetor Ctrl+Shift+D, fundo),
`recursos/` (início, biblioteca com grade/lista/mapa e deriva, obra, coleções, leitor com balão de marcação, notas,
estatísticas, ajustes), vitrine.
**Decidido:** D1–D18 (DECISOES.md); ordem nova dos marcos (M4 → M7 → M8 → M5 → M6).
**Medido / conferido:** `pnpm check` verde; 37 testes de unidade/componente; 4 testes de fluxo no Chromium com 13 prints.
**Deu errado / aprendido:** o lint de fronteira pegou a Abertura importando o estado da Biblioteca (corrigido: conta
pelos serviços). O `?novo=1` ficava no endereço e recarregar apagava tudo de novo (corrigido e coberto pelo teste de
fluxo). O balão de marcação saía da tela com o trecho no pé da página (preso na janela). O título do cartão era lido
duas vezes pelo leitor de tela (a capa decorativa ficou `aria-hidden`).
**Onde parou:** ⏸ CP1 (o Marcelo testa com `pnpm dev`). Ele pediu pra seguir direto: próximo é o M2 (Tauri no Linux).
O repositório `Fierium` ainda não existe no GitHub: os commits estão só na sessão até ele criar.
