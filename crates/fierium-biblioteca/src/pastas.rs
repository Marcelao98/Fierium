//! As pastas que a pessoa escolheu pra biblioteca.
use crate::{agora, bd, Biblioteca};
use fierium_core::ErroFierium;
use rusqlite::params;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub(crate) fn expandir_til(caminho: &str) -> PathBuf {
    let c = caminho.trim();
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).ok();
    match (c, home) {
        ("~", Some(h)) => PathBuf::from(h),
        (c, Some(h)) if c.starts_with("~/") || c.starts_with("~\\") => PathBuf::from(h).join(&c[2..]),
        (c, _) => PathBuf::from(c),
    }
}

impl Biblioteca {
    pub fn pastas_listar(&self) -> Result<Value, ErroFierium> {
        let mut st = self
            .bd
            .prepare(
                "SELECT p.caminho, (SELECT COUNT(*) FROM arquivos a WHERE a.pasta = p.caminho AND a.existe = 1)
                 FROM pastas p ORDER BY p.adicionada_em, p.caminho",
            )
            .map_err(bd)?;
        let linhas = st
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
            .map_err(bd)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(bd)?;
        Ok(Value::Array(
            linhas
                .into_iter()
                .map(|(c, n)| json!({ "caminho": c, "existe": Path::new(&c).is_dir(), "arquivos": n }))
                .collect(),
        ))
    }

    pub fn pastas_adicionar(&self, caminho: &str) -> Result<Value, ErroFierium> {
        let p = expandir_til(caminho);
        if !p.is_dir() {
            return Err(ErroFierium::argumento(
                "caminho",
                format!("\"{}\" não é uma pasta que existe", caminho.trim()),
            ));
        }
        let p = p.canonicalize().map_err(|e| ErroFierium::de_io(p.display(), e))?;
        self.bd
            .execute(
                "INSERT OR IGNORE INTO pastas (caminho, adicionada_em) VALUES (?1, ?2)",
                params![p.to_string_lossy(), agora()],
            )
            .map_err(bd)?;
        self.pastas_listar()
    }

    pub fn pastas_remover(&self, caminho: &str) -> Result<Value, ErroFierium> {
        let p = expandir_til(caminho);
        let c = p.canonicalize().unwrap_or(p).to_string_lossy().into_owned();
        let n = self
            .bd
            .execute("DELETE FROM pastas WHERE caminho = ?1", params![c])
            .map_err(bd)?;
        if n == 0 {
            return Err(ErroFierium::NaoEncontrado(format!("pasta {}", caminho.trim())));
        }
        // os livros dela somem da estante (e voltam, com o progresso, se a pasta voltar)
        self.bd
            .execute("UPDATE arquivos SET existe = 0 WHERE pasta = ?1", params![c])
            .map_err(bd)?;
        self.pastas_listar()
    }
}
