//! As capas extraídas e as capas escolhidas à mão.
use crate::banco::Biblioteca;
use crate::{bd, metadados};
use fierium_core::ErroFierium;
use rusqlite::params;
use std::path::PathBuf;

impl Biblioteca {
    /// As capas extraídas que existem no disco, por id de edição, pro protocolo `fierium://…/capa/<id>`.
    pub fn capas_existentes(&self) -> Result<Vec<(String, PathBuf)>, ErroFierium> {
        let mut st = self
            .bd
            .prepare("SELECT id, capa FROM edicoes WHERE capa IS NOT NULL")
            .map_err(bd)?;
        let v: Vec<(String, String)> = st
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(bd)?
            .collect::<Result<_, _>>()
            .map_err(bd)?;
        Ok(v.into_iter()
            .map(|(i, c)| (i, PathBuf::from(c)))
            .filter(|(_, c)| c.is_file())
            .collect())
    }

    /// Guarda a capa desenhada pela interface (a 1ª página do PDF) e a registra na edição. Só imagem WebP/PNG/JPEG
    /// de tamanho razoável; o arquivo vai pra pasta de capas, com o nome da impressão (some junto com o cache).
    pub fn capa_salvar(&self, edicao_id: &str, bytes: &[u8]) -> Result<PathBuf, ErroFierium> {
        const MAX: usize = 2 * 1024 * 1024;
        let ext = if bytes.len() > 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
            "webp"
        } else if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
            "png"
        } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
            "jpg"
        } else {
            return Err(ErroFierium::Argumento {
                campo: "imagem".into(),
                motivo: "a capa precisa ser uma imagem WebP, PNG ou JPEG".into(),
            });
        };
        if bytes.len() > MAX {
            return Err(ErroFierium::Argumento {
                campo: "imagem".into(),
                motivo: "a capa passa de 2 MB".into(),
            });
        }
        let (_, _, impressao) = self
            .arquivo_da_edicao(edicao_id)?
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("edição {edicao_id}")))?;
        let capa = metadados::Capa {
            bytes: bytes.to_vec(),
            ext,
        };
        let caminho = metadados::gravar_capa(&self.capas, &impressao, &capa).ok_or_else(|| {
            ErroFierium::de_io(
                self.capas.display(),
                std::io::Error::other("não consegui gravar a capa no cache"),
            )
        })?;
        self.bd
            .execute(
                "UPDATE edicoes SET capa = ?2 WHERE id = ?1",
                params![edicao_id, caminho.to_string_lossy().into_owned()],
            )
            .map_err(bd)?;
        Ok(caminho)
    }
}
