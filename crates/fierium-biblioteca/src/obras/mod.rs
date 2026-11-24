//! Obra ≠ edição ≠ arquivo (MODELO_DE_DADOS §1–2). A **obra** é o livro; cada **edição** é uma forma dele (o PDF, o
//! EPUB, outra tradução); cada **arquivo** é uma cópia no disco. Aqui ficam: a chave que reconhece a mesma obra
//! (`chave`), a leitura das obras com as edições (`consultas`, `json`), a escrita a partir dos metadados (`escrita`)
//! e o juntar/separar à mão (`juntar`, `relacao`).
pub(crate) mod chave;
mod consultas;
mod escrita;
mod json;
mod juntar;
pub(crate) mod relacao;
#[cfg(test)]
mod testes;

pub(crate) use chave::achar_obra;
pub use chave::{chave_do_autor, chave_do_titulo};
pub(crate) use escrita::{chaves, completar_obra, criadores_json, inserir_edicao, inserir_obra, primeiro_autor};
pub(crate) use json::Resumo;
pub(crate) use relacao::{absorver_relacao, ler_relacao};
