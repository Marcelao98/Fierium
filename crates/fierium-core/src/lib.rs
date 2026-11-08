//! Núcleo do Fierium sem Tauri nem tela: erros com código estável (os mesmos da interface), o log em arquivo, a
//! leitura de arquivo aos pedaços (Range) e, a partir do M3, o domínio da biblioteca.
pub mod erro;
pub mod info;
pub mod intervalo;
pub mod log;

pub use erro::{ErroContrato, ErroFierium};
