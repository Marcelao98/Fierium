# Plano de engenharia do Fierium

> Como o projeto é tocado: escopo, processo, critérios de pronto, qualidade, testes, versões, entregas e riscos.
> O **o quê** e **quando** de cada marco está no [ROADMAP.md](ROADMAP.md). O **porquê** das escolhas, em
> [DECISOES.md](DECISOES.md). A arquitetura, em [ARQUITETURA.md](ARQUITETURA.md).

## 1. Objetivo e escopo

**Produto:** biblioteca pessoal com leitores integrados, local e offline, que **substitui o KOFlibrary** (D3).

**Escopo da versão 1.0 (Linux):**

| Entra | Não entra (fica pra depois) |
|---|---|
| Biblioteca das tuas pastas: obras, edições, arquivos, séries, coleções, busca, filtros | Sincronia entre aparelhos |
| Leitor de **PDF**, **EPUB** e **mangá/HQ** (`.cbz`, `.cbr`) | Audiolivro, webtoon, catálogos online |
| Marcações dinâmicas, notas, marcadores, ligações, exportar Markdown | Contas, login, nuvem, versão web |
| Estatísticas e metas | Mapa (Atlas) completo, deriva, ambientes sonoros |
| Backup, exportar/importar, **importar o KOFlibrary** | iOS |
| Pacote Linux com atualização assinada | |

Depois da 1.0: Windows (1.1), Android (1.2), sincronia PC ↔ celular (1.3). **O KOFlibrary se aposenta depois da
1.3** (paridade: tudo o que ele faz, o Fierium faz).

**Interface:** nomes simples por enquanto: Início, Biblioteca, Coleções, Notas, Estatísticas, Ajustes, Buscar (D15).

## 2. Processo: marco → checkpoint

1. Cada marco tem **objetivo, escopo, entregáveis, critérios de aceite e riscos** (no ROADMAP).
2. Eu trabalho numa branch do marco (`marco/mN-nome`), em commits pequenos em português.
3. No fim do marco, os **portões de qualidade** (§4) têm que estar verdes.
4. **Checkpoint:** eu paro e entrego:
   - o que foi feito e o que ficou de fora (e por quê);
   - o comando pra você rodar no teu Linux e o roteiro do que conferir;
   - prints (computador e celular quando tiver tela), números quando for desempenho;
   - os resultados dos testes.
5. **Você testa e responde:** "segue" (aprovado), ou a lista do que mudar. Correções viram commits "Correção: …" no
   mesmo marco, e o checkpoint se repete.
6. Aprovado: a branch entra na `main`, ganha uma tag (`m1`, `m2`…), e o ROADMAP, o JORNAL e o README são atualizados.
7. Você pode aprovar vários marcos de uma vez ("segue até o M5"): eu paro só no último, mas entrego o relatório de
   cada um.

### Definição de pronto (vale pra todo marco)

- [ ] Todos os critérios de aceite do marco conferidos (por teste automático quando der; senão, roteiro manual)
- [ ] `pnpm check` verde; `pnpm check:rust` verde (a partir do M2); `pnpm e2e` verde se mexeu em tela
- [ ] Testes novos cobrindo o que foi feito (regra crítica de dados sempre com teste de unidade)
- [ ] Sem erro escondido: todo erro com código e mensagem em português; `catch` vazio só com o porquê
- [ ] Documentação atualizada: ROADMAP (checklist), JORNAL (entrada da sessão), DECISOES (se decidiu algo),
      CONTRATOS (se mudou comando), README (se mudou como rodar)
- [ ] Nada de livro, chave, senha ou binário grande no git

## 3. Git e versões

| Item | Regra |
|---|---|
| Branches | `main` sempre funcionando; um marco = uma branch `marco/mN-nome`; correção urgente = `correcao/...` |
| Commits | em português, pequenos, sem nome de modelo de IA |
| Entrada na main | depois do checkpoint aprovado (sem PR, a não ser que você peça) |
| Tags | `mN` a cada marco aprovado; `v0.x.y` nas versões de teste; `v1.0.0` na primeira versão completa |
| Versão do app | SemVer: `0.x` até a 1.0 (o formato dos dados ainda pode mudar, sempre com migração) |
| Versão do contrato | número no `@fierium/contratos` (sobe quando um comando muda de forma incompatível) |
| Versão do banco | migrações numeradas; cada uma testada com um banco da versão anterior |
| Versão do backup | número dentro do arquivo; o app lê todas as versões anteriores |
| Lançamento | só por tag e pelo CI; push na main **nunca** publica nada sozinho (lição do KOFlibrary) |

## 4. Portões de qualidade (CI)

| Portão | Ferramenta | Quando |
|---|---|---|
| Formato | Prettier, `cargo fmt` | todo push |
| Lint + regra de camadas | ESLint, `cargo clippy -D warnings` | todo push |
| Tipos | `tsc` estrito | todo push |
| Unidade (TS) | Vitest | todo push |
| Unidade (Rust) | `cargo test` | todo push (M2+) |
| Contrato | o adaptador de exemplo e o Rust respondem igual aos mesmos pedidos | todo push (M3+) |
| Fluxo (e2e) | Playwright no Chromium (front) e no app Tauri (M2+) | todo push, Linux |
| Desempenho | orçamentos medidos em teste (§5.3) | por marco que mexe em leitura ou biblioteca |
| Sistemas | Linux sempre; Windows a partir do M11; Android a partir do M12 | — |

