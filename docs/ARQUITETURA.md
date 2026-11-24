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
  subgraph RUST["crates/ (M2+)"]
    APPR["fierium-app — Tauri: comandos, protocolo de arquivo, log em arquivo"]
    BIB["fierium-biblioteca — pastas, formatos, capas, backup"]
    DADOS["fierium-dados — SQLite, migrações, busca"]
    CORE["fierium-core — domínio e regras puras"]
  end
  MAIN --> REC & CASCA & NUC
  REC --> NUC & COMP & LEI & UI
  CASCA --> NUC & COMP & UI
  NUC --> CLI & DIA
  CLI -- "IPC tipado + arquivo aos pedaços" --> APPR
  APPR --> BIB & DADOS & CORE
  BIB --> CORE
  DADOS --> CORE
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
└─ crates/ (M2+)           fierium-core · fierium-dados · fierium-biblioteca · fierium-app
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
| Rust | `crates/*/tests` | `cargo test` (M2+) |

## 9. Segurança e entrega

Atualização assinada desde o primeiro pacote (D11), chave só no segredo do CI, lançamento por tag. O Rust só expõe
comandos com nome e escopo; permissões do Tauri mínimas. O app nunca altera os arquivos dos livros (D9).
