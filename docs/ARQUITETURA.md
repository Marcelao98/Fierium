# Arquitetura do Fierium

> Como o Fierium é montado e quem pode falar com quem. O porquê do produto: [FIERIUM_PRODUCT_VISION.md](FIERIUM_PRODUCT_VISION.md).
> Decisões numeradas: [DECISOES.md](DECISOES.md). Como acrescentar coisas: [EXPANDIR.md](EXPANDIR.md).
> Estado de cada parte: [ROADMAP.md](ROADMAP.md).

## 1. Visão geral

Um app só (Tauri 2, a partir do M2): uma **casca nativa em Rust** com o **núcleo** (regras, dados, arquivos) e a
**interface web** (React + TypeScript) numa janela do sistema (WebKitGTK no Linux, WebView2 no Windows, WebView no
Android). Não existe servidor no V1: o "back-end" é o núcleo Rust dentro do app.

**Regra de ouro:** regra de negócio só no Rust; a interface mostra e pede. Até o M3, o adaptador em memória imita o
Rust (mesmos comandos, mesmos erros) pra dar pra construir e testar a interface sem ele.

```mermaid
flowchart TB
  subgraph APP["apps/app — a interface"]
    MAIN["main.tsx + montar.ts (raiz da composição)"]
    CASCA["casca/ — barras, busca, inspetor, fundo"]
    REC["recursos/* — uma pasta por funcionalidade"]
    COMP["compartilhado/ — cartões usados por várias"]
    NUC["nucleo/ — serviços, eventos, navegação, config"]
  end
  subgraph PKG["packages/"]
    LEI["leitor-base (tomada, modos, pintor) + leitor-pdf · leitor-epub · leitor-texto — um pacote por formato"]
    UI["ui — design system"]
    CLI["cliente — a porta Cliente + adaptadores (memória; Tauri M2; HTTP futuro)"]
    DIA["diagnostico — log central"]
    CON["contratos — tipos dos comandos"]
  end
  subgraph RUST["crates/ (ver §10)"]
    APPR["fierium-app — Tauri: comandos por área, protocolo de arquivo, log em arquivo"]
    BIB["fierium-biblioteca — SQLite da estante: obras, varredura, progresso, marcações, metadados"]
    CAT["fierium-catalogo — SQLite do catálogo público: busca FTS5, fontes, download"]
    CORE["fierium-core — erros com código, log, Range, pool de conexões"]
  end
  MAIN --> REC & CASCA & NUC
  REC --> NUC & COMP & LEI & UI
  CASCA --> NUC & COMP & UI
  NUC --> CLI & DIA
  CLI -- "IPC tipado + arquivo aos pedaços" --> APPR
  APPR --> BIB & CAT & CORE
  BIB --> CORE
  CAT --> CORE
```

## 2. Pastas

