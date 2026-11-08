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
