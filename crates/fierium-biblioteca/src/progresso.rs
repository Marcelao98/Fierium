//! Abrir uma edição, salvar o progresso de leitura e o estado/favorita da obra.
use crate::banco::Biblioteca;
use crate::{agora, bd, url_do_arquivo, LIDA};
use fierium_core::ErroFierium;
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

impl Biblioteca {
    pub fn obra_atualizar(&self, id: &str, favorita: Option<bool>, estado: Option<&str>) -> Result<Value, ErroFierium> {
        self.uma(id)?;
        if let Some(e) = estado {
            if !["nao-lida", "lendo", "lida", "deixada"].contains(&e) {
                return Err(ErroFierium::argumento("estado", format!("estado desconhecido: {e}")));
            }
            self.bd
                .execute("UPDATE obras SET estado = ?2 WHERE id = ?1", params![id, e])
                .map_err(bd)?;
            if e == "lida" {
                self.bd
                    .execute(
                        "UPDATE obras SET terminada_em = COALESCE(terminada_em, ?2) WHERE id = ?1",
                        params![id, agora()],
                    )
                    .map_err(bd)?;
            }
        }
        if let Some(f) = favorita {
            self.bd
                .execute("UPDATE obras SET favorita = ?2 WHERE id = ?1", params![id, f as i64])
                .map_err(bd)?;
        }
        self.obra_obter(id)
    }

    pub fn edicao_abrir(&self, edicao_id: &str) -> Result<Value, ErroFierium> {
        // a edição abre por qualquer cópia dela que esteja no disco
        let r: Option<(String, String, i64)> = self
            .bd
            .query_row(
                "SELECT id, formato, tamanho FROM arquivos WHERE edicao_id = ?1 AND existe = 1
                 ORDER BY caminho_rel, id LIMIT 1",
                params![edicao_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()
            .map_err(bd)?;
        let (arquivo, formato, tamanho) =
            r.ok_or_else(|| ErroFierium::NaoEncontrado(format!("edição {edicao_id} (o arquivo sumiu?)")))?;
        Ok(json!({
            "tipo": "arquivo",
            "edicaoId": edicao_id,
            "formato": formato,
            "url": url_do_arquivo(&arquivo),
            "tamanho": tamanho,
        }))
    }

    pub fn progresso_salvar(&self, edicao_id: &str, posicao: &str, fracao: f64) -> Result<(), ErroFierium> {
        if !(0.0..=1.0).contains(&fracao) {
            return Err(ErroFierium::argumento("fracao", "tem que ficar entre 0 e 1"));
        }
        let existe: bool = self
            .bd
            .query_row("SELECT 1 FROM edicoes WHERE id = ?1", params![edicao_id], |_| Ok(()))
            .optional()
            .map_err(bd)?
            .is_some();
        if !existe {
            return Err(ErroFierium::NaoEncontrado(format!("edição {edicao_id}")));
        }
        let t = agora();
        self.bd
            .execute(
                "INSERT INTO progresso (edicao_id, posicao, fracao, quando) VALUES (?1,?2,?3,?4)
                 ON CONFLICT(edicao_id) DO UPDATE SET posicao=?2, fracao=?3, quando=?4",
                params![edicao_id, posicao, fracao, t],
            )
            .map_err(bd)?;
        if fracao >= LIDA {
            self.bd
                .execute(
                    "UPDATE obras SET estado='lida', ultima_leitura=?2, terminada_em=COALESCE(terminada_em, ?2)
                     WHERE id = (SELECT obra_id FROM edicoes WHERE id = ?1)",
                    params![edicao_id, t],
                )
                .map_err(bd)?;
        } else {
            self.bd
                .execute(
                    "UPDATE obras SET estado='lendo', ultima_leitura=?2
                     WHERE id = (SELECT obra_id FROM edicoes WHERE id = ?1)",
                    params![edicao_id, t],
                )
                .map_err(bd)?;
        }
        Ok(())
    }
}
