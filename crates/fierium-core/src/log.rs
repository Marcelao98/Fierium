//! Log em arquivo, um por dia, em `<pasta de dados>/logs/fierium.log.AAAA-MM-DD` (como o KOFstation). Os registros
//! da interface chegam pelo comando `log.escrever`, marcados com a origem `tela`, cortados em 8 KB.
use crate::erro::ErroFierium;
use serde::Deserialize;
use std::path::Path;
use tracing_appender::non_blocking::WorkerGuard;

/// Liga o log. Guarde o `WorkerGuard` até o fim do programa (soltar = gravar o que falta e parar).
pub fn ligar(pasta_de_dados: &Path) -> Result<WorkerGuard, ErroFierium> {
    let pasta = pasta_de_dados.join("logs");
    std::fs::create_dir_all(&pasta).map_err(|e| ErroFierium::de_io(pasta.display(), e))?;
    let arquivo = tracing_appender::rolling::Builder::new()
        .rotation(tracing_appender::rolling::Rotation::DAILY)
        .filename_prefix("fierium.log")
        // guarda só os últimos 14 dias (o KOFlibrary não tinha limite)
        .max_log_files(14)
        .build(&pasta)
        .map_err(|e| ErroFierium::Log(e.to_string()))?;
    let (escritor, guarda) = tracing_appender::non_blocking(arquivo);
    let filtro = tracing_subscriber::EnvFilter::try_from_env("FIERIUM_LOG")
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_writer(escritor)
        .with_ansi(false)
        .with_env_filter(filtro)
        .try_init()
        .map_err(|e| ErroFierium::Log(e.to_string()))?;
    Ok(guarda)
}

/// Uma linha que veio da interface.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LinhaDaTela {
    pub nivel: String,
    pub origem: String,
    pub mensagem: String,
    #[serde(default)]
    pub dados: Option<serde_json::Value>,
}

const MAX: usize = 8 * 1024;

pub fn cortar(s: &str) -> &str {
    if s.len() <= MAX {
        return s;
    }
    let mut i = MAX;
    while !s.is_char_boundary(i) {
        i -= 1;
    }
    &s[..i]
}

pub fn escrever(l: &LinhaDaTela) -> Result<(), ErroFierium> {
    let origem = cortar(&l.origem);
    let msg = cortar(&l.mensagem);
    let dados = l
        .dados
        .as_ref()
        .map(|d| cortar(&d.to_string()).to_string())
        .unwrap_or_default();
    match l.nivel.as_str() {
        "erro" => tracing::error!(target: "tela", origem, dados, "{msg}"),
        "aviso" => tracing::warn!(target: "tela", origem, dados, "{msg}"),
        "info" => tracing::info!(target: "tela", origem, dados, "{msg}"),
        "debug" => tracing::debug!(target: "tela", origem, dados, "{msg}"),
        outro => {
            return Err(ErroFierium::argumento(
                "nivel",
                format!("{outro} (use erro, aviso, info ou debug)"),
            ))
        }
    }
    Ok(())
}
