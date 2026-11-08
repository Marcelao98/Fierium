# Para agentes de IA

Você está no **Fierium**: biblioteca pessoal com leitores integrados (substitui o KOFlibrary). React + TypeScript na
interface, Rust (Tauri 2) no núcleo a partir do M2.

## Antes de mexer, leia nesta ordem

1. [docs/JORNAL.md](docs/JORNAL.md) — só a primeira entrada (onde parou).
2. [docs/ROADMAP.md](docs/ROADMAP.md) — o marco atual e o checklist.
3. [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — camadas e fronteiras; [docs/EXPANDIR.md](docs/EXPANDIR.md) — receitas.
4. Quando precisar: [docs/PLANO.md](docs/PLANO.md) (processo, definição de pronto), [docs/MODELO_DE_DADOS.md](docs/MODELO_DE_DADOS.md),
   [docs/CONTRATOS.md](docs/CONTRATOS.md), [docs/DECISOES.md](docs/DECISOES.md), a visão em [docs/FIERIUM_PRODUCT_VISION.md](docs/FIERIUM_PRODUCT_VISION.md).

## Regras

- **Marco → checkpoint:** termine o checklist, rode os portões (`pnpm check`, `pnpm e2e`, `pnpm check:rust` no M2+),
  um commit por marco, e pare pra o Marcelo testar (a não ser que ele tenha aprovado seguir).
- **Fronteiras (o lint confere):** uma funcionalidade (`recursos/x`) nunca importa outra (use eventos de
  `nucleo/eventos.ts`); telas falam com o núcleo pelos `Servicos`, nunca pelo cliente; regra de negócio só no Rust.
- **Nada de erro escondido:** `ErroFierium` com código e mensagem em português; `catch` vazio só com o porquê.
- **Teste junto:** store com `servicosDeTeste()`, motor com jsdom, componente com Testing Library, fluxo com Playwright.
- **Nunca** commitar livro (PDF, EPUB, CBZ…), chave de assinatura ou senha. Arquivos de teste são gerados pelos testes.
- Commits em português, sem nome de modelo de IA. Não abrir PR sem o Marcelo pedir. `git status` antes de `git add -A`.
- Ao terminar a sessão: entrada no JORNAL, ROADMAP atualizado, README se mudou como rodar.

## O dono

Marcelo (Marcelao98). Português do Brasil, informal, direto; escreve por voz (muitos erros de digitação: entenda a
intenção). Usa **Linux** (prioridade). Liga pra economia de tokens: faça o que foi pedido.
