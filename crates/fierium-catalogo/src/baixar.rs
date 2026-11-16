//! Baixar arquivos com educação: User-Agent que diz quem somos (sem e-mail), tempo-limite, gravação em `.part` e só
//! depois o nome final. A `Baixador` é um trait pra os testes não usarem a rede.
use fierium_core::ErroFierium;
use std::io::Write;
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
}

pub struct BaixadorHttp {
    agente: ureq::Agent,
}

impl Default for BaixadorHttp {
    fn default() -> Self {
        let cfg = ureq::Agent::config_builder()
            .user_agent(USER_AGENT)
            .timeout_global(Some(Duration::from_secs(600)))
            .timeout_connect(Some(Duration::from_secs(20)))
            .build();
        Self { agente: cfg.into() }
    }
}

impl Baixador for BaixadorHttp {
    fn baixar(&self, url: &str, destino: &Path) -> Result<u64, ErroFierium> {
        let rede = |e: String| ErroFierium::Rede(format!("não consegui baixar {url}: {e}"));
        let mut resp = self.agente.get(url).call().map_err(|e| rede(e.to_string()))?;
        if let Some(pai) = destino.parent() {
            std::fs::create_dir_all(pai).map_err(|e| ErroFierium::de_io(pai.display(), e))?;
        }
        let parcial = destino.with_extension("part");
        let mut f = std::fs::File::create(&parcial).map_err(|e| ErroFierium::de_io(parcial.display(), e))?;
        let r = (|| -> Result<u64, ErroFierium> {
            let mut leitor = resp.body_mut().with_config().limit(4 * 1024 * 1024 * 1024).reader();
            let n = std::io::copy(&mut leitor, &mut f).map_err(|e| rede(e.to_string()))?;
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
    let (a, t) = (corte(limpar(autor), 60), corte(limpar(titulo), 120));
    let base = match (a.is_empty(), t.is_empty()) {
        (_, true) if a.is_empty() => "Sem título".to_string(),
        (_, true) => a,
        (true, false) => t,
        (false, false) => format!("{a} - {t}"),
    };
    format!("{base}.{extensao}")
}