```
fierium/
├─ apps/app/src/
│  ├─ main.tsx             liga tudo: log, cliente (adaptador), montar(), provedor, App
│  ├─ montar.ts            RAIZ DA COMPOSIÇÃO: cria os serviços e cada funcionalidade (o único que conhece todas)
│  ├─ App.tsx              a rota atual + o leitor por cima + casca
│  ├─ nucleo/              servicos.ts · eventos.ts · navegacao.ts · config.ts · contexto.tsx · avisos.ts
│  ├─ casca/               Navegacao (barras), Busca (Ctrl+K), Inspetor (Ctrl+Shift+D), Atmosfera, Avisos
│  ├─ compartilhado/       Obras (cartão, capa, prateleira), Marcacoes (cartão de marcação, cores)
│  ├─ recursos/
│  │  ├─ inicio/           estado.ts · Tela.tsx · Abertura.tsx · inicio.css
│  │  ├─ biblioteca/       estado.ts · Tela.tsx · Mapa.tsx · ceu.ts (o céu, puro) · testes
│  │  ├─ obra/  colecoes/  notas/  estatisticas/  ajustes/
│  │  └─ leitor/           estado.ts · Tela.tsx (a casca) · motores.ts (registro sob demanda) · usePalco/useModo · barra, painéis, menu, Balao.tsx
│  ├─ plataforma/          escolher o adaptador (só o main.tsx usa)
│  ├─ dev/Vitrine.tsx      cada componente sozinho (#/vitrine, só em desenvolvimento)
│  └─ testes/apoio.ts      serviços de teste (cliente em memória, relógio parado, avisos guardados)
├─ packages/
│  ├─ contratos/           os tipos e os comandos (provisório; gerado do Rust a partir do M3 — D6)
│  ├─ cliente/             Cliente + rastrear() + memoria/ (base, obras, colecoes, leitura, marcacoes, estatisticas, config, busca)
│  ├─ leitor-base/         motor.ts (a tomada) · registro.ts · modos/ · pintor/ · comum/ (linhas, destaque)
│  ├─ leitor-pdf/ leitor-epub/ leitor-texto/   um motor por pacote (+ leitor-manga no M6)
│  ├─ ui/                  tokens.css, Icone, Selo, Anel
│  └─ diagnostico/         criarLog, relatorio, textoDoErro
└─ crates/                 fierium-core · fierium-biblioteca · fierium-catalogo · fierium-app (§10)
```

## 3. Quem pode falar com quem (o ESLint barra o resto)

| Peça | Pode usar | Não pode usar |
|---|---|---|
| `contratos`, `diagnostico` | nada do projeto | tudo |
| `cliente` | contratos, diagnostico | React, ui, leitor-* |
| `leitor-base` | contratos (e o DOM) | React, cliente, ui, **qualquer leitor de formato**, pdf.js/epub.js |
| `leitor-pdf`, `leitor-epub`, `leitor-texto` | contratos, **leitor-base** (e o DOM) | React, cliente, ui, **outro leitor** |
| `ui` | contratos, React | cliente, leitor-*, estado |
| `nucleo/`, `casca/`, `compartilhado/` | cliente (só o núcleo), diagnostico, ui, contratos | **recursos**, plataforma |
| `recursos/x/` | nucleo, compartilhado, ui, leitor-*, contratos | **outro recurso**, o cliente direto, plataforma |
| `main.tsx`, `montar.ts`, `App.tsx` | tudo | — |

## 4. Como as peças ficam isoladas

### 4.1 Injeção de dependências
`montar(cliente)` cria `Servicos = { chamar, log, eventos, agora, avisar }` e entrega a cada funcionalidade:
`criarBiblioteca(servicos) → { store, carregar, filtrar, … }`. As telas recebem a sua funcionalidade por props
(`<TelaBiblioteca biblioteca={…} />`) e leem com `useFatia(store, seletor)`. Nos testes:
`servicosDeTeste()` (cliente em memória, relógio parado, avisos guardados) e a store é testada sem tela e sem Rust.

### 4.2 Eventos entre funcionalidades
Uma funcionalidade nunca importa outra. Quando algo muda que interessa às outras, ela emite (tipado em
`nucleo/eventos.ts`): `obra-mudou`, `marcacoes-mudaram`, `sessao-registrada`, `colecoes-mudaram`. Ex.: o leitor fecha
→ `sessao-registrada` + `obra-mudou` → Início, Biblioteca, página da obra e Estatísticas se atualizam sozinhos.

### 4.3 A porta do núcleo (`Cliente`)
Uma interface (`chamar(cmd, args)`), vários adaptadores: memória (agora), Tauri (M2), HTTP (futura versão web).
`rastrear(cliente, log)` envolve qualquer adaptador e registra cada comando (nome, argumentos resumidos, tempo, erro).
O adaptador em memória é dividido por área igual aos crates do Rust; o tipo `Tratadores<NomeComando>` garante que
todo comando do contrato tem tratador (faltou um = não compila).

### 4.4 Os leitores (motores e modos)
Cada formato mora no **seu pacote**; o que é comum mora no `leitor-base`; a casca é uma só.

