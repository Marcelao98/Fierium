//! Baixar arquivos com educação: User-Agent que diz quem somos (sem e-mail), tempo-limite, gravação em `.part` e só
//! depois o nome final. A `Baixador` é um trait pra os testes não usarem a rede.
use fierium_core::ErroFierium;
use std::io::{Read, Write};
use std::path::Path;
use std::time::Duration;

pub const USER_AGENT: &str = concat!(
    "Fierium/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/Marcelao98/Fierium)"
);

pub trait Baixador: Send + Sync {
    /// Baixa `url` pra `destino` (cria ou troca o arquivo). Devolve quantos bytes gravou.
    fn baixar(&self, url: &str, destino: &Path) -> Result<u64, ErroFierium>;

    /// O mesmo, avisando o andamento: (bytes já gravados, tamanho total quando o servidor diz).
    fn baixar_avisando(
        &self,
        url: &str,
        destino: &Path,
        aviso: &mut dyn FnMut(u64, Option<u64>),
    ) -> Result<u64, ErroFierium> {
        let n = self.baixar(url, destino)?;
        aviso(n, Some(n));
        Ok(n)
    }
}

pub struct BaixadorHttp {
    agente: ureq::Agent,
}

impl Default for BaixadorHttp {
    fn default() -> Self {
        let cfg = ureq::Agent::config_builder()
            .user_agent(USER_AGENT)
            // rede lenta existe: o catálogo (5 MB) a 20 kB/s leva uns 5 minutos
            .timeout_global(Some(Duration::from_secs(1800)))
            .timeout_connect(Some(Duration::from_secs(20)))
            .build();
        Self { agente: cfg.into() }
    }
}

/// O erro do ureq em português ("o servidor respondeu 503" em vez de "http status: 503").
fn motivo(e: &ureq::Error) -> String {
    match e {
        ureq::Error::StatusCode(503) => "o servidor está em manutenção (erro 503)".into(),
        ureq::Error::StatusCode(404) => "o arquivo não existe no servidor (erro 404)".into(),
        ureq::Error::StatusCode(n) => format!("o servidor respondeu com o erro {n}"),
        ureq::Error::Timeout(_) => "o servidor demorou demais pra responder".into(),
        outro => outro.to_string(),
    }
}

impl Baixador for BaixadorHttp {
    fn baixar(&self, url: &str, destino: &Path) -> Result<u64, ErroFierium> {
        self.baixar_avisando(url, destino, &mut |_, _| {})
    }

    fn baixar_avisando(
        &self,
        url: &str,
        destino: &Path,
        aviso: &mut dyn FnMut(u64, Option<u64>),
    ) -> Result<u64, ErroFierium> {
        let rede = |e: String| ErroFierium::Rede(format!("não consegui baixar {url}: {e}"));
        let mut resp = self.agente.get(url).call().map_err(|e| rede(motivo(&e)))?;
        let total = resp
            .headers()
            .get("content-length")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok());
        if let Some(pai) = destino.parent() {
            std::fs::create_dir_all(pai).map_err(|e| ErroFierium::de_io(pai.display(), e))?;
        }
        let parcial = destino.with_extension("part");
        let mut f = std::fs::File::create(&parcial).map_err(|e| ErroFierium::de_io(parcial.display(), e))?;
        let r = (|| -> Result<u64, ErroFierium> {
            let mut leitor = resp.body_mut().with_config().limit(4 * 1024 * 1024 * 1024).reader();
            let mut pedaco = vec![0u8; 64 * 1024];
            let mut n = 0u64;
            loop {
                let lido = leitor.read(&mut pedaco).map_err(|e| rede(e.to_string()))?;
                if lido == 0 {
                    break;
                }
                f.write_all(&pedaco[..lido])
                    .map_err(|e| ErroFierium::de_io(parcial.display(), e))?;
                n += lido as u64;
                aviso(n, total);
            }
            if total.is_some_and(|t| n < t) {
                return Err(rede(format!(
                    "a conexão caiu no meio ({n} de {} bytes)",
                    total.unwrap_or(0)
                )));
            }
            f.flush().map_err(|e| ErroFierium::de_io(parcial.display(), e))?;
            Ok(n)
        })();
        drop(f);
        match r {
            Ok(n) => {
                std::fs::rename(&parcial, destino).map_err(|e| ErroFierium::de_io(destino.display(), e))?;
                Ok(n)
            }
            Err(e) => {
                let _ = std::fs::remove_file(&parcial); // só limpa a sobra; o erro de verdade é devolvido
                Err(e)
            }
        }
    }
}

/// "Autor - Título.epub", sem caracteres que o sistema de arquivos não aceita.
pub fn nome_do_arquivo(autor: &str, titulo: &str, extensao: &str) -> String {
    fn limpar(s: &str) -> String {
        let t: String = s
            .chars()
            .map(|c| {
                if c.is_control() || "/\\:*?\"<>|".contains(c) {
                    ' '
                } else {
                    c
                }
            })
            .collect();
        t.split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .trim_matches('.')
            .trim()
            .to_string()
    }
    let corte = |s: String, n: usize| s.chars().take(n).collect::<String>().trim().to_string();
    // o Windows não aceita nomes como CON, NUL, COM1 (com ou sem extensão): vira "_CON"
    let reservado = |s: String| {
        let base = s.split('.').next().unwrap_or("").to_uppercase();
        let r = matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL")
            || ((base.starts_with("COM") || base.starts_with("LPT"))
                && base.len() == 4
                && base[3..].chars().all(|c| ('1'..='9').contains(&c)));
        if r {
            format!("_{s}")
        } else {
            s
        }
    };
    let (a, t) = (corte(limpar(autor), 60), corte(limpar(titulo), 120));
    let base = match (a.is_empty(), t.is_empty()) {
        (_, true) if a.is_empty() => "Sem título".to_string(),
        (_, true) => a,
        (true, false) => t,
        (false, false) => format!("{a} - {t}"),
    };
    // sem ponto/espaço no fim do nome-base (o Windows corta) e sem nome reservado
    let base = reservado(base.trim_end_matches(['.', ' ']).to_string());
    format!("{base}.{extensao}")
}
