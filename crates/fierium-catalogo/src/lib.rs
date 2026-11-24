//! O catálogo público (D30): o que existe nos catálogos abertos, mesmo que a pessoa não tenha baixado. Fica num SQLite
//! **separado** da biblioteca (`catalogo.db`, descartável: se estragar, apaga e baixa de novo). Esquema genérico, pronto
//! pra mangá, HQ, revista e artigo. Sem Tauri: o `fierium-app` só chama isto. As respostas JSON têm o formato EXATO
//! dos tipos do contrato TypeScript (camelCase).
//!
//! Módulos: `banco` (conexões, pool de leitura, migrações numeradas), `rede` (o interruptor), `importar` (fonte →
//! banco), `consultas` (fontes, item, busca), `baixar`, `capas`, `gutenberg`.
use fierium_core::ErroFierium;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

mod baixar;
mod banco;
pub mod capas;
mod consultas;
pub mod gutenberg;
mod importar;
mod rede;

pub use baixar::{nome_do_arquivo, Baixador, BaixadorHttp, USER_AGENT};
pub use banco::{Catalogo, Leitor, Leitores};
pub use gutenberg::Gutenberg;

pub(crate) fn bd(e: rusqlite::Error) -> ErroFierium {
    ErroFierium::Banco(e.to_string())
}

pub fn agora() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Minúsculas e sem acento (pra comparar nomes fora do SQLite).
pub fn normalizar(s: &str) -> String {
    s.chars()
        .flat_map(char::to_lowercase)
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            'ñ' => 'n',
            c => c,
        })
        .collect()
}

#[derive(Debug, Clone, PartialEq)]
pub struct Pessoa {
    pub nome: String,
    /// "autor", "tradutor", "ilustrador", "narrador" ou "organizador"
    pub papel: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Oferta {
    pub fonte: String,
    pub formato: String,
    pub url: String,
    pub licenca: String,
    pub tamanho: Option<i64>,
}

/// Um item como a fonte o entrega, antes de entrar no banco.
#[derive(Debug, Clone, PartialEq)]
pub struct ItemNovo {
    /// o id dentro da fonte ("55752"); o id final é "<fonte>:<id>"
    pub id: String,
    pub tipo: String,
    pub titulo: String,
    pub idioma: String,
    pub ano: Option<i64>,
    pub sinopse: Option<String>,
    pub serie: Option<(String, i64)>,
    pub capa: Option<String>,
    pub pessoas: Vec<Pessoa>,
    pub assuntos: Vec<String>,
    /// (esquema, valor): isbn, gutenberg, openlibrary, wikidata, doi, anilist
    pub identificadores: Vec<(String, String)>,
    pub ofertas: Vec<Oferta>,
}

/// Um conector de catálogo (Gutenberg agora; Standard Ebooks, Wikisource, OPDS depois).
pub trait Fonte {
    fn id(&self) -> &'static str;
    fn nome(&self) -> &'static str;
    /// Baixa o catálogo da fonte (com cache em `cache`) e devolve os itens. Não mexe no banco.
    /// `aviso` recebe o andamento do download: (bytes, total quando o servidor diz).
    fn carregar(
        &self,
        baixador: &dyn Baixador,
        cache: &Path,
        aviso: &mut dyn FnMut(u64, Option<u64>),
    ) -> Result<Vec<ItemNovo>, ErroFierium>;
}

#[cfg(test)]
pub mod testes;
#[cfg(test)]
mod testes_desempenho;