## 5. Estratégia de testes

### 5.1 Pirâmide

| Nível | O quê | Exemplos |
|---|---|---|
| Unidade (muitos) | regras puras: busca, reconhecer obra/série, juntar dados, estatísticas, migrações, âncoras de marcação | Rust `#[test]`, Vitest |
| Contrato | cada comando: mesmos argumentos → mesma resposta e mesmos códigos de erro, no exemplo e no Rust | fixtures JSON compartilhadas |
| Integração | Rust com SQLite e arquivos de verdade numa pasta temporária | varrer 2.000 arquivos gerados; mover/renomear |
| Fluxo (poucos) | o caminho da pessoa ponta a ponta | abrir → ler → marcar → ver nas Notas → recarregar → continua lá |

### 5.2 Arquivos de teste

**Gerados pelos próprios testes** (PDF, EPUB, CBZ, CBR, PDF escaneado), nunca livro de verdade no repositório. Os
geradores ficam em `ferramentas/` com o que cada um precisa documentado (lição do KOFlibrary: teste que depende de
coisa não documentada quebra).

### 5.3 Orçamentos de desempenho (conferidos por teste)

| Medida | Alvo |
|---|---|
| Abrir o app até o Início, com 10 mil obras | < 1,5 s |
| Continuar a leitura a partir do Início | < 0,5 s até aparecer o texto/página |
| Virar página (PDF, EPUB, mangá) | < 100 ms |
| Buscar em 10 mil obras e nas notas | < 100 ms |
| Importar 2.000 arquivos | os primeiros aparecem em < 2 s; o resto em segundo plano |
| Memória lendo um PDF de 500 MB | limitada, não cresce com o tamanho do arquivo |

## 6. Ambientes

| Ambiente | Pra quê | Como |
|---|---|---|
| `pnpm dev` | desenvolver tela rápido, sem Rust | navegador + biblioteca de exemplo |
| `pnpm tauri dev` (M2+) | o app de verdade com o Rust | Linux |
| CI | conferir tudo a cada push | GitHub Actions (Linux, Windows) |
| Pacotes de teste | você testar no checkpoint | AppImage/executável anexado a uma versão de teste, ou o comando pra compilar |

## 7. Segurança

- Atualização **assinada** (Tauri updater); chave privada só no segredo do CI; chave pública dentro do app.
- APK assinado com chave fora do repositório (lição do KOFlibrary: a chave estava no repositório).
- O Rust só expõe comandos com nome e escopo; permissões do Tauri (capabilities) mínimas; sem shell, sem "ler
  qualquer caminho".
- O app **nunca altera** os arquivos dos livros.
- Sem telemetria. Relatório de erro só se você mandar.
- Futura sincronia: pareamento com segredo longo, limite de tentativas, só ligada quando a pessoa pede.

## 8. Riscos

| # | Risco | Chance | Impacto | O que fazer |
|---|---|---|---|---|
| R1 | No Linux o Tauri usa **WebKitGTK**, mais fraco que o Chromium: o pdf.js ou as animações podem pesar | Média | Alto | O M2 mede antes de investir. Plano B: o Rust desenha as páginas do PDF (PDFium) e a tela só mostra a imagem |
| R2 | Tauri no Android ainda é mais novo que no computador | Média | Médio | APK de teste já no M2; a lógica fica no Rust, a tela é a mesma |
| R3 | `.cbr` (RAR): o descompactador oficial tem licença restrita | Média | Médio | Usar uma biblioteca de licença compatível (avaliada no M6); se não der, o RAR fica só leitura com aviso |
| R4 | foliate-js não tem pacote no npm (vem do GitHub) | Baixa | Baixo | Copiar numa versão fixa em `vendor/`, com licença e número da versão, conferido por hash |
| R5 | Arquivos do KOFlibrary com identidade `nome|tamanho` | Alta | Médio | O importador casa pelo nome e tamanho e depois grava a identidade pelo conteúdo |
| R6 | Escopo crescer no meio (ideias da visão) | Alta | Médio | Ideia nova vai pro "Depois" do ROADMAP; só entra num marco com o teu ok |
| R7 | Licença do Fierium ainda indefinida (D14) | — | Médio | Decidir antes do M4 (afeta quais bibliotecas podem entrar) |

## 9. Documentação mantida

| Arquivo | Atualizado quando |
|---|---|
| `README.md` | muda como rodar ou o que já existe |
| `docs/ROADMAP.md` | a cada tarefa feita (checklist) e a cada checkpoint |
| `docs/JORNAL.md` | toda sessão de trabalho (uma entrada: pedido, feito, decidido, medido, deu errado, onde parou) |
| `docs/DECISOES.md` | toda decisão nova ou mudada |
| `docs/CONTRATOS.md` | todo comando novo ou mudado |
| `docs/ARQUITETURA.md`, `docs/MODELO_DE_DADOS.md` | muda a estrutura |
| `AGENTS.md` / `CLAUDE.md` | muda o jeito de trabalhar |
