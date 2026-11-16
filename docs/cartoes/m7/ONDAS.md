# M7 adiantado · Temas da página, marcações e citações

Pedido do Marcelo (2026-11-16): **prioridade = temas do PDF e marcações/citações**, com um jeito de achar tudo depois.
Base: `claude/eloquent-fermat-z05qmh`. Um executor só, em sequência, numa branch própria (ex.: `codex/m7`), porque os
três mexem no motor de PDF. ⏸ = parar pro Marcelo testar (com `.deb`).

| Ordem | Cartão | Dá pra você |
|---|---|---|
| 1 | [T1 temas da página](t1-temas-da-pagina.md) | Os 22 temas do KOFlibrary + ~80 novos (≈100), cor do papel e da letra totalmente livres, brilho, contraste, luz quente; vale pro PDF e pro EPUB |
| 2 | [M1 marcações](m1-marcacoes.md) | Marcar trecho no PDF e no EPUB, com cor que tem significado e nota; guardado no Rust, volta ao reabrir |
| 3 | [M2 citações e acesso depois](m2-citacoes.md) | Tela de Notas com tudo de todos os livros: buscar, filtrar, ir pro trecho, copiar citação pronta, exportar Markdown; a busca (Ctrl+K) e o Início acham as marcações |
| ⏸ | CP7a | Prints + `.deb`: o Marcelo testa temas e marcações nos livros dele |
