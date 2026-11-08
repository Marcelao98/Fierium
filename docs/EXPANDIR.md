# Como acrescentar coisas no Fierium (e como achar defeito)

Receitas curtas. A regra de sempre: **uma mudança mexe em poucos lugares, e o lint e os testes avisam se você
cruzou uma fronteira** ([ARQUITETURA.md](ARQUITETURA.md) §3).

## Um comando novo do núcleo

1. `packages/contratos/src/index.ts`: o tipo dos argumentos e da resposta, e a linha em `Comandos`.
   (A partir do M3, o tipo vem do Rust: escreva o comando em `crates/fierium-app` e gere os tipos.)
2. O tratador no adaptador em memória, na área certa (`packages/cliente/src/memoria/<área>.ts`). Se ele grava,
   acrescente o nome em `ESCREVEM_<ÁREA>`. Se faltar o tratador, o TypeScript não compila.
3. Teste no `memoria.test.ts` (e, a partir do M3, no teste de contrato: memória × Rust).
4. `docs/CONTRATOS.md`.

## Uma funcionalidade nova (uma tela)

1. Pasta `apps/app/src/recursos/<nome>/` com:
   - `estado.ts`: `criarNome(s: Servicos)` devolvendo `{ store, ações }`; ouve os eventos que interessam;
   - `Tela.tsx`: `TelaNome({ nome })`, lendo com `useFatia(nome.store, …)`;
   - `<nome>.css` (importado pela Tela) e `estado.test.ts` (com `servicosDeTeste()`).
2. `montar.ts`: `nome: criarNome(servicos)`.
3. `nucleo/navegacao.ts`: a rota; `App.tsx`: a linha que mostra a tela; `casca/Navegacao.tsx`: o destino na barra.
4. Precisa avisar outra funcionalidade? Um evento novo em `nucleo/eventos.ts` (tipado). **Nunca** importe outro recurso.
5. Um teste de fluxo em `apps/app/e2e/`.

## Um formato novo de leitura (ex.: webtoon)

1. `packages/leitores/src/<formato>/motor-<formato>.ts` implementando `MotorDeLeitura` (`aceita`, `montar` →
   `SessaoLeitura`) e avisando por `EventosMotor`. Âncora das marcações: um tipo novo em `Ancora` (contratos).
2. Registrar em `MOTORES` (`packages/leitores/src/index.ts`).
3. Teste com jsdom (`motor-<formato>.test.ts`), com arquivos de teste **gerados pelo próprio teste**.
4. No Rust (M3+): ler metadados e capa do formato em `fierium-biblioteca`, e `edicao.abrir` devolvendo
   `{ tipo: 'arquivo', formato, url }`.
5. A casca do leitor, o balão de marcação, as Notas e as Estatísticas não mudam.

## Uma cor, um ícone, um componente visual

`packages/ui` (tokens em `tokens.css`, ícones em `Icone.tsx`). Mostre na vitrine (`apps/app/src/dev/Vitrine.tsx`).

## Achar um defeito

1. **Inspetor (Ctrl+Shift+D):** o último comando que falhou mostra o código, a mensagem, os argumentos e o tempo.
   "Copiar relatório" junta tudo.
2. **Console:** `__fierium.servicos.log.recentes()`, `__fierium.recursos.<nome>.store.getState()`
   (em desenvolvimento, ou com `?depurar` no endereço).
3. **Isolar:** a store sozinha num teste com `servicosDeTeste()`; o motor sozinho com jsdom; o componente na vitrine.
4. **Reproduzir no teste antes de corrigir**, e o teste fica (regressão nunca volta calada).
5. A partir do M2: o log do dia em `~/.local/share/fierium/logs/` (Linux).