```mermaid
flowchart LR
  TELA["recursos/leitor (casca: barra, véu, painéis, balão, menu)"] -->|"abrirMotor(fonte): import() sob demanda"| REG["motores.ts (registro)"]
  REG -.-> PDF["leitor-pdf (pdf.js)"]
  REG -.-> EPUB["leitor-epub (epub.js + DOMPurify)"]
  REG -.-> TXT["leitor-texto"]
  PDF & EPUB & TXT --> BASE["leitor-base: tomada · tipos · modos · pintor de temas"]
  TELA -->|"useModo(sessão)"| BASE
```

**A tomada** (`leitor-base/src/motor.ts`):
```
MotorDeLeitura: nome · aceita(fonte) · montar(elemento, { fonte, alvo, aparencia, marcacoes, cores, eventos })
SessaoLeitura:  aplicarAparencia · mostrarMarcacoes · irPara · limparSelecao · desmontar
                + peças comuns OPCIONAIS, declaradas em `capacidades` (paginar, linhas, rolar, destacar, sumario, buscar):
                linhas() · rolarPor(px) · rolagem() · paginar(±1) · paginaAtual() · destacarTrecho(faixa|null)
                · aoInteragir(ouvinte) · sumario() · buscar(texto)   (as duas últimas: só a assinatura, pros próximos passos)
EventosMotor:   posicao(p, fração) · selecao(trecho+âncora+caixa) · marcacaoClicada · menu · toque · erro
```
`linhas()` devolve as linhas de texto visíveis (centro dentro da área visível), de cima pra baixo, com `id` estável
(o mesmo enquanto a linha existe, mesmo rolando), texto e caixa na tela. O PDF lê a camada de texto do pdf.js; o EPUB, o
DOM do capítulo. `destacarTrecho` é uma faixa passageira dentro do conteúdo (rola junto; nunca é marcação). `aoInteragir`
avisa quando a **pessoa** mexe (roda, toque, clique, tecla), nunca quando o código rola.

**Carregamento sob demanda.** O app só importa `leitor-base` (pequeno). `recursos/leitor/motores.ts` registra cada
formato com um `import()` do pacote; o pdf.js, o epub.js e o DOMPurify só descem na hora de abrir um livro daquele
formato (e, com o app parado, 3 s depois de abrir, `aquecerMotores()` os baixa em segundo plano).

**Modos de leitura** (`leitor-base/src/modos/`): `ModoLeitura { id, rotulo, unidade, faixa, precisa, iniciar(sessão, ambiente) }`.
Um modo usa **só** as peças comuns, então vale pra todo formato que as declare. Hoje: Rolagem (à mão), **Automático**
(rola sozinho em px/s; pausa ao tocar/rolar; vira o capítulo no fim) e **Guiado** (destaca a linha atual e desce em
palavras por minuto). Rodam em `requestAnimationFrame` (`criarLaco`, dt limitado, frações de pixel acumuladas em
`criarRolador`), sem render do React por quadro: a casca só guarda a escolha e o estado rodando/pausado (`useModo`).

**Como acrescentar um leitor** (ex.: mangá): 1) `packages/leitor-<nome>` (copie o `package.json` de um existente; só
depende de `contratos` e `leitor-base`); 2) exporte um `MotorDeLeitura` e, se puder, as peças comuns + `capacidades`
(os modos passam a funcionar sozinhos); 3) uma linha em `apps/app/src/recursos/leitor/motores.ts` com `aceita` e
`carregar: () => import(...)`; 4) acrescente o pacote às regras de `eslint.config.js` (um leitor não importa outro) e
ao `package.json` do app. Arquivos de produção ficam abaixo de ~300 linhas: divida em módulos (contexto + funções).

