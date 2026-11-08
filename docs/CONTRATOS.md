# Contratos (interface ↔ núcleo)

> Os tipos estão em `packages/contratos/src/index.ts` (provisórios até o M3; depois gerados do Rust — D6). Toda
> resposta de erro é `ErroFierium { codigo, mensagem }`, com a mensagem em português. Versão do contrato: 1.

| Comando | Argumentos → resposta | Erros | Área (crate) |
|---|---|---|---|
| `app.info` | — → `{versao, plataforma, adaptador}` | — | app |
| `config.ler` / `config.gravar` | — / `{config}` → `Config` | — | app |
| `biblioteca.limiar` | — → `{ultimo, emAndamento, eco, novidades, esquecidas, totalObras}` (o Início) | — | biblioteca |
| `obras.listar` | `FiltroObras` (texto sem acento e em qualquer ordem, estado, formato, coleção, área, favoritas, ordem) → `Obra[]` | — | biblioteca |
| `obra.obter` / `obra.atualizar` | `{id}` / `{id, favorita?, estado?}` → `Obra` | `NAO_ENCONTRADO` | biblioteca |
| `colecoes.listar` / `colecao.criar` / `colecao.definirObras` | … → `Colecao` | `ARGUMENTO_INVALIDO`, `NAO_ENCONTRADO` | biblioteca |
| `edicao.abrir` | `{edicaoId}` → `FonteLeitura`: `{tipo:'texto', capitulos}` ou `{tipo:'arquivo', formato, url, tamanho}` (o arquivo vem aos pedaços pelo endereço — M2/M4) | `NAO_ENCONTRADO` | leitura |
| `progresso.salvar` | `{edicaoId, posicao, fracao 0..1}` → null | `ARGUMENTO_INVALIDO` | leitura |
| `sessao.registrar` | `{edicaoId, segundos, paginas}` → null | `NAO_ENCONTRADO` | leitura |
| `marcacoes.listar` | `{obraId?, cor?, texto?}` → `Marcacao[]` (mais novas primeiro) | — | marcações |
| `marcacao.criar` / `.atualizar` / `.apagar` | … → `Marcacao` / null (apagar tira as ligações que apontavam pra ela) | `ARGUMENTO_INVALIDO`, `NAO_ENCONTRADO` | marcações |
| `estatisticas.resumo` | — → hoje, semana, sequência, recorde, 365 dias, metas, hora favorita, por área | — | estatísticas |
| `metas.salvar` | `{metas}` → situação das metas | `ARGUMENTO_INVALIDO` | estatísticas |
| `busca.tudo` | `{texto}` → obras, coleções, autores e marcações | — | busca |

Códigos de erro usados: `NAO_ENCONTRADO`, `ARGUMENTO_INVALIDO`, `COMANDO_DESCONHECIDO`, `NUCLEO_SEM_RESPOSTA` (a
interface não conseguiu falar com o núcleo), `FORMATO_SEM_LEITOR` (leitor).

**Chegam a seguir:** M3 — `pastas.listar/adicionar/remover`, `biblioteca.varrer` (com progresso), capas por
endereço; M4 — o protocolo de arquivo aos pedaços (`fierium://arquivo/<id>`, com Range).
