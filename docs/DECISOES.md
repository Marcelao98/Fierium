# Decisões do Fierium

Cada decisão tem número, data, quem decidiu e o porquê. Decisão mudada ganha uma entrada nova (não apaga a antiga).

| # | Data | Decisão | Quem | Por quê |
|---|---|---|---|---|
| D1 | 2026-11-07 | **Stack: Tauri 2 (núcleo em Rust) + interface em React com TypeScript** | Marcelo aprovou | Um código pra Linux, Windows, Android e iOS; interface web reaproveita os melhores leitores (pdf.js, foliate-js) e serve pra uma versão web no futuro; Rust é rápido, seguro e pode virar o servidor depois; atualização assinada já vem no Tauri. Descartados: Electron (pesado, sem celular), Flutter (fraco em EPUB/PDF), o modelo do KOFstation (Rust + Chrome em modo app: não vai pro Android/iOS) |
| D2 | 2026-11-07 | **Ordem das plataformas: Linux → Windows → Android → iOS** | Marcelo | O Marcelo usa Linux hoje; ele testa cada marco no computador dele |
| D3 | 2026-11-07 | **O Fierium substitui o KOFlibrary**; o KOFlibrary continua até o Fierium ter tudo o que ele tem (mangá, celular, sincronia) e importa o `.koflib` | Marcelo | Ninguém perde nada na troca (o mesmo jeito do KOFstation antigo × novo) |
| D4 | 2026-11-07 | **Regras do negócio só no Rust; o TypeScript cuida da tela.** O backend de mentira (memória) imita os comandos do Rust pro `pnpm dev` e os testes | Marcelo aprovou | Nada de regra duplicada à mão (problema do KOFlibrary); a tela pode ser testada sem Rust |
| D5 | 2026-11-07 | **A tela fala com uma "porta" (`Cliente`), não com o Tauri direto.** Adaptadores: memória (agora), Tauri (M2), HTTP (futuro web) | Proposta aprovada | A versão web e a sincronia entram sem mexer nas telas |
| D6 | 2026-11-07 | **Os tipos do contrato vêm do Rust** (gerados a partir do M2/M3). Até lá, `@fierium/contratos` é escrito à mão e marcado como provisório | Proposta aprovada | Um lado muda, o outro não compila: o contrato nunca fica desatualizado |
| D7 | 2026-11-07 | **Modelo obra → edição → arquivo**, e os dados pessoais separados dos derivados (capas, índices: dá pra apagar e refazer) | Visão aprovada | Base pra todo tipo de mídia, duplicatas, audiolivro + texto, catálogos e sincronia (FIERIUM_PRODUCT_VISION §10, §14) |
| D8 | 2026-11-07 | **Dados prontos pra sincronizar desde o começo, sem construir a sincronia:** ID único (UUIDv7) em tudo, identidade do arquivo pelo conteúdo, relógio lógico (HLC) + id do aparelho, apagados como "lápide", regras de juntar por campo no domínio, registro de mudanças | Proposta aprovada | Sincronia vira só um transporte depois; lições do KOFlibrary (`nome|tamanho`, relógio do aparelho) |
| D9 | 2026-11-07 | **Arquivo do usuário nunca é alterado.** Marcações e progresso ficam nos dados do Fierium | Visão (Alma) | Confiança e posse |
| D10 | 2026-11-07 | **Arquivo grande nunca entra inteiro na memória:** o Rust entrega aos pedaços (Range) | Lição da auditoria do KOFlibrary | PDF escaneado de centenas de MB abrindo na hora |
| D11 | 2026-11-07 | **Atualização assinada e chave fora do repositório**, desde o primeiro pacote | Lição da auditoria | O problema mais grave do KOFlibrary |
| D12 | 2026-11-07 | **Fontes embutidas no app** (Fraunces nos títulos, Inter na interface, Literata na leitura; OFL), nada de buscar na internet | Proposta | Offline-first; identidade igual em toda plataforma |
| D13 | 2026-11-07 | **Interface em português (pt-BR) primeiro**, textos num lugar só pra traduzir depois | Proposta | Público inicial; inglês logo em seguida |
| D14 | 2026-11-07 | **Licença do Fierium: em aberto** (`UNLICENSED` até o Marcelo decidir) | Aberto | Afeta plugins, contribuições e quais bibliotecas podem entrar (GPL × permissiva) |
| D15 | 2026-11-07 | **Sem nomes poéticos na interface por enquanto:** Início, Biblioteca, Coleções, Notas, Estatísticas, Ajustes, Buscar (o "Atlas" vira "mapa") | Marcelo | Clareza primeiro; os nomes da identidade podem voltar depois |
| D16 | 2026-11-07 | **A 1.0 lê PDF, EPUB e mangá/HQ (CBZ, CBR)** | Marcelo | O KOFlibrary já lê mangá: ninguém perde isso na troca |
| D17 | 2026-11-07 | **Repositório novo (`Fierium`)**, separado do KOFLibrary; o KOFLibrary fica intocado até a paridade (M13) e aí é arquivado com o README apontando pro Fierium | Recomendação; aguardando o Marcelo | A `main` do KOFLibrary é o canal de atualização de quem usa hoje (qualquer push vai pros usuários); stack e histórico diferentes; o mesmo jeito do KOFstation-old × KOFstation |
| D18 | 2026-11-07 | **Processo marco → checkpoint** com definição de pronto, portões de qualidade e branch por marco ([PLANO.md](PLANO.md)) | Marcelo | Ele testa cada etapa |
| D19 | 2026-11-08 | **Arquitetura modular da interface:** uma pasta por funcionalidade, dependências injetadas (`Servicos`), eventos tipados, leitores como motores (`MotorDeLeitura`), log central com inspetor | Marcelo ("engenharia de software de verdade") | Isolar, testar e depurar cada peça; o lint confere as fronteiras |
| D20 | 2026-11-08 | **Ordem nova:** M4 (PDF) → M7 (marcações) → M8 (estatísticas) → M5 (EPUB) → M6 (mangá) | Marcelo | Ele lê mais PDF agora |
| D21 | 2026-11-08 | **Porta única `chamar(cmd, args)` no Rust**, com os mesmos nomes de comando da interface; despacho por nome conhecido (nada de shell, nada de caminho solto) | Proposta (padrão do KOFstation) | Um contrato só pros três adaptadores (memória, Tauri, HTTP); testável sem Tauri |
| D22 | 2026-11-08 | **Adaptador combinado** durante a migração: o que o Rust já atende (`app.comandos`) vai pro Rust; o resto, pro exemplo em memória | Proposta | Cada área troca pro Rust quando fica pronta, sem mexer nas telas |
| D23 | 2026-11-08 | **Pacote Linux em todo checkpoint** a partir do M2 (`.deb` e AppImage) | Marcelo ("Linux desde o começo") | Ele testa no computador dele |
