# Contratos (interface ↔ núcleo)

> Os tipos estão em `packages/contratos/src/index.ts` (provisórios até o M3; depois gerados do Rust — D6). Toda
> resposta de erro é `ErroFierium { codigo, mensagem }`, com a mensagem em português. Versão do contrato: 1.
> A interface chama tudo por uma porta só, `chamar(cmd, args)`, e o Rust despacha pelo nome (`comandos/mod.rs`).
> `app.comandos` devolve a lista que o Rust atende; ela é **montada das áreas** (cada arquivo de `comandos/`
> declara os seus comandos), então esta tabela e a lista não podem divergir sem um teste quebrar.

## Comandos que o Rust atende hoje (33)

Argumentos entre `{}`; `?` = opcional. "Escrita" = usa a conexão de escrita (trava curta); o resto usa uma conexão
só-leitura do pool (ver ARQUITETURA §Rust, "Conexões").

| Comando | Área | Argumentos → resposta | Erros | Conexão |
|---|---|---|---|---|
| `app.info` | app | — → `{versao, plataforma, adaptador:"tauri"}` | — | — |
| `app.comandos` | app | — → `string[]` (os comandos abaixo) | — | — |
| `log.escrever` | app | `{nivel: debug\|info\|aviso\|erro, origem, mensagem, dados?}` → null | `ARGUMENTO_INVALIDO` | arquivo de log |
| `biblioteca.limiar` | biblioteca | — → `{ultimo, emAndamento (≤12), eco, novidades (≤12), esquecidas (≤3), totalObras}` (o Início) | — | leitura |
| `biblioteca.varrer` | biblioteca | — → `{novos, sumiram, total, milissegundos}`. Duas fases: anda nas pastas e lê os arquivos novos numa conexão de leitura, depois grava numa transação curta | — | leitura + escrita |
| `obras.listar` | biblioteca | `{texto?, estado?, formato?, favoritas?, ordem?: recentes\|titulo\|autor\|progresso, limite?, deslocamento?}` → `Obra[]`. `texto`: sem acento, em qualquer ordem. **`limite`/`deslocamento` são opcionais** (uma página; sem `limite` vem tudo, como sempre) | `ARGUMENTO_INVALIDO` (ordem) | leitura |
| `obra.obter` | biblioteca | `{id}` → `Obra` | `NAO_ENCONTRADO` | leitura |
| `obra.atualizar` | biblioteca | `{id, favorita?, estado?: nao-lida\|lendo\|lida\|deixada}` → `Obra` | `NAO_ENCONTRADO`, `ARGUMENTO_INVALIDO` | escrita |
| `obra.juntar` | biblioteca | `{ids}` → `Obra` (todas viram a primeira: edições, marcações e relação somadas; a varredura não desfaz) | `ARGUMENTO_INVALIDO`, `NAO_ENCONTRADO` | escrita |
| `obra.editar` | biblioteca | `{id, titulo?, autores?, serie?: {nome, volume}\|null, ano?: number\|null}` → `Obra` (a edição à mão vence a varredura) | `ARGUMENTO_INVALIDO`, `NAO_ENCONTRADO` | escrita |
| `obra.sugestoes` | biblioteca | `{id}` → `SugestaoObra[]` (do nome do arquivo e da Open Library, com cache de 30 dias; com a rede desligada, só as de dentro) | `NAO_ENCONTRADO` | conexão auxiliar (a rede não segura a escrita) |
| `obra.aplicarSugestao` | biblioteca | `{id, sugestaoId}` → `Obra` | `NAO_ENCONTRADO` | escrita |
| `edicao.separar` | biblioteca | `{edicaoId}` → `Obra` (a edição vira uma obra própria; a varredura não junta de novo) | `ARGUMENTO_INVALIDO` (única edição), `NAO_ENCONTRADO` | escrita |
| `pastas.listar` | biblioteca | — → `{caminho, existe, arquivos}[]` | — | leitura |
| `pastas.adicionar` | biblioteca | `{caminho}` (aceita `~`) → pastas | `ARGUMENTO_INVALIDO` (não é pasta) | escrita |
| `pastas.remover` | biblioteca | `{caminho}` → pastas (os livros dela somem da estante e voltam, com o progresso, se a pasta voltar) | `NAO_ENCONTRADO` | escrita |
| `pastas.sugestoes` | biblioteca | — → `string[]` (pastas comuns que existem: `~/Livros`, Documentos…) | — | — |
| `edicao.abrir` | leitura | `{edicaoId}` → `{tipo:'arquivo', edicaoId, formato, url, tamanho}`; o arquivo vem aos pedaços pelo `url` (`fierium://localhost/arquivo/<id>`, com Range) | `NAO_ENCONTRADO` (o arquivo sumiu) | leitura |
| `progresso.salvar` | leitura | `{edicaoId, posicao, fracao 0..1}` → null (≥ 0,98 marca a obra como lida) | `ARGUMENTO_INVALIDO`, `NAO_ENCONTRADO` | escrita |
| `marcacoes.listar` | marcações | `{obraId?, cor?, texto?}` → `Marcacao[]` (mais novas primeiro) | — | leitura |
| `marcacao.criar` | marcações | `{obraId, edicaoId, tipo, ancora, trecho, cor, nota?, etiquetas?, ligacoes?}` → `Marcacao` | `ARGUMENTO_INVALIDO`, `NAO_ENCONTRADO` | escrita |
| `marcacao.atualizar` | marcações | `{id, cor?, nota?, etiquetas?, ligacoes?}` → `Marcacao` | `ARGUMENTO_INVALIDO`, `NAO_ENCONTRADO` | escrita |
| `marcacao.apagar` | marcações | `{id}` → null (tira as ligações que apontavam pra ela) | `NAO_ENCONTRADO` | escrita |
| `busca.tudo` | busca | `{texto}` → `{tipo: obra\|criador\|marcacao, id, titulo, detalhe, obraId}[]` (≤ 8 obras, 3 autores, 5 marcações) | — | leitura |
| `capa.salvar` | capas | `{edicaoId, imagem}` → `{capa}` (`imagem` é base64 sem `data:`, vira a capa da edição; fica em `~/.cache/fierium/capas/`) | `ARGUMENTO_INVALIDO` (não é imagem / passa de 2 MB), `NAO_ENCONTRADO` | escrita |
| `catalogo.buscar` | catálogo | `{texto?, autor?, assunto?, idioma?, tipo?, limite? (1..500, padrão 50), deslocamento?}` → `{itens: ItemCatalogo[], total}`; cada item traz `obraId` se a pessoa já tem a obra e `capa` (endereço do protocolo) | — | leitura (catálogo) |
| `catalogo.item` | catálogo | `{id}` → `ItemCatalogo` | `NAO_ENCONTRADO` | leitura (catálogo) |
| `catalogo.fontes` | catálogo | — → `{id, nome, ligada, itens, atualizadaEm?}[]` | — | leitura (catálogo) |
| `catalogo.atualizar` | catálogo | `{fonte}` → fonte (baixa e importa numa transação; a busca da tela segue lendo enquanto importa) | `NAO_ENCONTRADO`, `SEM_REDE`, `ERRO_DE_REDE`, `ARGUMENTO_INVALIDO` (já atualizando) | escrita (catálogo) |
| `catalogo.estado` | catálogo | — → `{fase: vazio\|baixando\|importando\|pronto\|sem-rede\|erro, itens, bytes?, total?, mensagem?}` (barato: pergunta a cada segundo) | — | leitura (catálogo) |
| `catalogo.baixar` | catálogo | `{id, oferta?}` → `{obraId, edicaoId}` (baixa pra `~/Documentos/Livros/Fierium`, que entra na biblioteca sozinha) | `NAO_ENCONTRADO`, `SEM_REDE`, `ERRO_DE_REDE` | leitura + escrita |
| `rede.ler` | catálogo | — → `{permitida}` | — | leitura (catálogo) |
| `rede.definir` | catálogo | `{permitida}` → `{permitida}` | — | escrita (catálogo) |

