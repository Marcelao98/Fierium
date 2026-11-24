//! Metadados dos livros: do nome do arquivo (`nome`), de dentro do EPUB (`epub`) e do PDF (`pdf`).
//! dos dois (o de dentro vence; o nome só completa). Capa de EPUB extraída pra pasta de cache.
use fierium_core::ErroFierium;
use serde::{Deserialize, Serialize};
use std::path::Path;

mod epub;
mod nome;
mod pdf;
#[cfg(test)]
mod testes;

pub use epub::ler_epub;
pub use nome::{completar, nome_natural, pelo_nome};
pub use pdf::ler_pdf;

/// PDF maior que isto não é lido por dentro (a leitura carrega o arquivo): fica só o nome.
const PDF_MAX: u64 = 64 * 1024 * 1024;
const CAPA_MAX: u64 = 15 * 1024 * 1024;
const XML_MAX: u64 = 4 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Pessoa {
    pub nome: String,
    pub papel: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Serie {
    pub nome: String,
    pub volume: f64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Metadados {
    pub titulo: String,
    pub criadores: Vec<Pessoa>,
    pub ano: Option<i32>,
    pub idioma: String,
    pub assuntos: Vec<String>,
    pub serie: Option<Serie>,
    pub isbn: String,
    pub paginas: Option<u32>,
}

/// Uma capa achada dentro do arquivo.
pub struct Capa {
    pub bytes: Vec<u8>,
    pub ext: &'static str,
}

fn ilegivel(caminho: &Path, motivo: &str) -> ErroFierium {
    ErroFierium::Arquivo {
        caminho: format!("{} (ARQUIVO_ILEGIVEL)", caminho.display()),
        fonte: std::io::Error::new(std::io::ErrorKind::InvalidData, motivo.to_string()),
    }
}

// ---------- lixo ----------

/// Título que é claramente lixo de programa: "Untitled", "Microsoft Word - x", só números, nome de arquivo.
pub fn titulo_lixo(t: &str) -> bool {
    let t = t.trim();
    let n = super::normalizar(t);
    if n.is_empty() || !t.chars().any(char::is_alphabetic) {
        return true;
    }
    const FIXOS: &[&str] = &[
        "untitled",
        "unknown",
        "title",
        "document",
        "documento",
        "novo documento",
        "sem titulo",
        "null",
        "none",
    ];
    if FIXOS.contains(&n.as_str()) || n.starts_with("untitled") || n.starts_with("microsoft ") {
        return true;
    }
    [
        ".doc", ".docx", ".pdf", ".indd", ".tex", ".odt", ".qxd", ".epub", ".rtf", ".txt",
    ]
    .iter()
    .any(|e| n.ends_with(e))
}

fn autor_lixo(a: &str) -> bool {
    let n = super::normalizar(a);
    let n = n.trim();
    n.is_empty()
        || !n.chars().any(char::is_alphabetic)
        || [
            "unknown",
            "admin",
            "administrator",
            "user",
            "author",
            "autor",
            "desconhecido",
            "null",
        ]
        .contains(&n)
}

/// Lê por dentro conforme o formato; erro de leitura não derruba nada: vira metadados vazios (e um aviso no log).
pub fn ler_do_arquivo(caminho: &Path, formato: &str, com_capa: bool) -> (Metadados, Option<Capa>) {
    let r = match formato {
        "epub" => ler_epub(caminho, com_capa),
        "pdf" => ler_pdf(caminho).map(|m| (m, None)),
        _ => return (Metadados::default(), None),
    };
    match r {
        Ok(x) => x,
        Err(e) => {
            tracing::warn!("metadados: não li {}: {e}", caminho.display());
            (Metadados::default(), None)
        }
    }
}

/// Grava a capa em `<pasta>/<impressao>.<ext>` e devolve o caminho.
pub fn gravar_capa(pasta: &Path, impressao: &str, capa: &Capa) -> Option<std::path::PathBuf> {
    std::fs::create_dir_all(pasta).ok()?;
    let p = pasta.join(format!("{impressao}.{}", capa.ext));
    std::fs::write(&p, &capa.bytes).ok()?;
    Some(p)
}

/// `~/.cache/fierium/capas` (Linux), `%LOCALAPPDATA%\Fierium\capas` (Windows).
pub fn pasta_de_capas() -> std::path::PathBuf {
    let var = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
    let base = if cfg!(windows) {
        var("LOCALAPPDATA").map(|l| std::path::PathBuf::from(l).join("Fierium"))
    } else {
        var("XDG_CACHE_HOME")
            .map(|x| std::path::PathBuf::from(x).join("fierium"))
            .or_else(|| var("HOME").map(|h| std::path::PathBuf::from(h).join(".cache/fierium")))
    };
    base.unwrap_or_else(|| std::env::temp_dir().join("fierium"))
        .join("capas")
}
