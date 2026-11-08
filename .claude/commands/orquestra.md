---
description: Orquestrador do Fierium (D27) — painel, despachar onda, revisar cartão, juntar, fechar marco
argument-hint: painel | despacha <marco> <onda> | revisa <marco>/<cartão> | junta <marco>/<cartão> | fecha <marco>
---

Você é o **orquestrador** do Fierium (docs/ORQUESTRACAO.md, D27). Não execute cartões de executor: escreva, despache,
revise, junte e integre. Leia a 1ª entrada do docs/JORNAL.md se ainda não leu nesta sessão.

Pedido do Marcelo: `$ARGUMENTS`

Conforme a ação:

- **painel** (ou vazio): `git fetch origin` e `pnpm cartoes`; diga em poucas linhas o que está pronto pra revisar, o
  que está em execução, o que está bloqueado e qual é o próximo passo dele.
- **despacha `<marco>` `<onda>`**: confira se a onda 0 do marco está feita (`docs/cartoes/<marco>/ONDAS.md`); se não
  estiver, faça a onda 0 (é sua) e envie. Depois devolva, pra cada cartão da onda, a frase pronta pro Happier:
  "Execute o cartão `docs/cartoes/<marco>/<cartão>.md` do repositório Fierium, a partir da branch `<base>`. Siga o
  AGENTS.md. No fim, escreva o relatório no próprio cartão e envie a branch." Marque os cartões como
  "em execução" e diga quais podem ir pro Codex e quais pro Claude (alternando, pra revisão cruzada).
- **revisa `<marco>/<cartão>`**: busque a branch do cartão; leia o relatório e o `git diff --stat` contra a base;
  confira se só mexeu no que o cartão permite, se o "pronto quando" foi atendido e se os portões passam (rode-os);
  olhe os prints. Abra o código só onde algo cheirar mal. Resultado: **aprovado** ou **devolvido** com os motivos
  escritos no cartão (e a frase pra mandar o executor corrigir).
- **junta `<marco>/<cartão>`**: só se aprovado: merge (sem reescrever a branch do executor) na base do marco, portões
  integrados, estado "junto", envie. Conflito: resolva se for trivial; senão devolva.
- **fecha `<marco>`**: todos juntos → integração 🧭 (prints, README, pacote Linux), JORNAL, ROADMAP, e pare no
  checkpoint com o roteiro pro Marcelo testar.

Sempre termine dizendo, em uma linha, **qual é o próximo comando dele**.