Fora da lista, o protocolo `fierium://localhost/` (não é comando): `arquivo/<id>` (Range), `capa/<edicaoId>` e
`capa/cat-<chave>` (capa de item do catálogo, buscada na rede só se ela estiver ligada).

## Ainda só no exemplo em memória (a interface os chama; o Rust ainda não)

`config.ler` / `config.gravar`, `colecoes.listar` / `colecao.criar` / `colecao.definirObras`, `sessao.registrar`,
`estatisticas.resumo`, `metas.salvar`. Quando o Rust passar a atendê-los, entram numa área de `comandos/` e somem desta
lista (o adaptador combinado pergunta a `app.comandos`).

## Erros

Códigos usados: `NAO_ENCONTRADO`, `ARGUMENTO_INVALIDO`, `COMANDO_DESCONHECIDO`, `BANCO_DE_DADOS`, `ERRO_DE_ARQUIVO`,
`SEM_PERMISSAO`, `DISCO_CHEIO`, `FORA_DO_ARQUIVO`, `LOG_INDISPONIVEL`, `SEM_REDE`, `ERRO_DE_REDE`, `NUCLEO_SEM_RESPOSTA`
(a interface não conseguiu falar com o núcleo), `FORMATO_SEM_LEITOR` (leitor) e **`ERRO_INTERNO`** (novo: um comando
parou de repente por um defeito do programa; a mensagem diz qual, e o resto do app segue funcionando).

## Orçamentos de desempenho (medidos em release; ver ARQUITETURA §Rust, "Desempenho")

`obras.listar` (página de 100) < 50 ms · `biblioteca.limiar` < 30 ms · `marcacoes.listar` de uma obra < 10 ms ·
`busca.tudo` < 30 ms · `catalogo.buscar` < 30 ms. `obras.listar` sem `limite` devolve a estante inteira: com 10 mil
obras isso é montar ~10 MB de JSON (≈ 160 ms), por isso a tela deve pedir por páginas.