**Como acrescentar um modo:** escreva `modos/<nome>.ts` com um `ModoLeitura` que só chama métodos da `SessaoLeitura`
(declare em `precisa` quais), teste com uma sessão falsa e o relógio manual (`modos.test.ts`), e ponha na lista `MODOS`.
O menu "Modo" da barra o mostra (desabilitado se o leitor do formato não tem as peças).

**EPUB seguro.** Cada capítulo passa pelo DOMPurify antes de ser montado (`leitor-epub/src/sanitizar.ts`): `<script>`,
`on*`, `javascript:`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<base>` e `<meta>` somem; texto, imagens, estilos e
notas de rodapé (`epub:type`) ficam.

A casca do leitor (`recursos/leitor`) é única: barra, véu, temas, painel de marcações e o **balão de marcação**. O
motor só desenha o conteúdo e avisa o que aconteceu. Sem React: cada motor é testável com jsdom.

## 5. Depuração

- **Log central** (`@fierium/diagnostico`): anel dos últimos 500 registros (nível, origem, mensagem, dados). Em
  desenvolvimento também vai pro console; a partir do M2 vai pro arquivo de log do Rust (um por dia), como no KOFstation.
- **Rastro de cada comando** (automático), **cada evento** e **cada erro de tela** (`error`, `unhandledrejection`).
- **Inspetor (Ctrl+Shift+D ou Ajustes → Depuração):** a lista ao vivo, filtro por nível e origem, "copiar relatório".
- **`window.__fierium`** (em desenvolvimento ou com `?depurar`): os serviços e todas as funcionalidades, pra
  investigar pelo console (ex.: `__fierium.recursos.leitor.sessao()`).
- **Erros sempre com código e mensagem em português** (`ErroFierium`), iguais no Rust e na tela.

## 6. Como uma leitura acontece

```mermaid
sequenceDiagram
  actor P as Pessoa
  participant T as Leitor (casca)
  participant E as estado do leitor
  participant M as Motor (texto/PDF/EPUB)
  participant N as Núcleo (Cliente)
  P->>T: abre a obra (portal)
  T->>E: abrir(obra, edição)
  E->>N: obra.obter + edicao.abrir + marcacoes.listar
  N-->>E: fonte (texto, ou endereço do arquivo aos pedaços)
  T->>M: montar(elemento, fonte, posição, aparência, marcações)
  M-->>T: posicao(p, f) / selecao(trecho) / marcacaoClicada
  T->>E: posicaoMudou (grava com atraso) · marcar(âncora, cor)
  E->>N: progresso.salvar · marcacao.criar
  E-->>T: evento marcacoes-mudaram → Notas, obra, Início se atualizam
  P->>T: fecha → E: sessao.registrar → eventos sessao-registrada, obra-mudou
