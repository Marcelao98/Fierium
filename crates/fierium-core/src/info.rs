//! Onde o Fierium guarda as coisas dele (nunca na pasta dos livros) e o que ele diz sobre si.
use serde::Serialize;
use std::path::PathBuf;

/// `$XDG_DATA_HOME/fierium` ou `~/.local/share/fierium` (Linux); `%APPDATA%\Fierium` (Windows).
/// Recebe as variáveis por função pra dar pra testar sem mexer no ambiente.
pub fn pasta_de_dados(var: impl Fn(&str) -> Option<String>) -> Option<PathBuf> {
    if cfg!(windows) {
        return var("APPDATA").map(|a| PathBuf::from(a).join("Fierium"));
    }
    if let Some(x) = var("XDG_DATA_HOME").filter(|x| !x.is_empty()) {
        return Some(PathBuf::from(x).join("fierium"));
    }
    var("HOME").map(|h| PathBuf::from(h).join(".local/share/fierium"))
}

#[derive(Debug, Serialize, PartialEq)]
pub struct InfoApp {
    pub versao: String,
    pub plataforma: String,
    pub adaptador: String,
}

pub fn info_app(versao: &str) -> InfoApp {
    InfoApp {
        versao: versao.into(),
        plataforma: std::env::consts::OS.into(),
        adaptador: "tauri".into(),
    }
}
