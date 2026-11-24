//! A biblioteca de verdade (trilha "Lendo de verdade", M3 enxuto): pastas escolhidas, varredura de PDF e EPUB,
//! SQLite, obra deduzida do nome do arquivo, progresso. Sem Tauri: o `fierium-app` só chama isto.
//! Obra ≠ edição ≠ arquivo: o mesmo livro em PDF e EPUB é UMA obra com duas edições (ver `obras/`).
//! As respostas JSON têm o formato EXATO dos tipos do contrato TypeScript (camelCase).
//!
//! Módulos: `banco` (conexões, pool de leitura, migrações numeradas), `pastas`, `varredura`, `obras`, `progresso`,
//! `limiar`, `marcacoes`, `busca`, `capas`, `edicao_meta`, `sugestoes`, `metadados`.
use fierium_core::ErroFierium;
use std::time::{SystemTime, UNIX_EPOCH};

mod banco;
mod busca;
mod capas;
mod edicao_meta;
mod limiar;
mod marcacoes;
pub mod metadados;
mod obras;
mod pastas;
mod progresso;
mod sugestoes;
mod varredura;

#[cfg(test)]
pub(crate) use banco::VERSAO_BANCO;
pub use banco::{Biblioteca, Leitor, Leitores};
pub use obras::{chave_do_autor, chave_do_titulo};

/// Uma obra com este progresso (ou mais) conta como lida.
const LIDA: f64 = 0.98;

pub(crate) fn bd(e: rusqlite::Error) -> ErroFierium {
    ErroFierium::Banco(e.to_string())
}

pub(crate) fn agora() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub(crate) fn novo_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

/// Endereço do arquivo no protocolo da interface.
pub fn url_do_arquivo(id: &str) -> String {
    if cfg!(windows) {
        format!("http://fierium.localhost/arquivo/{id}")
    } else {
        format!("fierium://localhost/arquivo/{id}")
    }
}

/// Endereço da capa extraída (servida pelo protocolo, só pra edições registradas).
pub fn url_da_capa(edicao_id: &str) -> String {
    if cfg!(windows) {
        format!("http://fierium.localhost/capa/{edicao_id}")
    } else {
        format!("fierium://localhost/capa/{edicao_id}")
    }
}

/// Minúsculas e sem acento, pra busca. (ASCII é o caminho rápido: roda milhares de vezes por consulta.)
pub fn normalizar(s: &str) -> String {
    let mut saida = String::with_capacity(s.len());
    for c in s.chars() {
        if c.is_ascii() {
            saida.push(c.to_ascii_lowercase());
            continue;
        }
        for c in c.to_lowercase() {
            saida.push(match c {
                'á' | 'à' | 'â' | 'ã' | 'ä' | 'å' => 'a',
                'é' | 'è' | 'ê' | 'ë' => 'e',
                'í' | 'ì' | 'î' | 'ï' => 'i',
                'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
                'ú' | 'ù' | 'û' | 'ü' => 'u',
                'ç' => 'c',
                'ñ' => 'n',
                c => c,
            });
        }
    }
    saida
}

/// (autor, título) a partir do nome do arquivo.
pub fn titulo_e_autor(nome_arquivo: &str) -> (String, String) {
    let m = metadados::pelo_nome(nome_arquivo);
    (
        m.criadores.first().map(|p| p.nome.clone()).unwrap_or_default(),
        m.titulo,
    )
}

pub(crate) fn matiz_do_titulo(titulo: &str) -> i64 {
    let h = blake3::hash(titulo.as_bytes());
    let b = h.as_bytes();
    (u32::from_le_bytes([b[0], b[1], b[2], b[3]]) % 360) as i64
}

#[cfg(test)]
mod testes;
#[cfg(test)]
mod testes_desempenho;
#[cfg(test)]
mod testes_meta;