```

## 7. Dados

[MODELO_DE_DADOS.md](MODELO_DE_DADOS.md): obra → edição → arquivo; dados pessoais separados dos derivados;
prontos pra sincronizar (UUIDv7, identidade pelo conteúdo, relógio lógico, lápides, regras de juntar por campo).

## 8. Testes

| Nível | Onde | Ferramenta |
|---|---|---|
| Regras e adaptador | `packages/*/src/**/*.test.ts` | Vitest |
| Stores de cada funcionalidade | `recursos/*/estado.test.ts` (com `servicosDeTeste`) | Vitest |
| Motores e modos de leitura | `packages/leitor-*/**` | Vitest + jsdom |
| Componentes | `*.test.tsx` | Testing Library + jsdom |
| Fluxo | `apps/app/e2e/` (com prints em `e2e/prints/`) | Playwright (Chromium; app Tauri a partir do M2) |
| Rust | `crates/*/src/**/testes*.rs`, `crates/*/tests` | `cargo test`; orçamentos de desempenho: `cargo test --release … --ignored` (§10.5) |

## 9. Segurança e entrega

Atualização assinada desde o primeiro pacote (D11), chave só no segredo do CI, lançamento por tag. O Rust só expõe
comandos com nome e escopo; permissões do Tauri mínimas. O app nunca altera os arquivos dos livros (D9).

## 10. O Rust por dentro

Escala de projeto: **milhares de livros e marcações, catálogo de 75 mil itens, vários agentes mexendo em paralelo, e a
tela nunca trava**. Daí as regras abaixo. Todo arquivo de produção fica abaixo de ~400 linhas; o que cresce vira módulo.

### 10.1 Os crates

| Crate | O que é | Módulos |
|---|---|---|
| `fierium-core` | sem Tauri nem banco | `erro` (`ErroFierium`, um código estável por variante), `log` (arquivo por dia), `intervalo` (Range), `info`, `pool` (pool genérico de conexões) |
| `fierium-biblioteca` | o SQLite da estante (`fierium.db`) | `banco/` · `pastas` · `varredura` · `obras/` · `progresso` · `limiar` · `marcacoes` · `busca` · `capas` · `edicao_meta` · `sugestoes` · `metadados/` |
| `fierium-catalogo` | o catálogo público (`catalogo.db`, descartável) | `banco/` · `rede` · `importar` · `consultas` · `gutenberg` · `baixar` · `capas` |
| `fierium-app` | Tauri: a casca | `main` (`chamar` assíncrono) · `comandos/` (uma área por arquivo) · `protocolo` (`fierium://`) |

`fierium-biblioteca`: `banco/` abre as conexões, roda as migrações (`migracoes/NNN_nome.sql` + uma em Rust, a 003, que
junta dados) e guarda o pool de leitura · `obras/` = `chave` (a mesma obra pelo título + 1º autor), `consultas`
(estante e carga), `json` (o formato do contrato), `escrita`, `juntar`, `relacao` · `metadados/` = `nome` (do nome do
arquivo), `epub`, `pdf`. `fierium-app/comandos/`: `app`, `biblioteca`, `leitura`, `marcacoes`, `busca`, `catalogo`, `capas`.

### 10.2 Conexões: uma de escrita, várias de leitura

O SQLite roda em **WAL**: quem lê não espera quem escreve. Por isso cada banco tem:

- **uma conexão de escrita** (`Mutex<Biblioteca>` / `Mutex<Catalogo>` no `Contexto`), segurada só por milissegundos;
- **um pool de conexões só-leitura** (`fierium_core::pool::Pool`, até 4 guardadas): `ctx.ler()` empresta uma, e se
  chegarem mais pedidos do que conexões livres o excesso abre uma passageira (custa décimos de milissegundo). Escolhi
  pool pequeno em vez de "conexão por pedido" porque reaproveita o cache de páginas e os statements preparados, e em
  vez de pool grande porque o SQLite não ganha nada com dezenas de leitores. A conexão só-leitura **recusa escrever**
  (o SQLite barra), então um comando de leitura que escrevesse sem querer falharia alto nos testes;
- uma **conexão auxiliar** de escrita (`abrir_auxiliar`) só pra `obra.sugestoes`, que mistura rede lenta com gravar
  um cache pequeno (a rede não segura a conexão das outras telas).

O que isso garante: a **varredura** anda nas pastas e lê os arquivos novos numa conexão de leitura
(`planejar_varredura`) e só depois grava numa transação curta (`aplicar_varredura`); o **catálogo** importa 75 mil itens
numa transação da conexão de escrita dele enquanto a busca segue lendo; as **capas do catálogo** só usam leitura. O
comando Tauri `chamar` é `async` e roda cada pedido em `spawn_blocking`: o pedido lento não segura a janela nem os
outros. Trava envenenada (um comando que entrou em pânico) é ignorada, e o pânico vira `ERRO_INTERNO` em vez de
derrubar tudo. Leituras que fazem várias consultas (carga das obras) usam uma transação de leitura, pra ver um instante só.

### 10.3 Migrações

`PRAGMA user_version` = número da migração (a posição na lista `MIGRACOES` de `banco/mod.rs`). Cada migração SQL roda
numa transação, junto com o `user_version`. Antes de migrar um banco que já tem coisa, o app guarda uma cópia
(`fierium.db.vN.bak`). **Nunca editar uma migração publicada**: escreva a próxima (arquivo `NNN_nome.sql` + uma linha
na lista). Biblioteca: 001 base · 002 marcações · 003 obra→edição→arquivo (Rust) · 004 metadados e sugestões · 005
índices. Catálogo: 001 base · 002 índice da ordem "sem texto" · 003 FTS5 com índice de prefixos.

### 10.4 Onde entra coisa nova

- **Comando novo**: escolha a área em `fierium-app/src/comandos/`, ponha o nome em `COMANDOS` e o caso em `atender`
  (a lista de `app.comandos` sai sozinha; o teste `cada_comando_tem_uma_area_so…` confere). Área nova: um arquivo, um
  `mod` e uma entrada em `AREAS` (`comandos/mod.rs`). Leitura usa `ctx.ler()`, escrita usa `ctx.escrever()`.
- **Regra de negócio**: no crate (`fierium-biblioteca` / `-catalogo`), nunca no `fierium-app`. O app só traduz argumentos.
- **Tabela ou índice novo**: migração nova (§10.3) + `EXPLAIN QUERY PLAN` da consulta (§10.5).
- **Formato novo de arquivo**: `metadados/<formato>.rs` e o ramo em `ler_do_arquivo`.

### 10.5 Desempenho (orçamentos com teste)

Os testes geram os dados e rodam só em release (a preparação passa de poucos segundos e em debug o SQLite é 10–30×
mais lento), por isso são `#[ignore]`:

```
cargo test --release -p fierium-biblioteca desempenho -- --ignored --nocapture   # 10 mil obras + 20 mil marcações
cargo test --release -p fierium-catalogo   desempenho -- --ignored --nocapture   # 75 mil itens
```

| Consulta | Orçamento | Medido (release, mediana de 7) |
|---|---|---|
| `obras.listar` (página de 100; todas as ordens e filtros) | < 50 ms | 5–23 ms (a primeira página, de 100) |
| `obras.listar` sem `limite` (os 10 mil de uma vez) | sem orçamento | ≈ 160–200 ms (montar ~10 MB de JSON) |
| `biblioteca.limiar` | < 30 ms | ≈ 21 ms |
| `marcacoes.listar` de uma obra | < 10 ms | < 1 ms |
| `busca.tudo` | < 30 ms | ≈ 21 ms |
| `catalogo.buscar` (75 mil itens; pior caso medido) | < 30 ms | 1–29 ms (o pior: assunto + idioma, ≈ 29) |

Como chegou lá: (1) as consultas leem um **resumo leve** (`Resumo`: id, título, autor, estado, datas, fração) pra
filtrar, ordenar e paginar, e só as obras que vão aparecer são carregadas por inteiro (edições, arquivos, JSON);
(2) `meta` da edição é lido só no que a estante mostra (`MetaLeve`) e as capas são conferidas por uma listagem da
pasta, não um `stat` por capa; (3) `marcacoes.listar`/`busca.tudo` filtram por obra e cor no SQL e cortam cedo; (4) o
catálogo tem índice na ordem "sem texto" e FTS5 com índice de prefixos; (5) a varredura casa arquivos por mapas, não
por laço duplo. Os planos conferidos com `EXPLAIN QUERY PLAN` (os testes de desempenho afirmam "sem SCAN" nas
consultas quentes): `marcacoes` por `marcacoes_obra_data (obra_id, criada_em DESC, id DESC) WHERE apagado_em IS NULL`;
`arquivos` por `arquivos_edicao_lista` (índice que cobre as colunas lidas, já na ordem da tela); `edicoes` por
`edicoes_obra`; catálogo por `itens_por_numero`. **`obras.listar` sem `limite` com a estante inteira é o único caso
acima do orçamento**: a interface deve pedir por páginas (`limite`/`deslocamento`, opcionais e compatíveis).
