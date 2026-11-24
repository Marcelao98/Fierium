//! O interruptor de rede dos Ajustes (D30): desligado, nada sai do computador.
use crate::banco::Catalogo;
use crate::bd;
use fierium_core::ErroFierium;
use rusqlite::{params, OptionalExtension};

impl Catalogo {
    /// O interruptor de rede (Ajustes). Padrão: ligada.
    pub fn rede_permitida(&self) -> Result<bool, ErroFierium> {
        let v: Option<String> = self
            .bd
            .query_row("SELECT valor FROM config WHERE chave = 'rede'", [], |r| r.get(0))
            .optional()
            .map_err(bd)?;
        Ok(v.as_deref() != Some("0"))
    }

    pub fn rede_definir(&self, permitida: bool) -> Result<(), ErroFierium> {
        self.bd
            .execute(
                "INSERT INTO config (chave, valor) VALUES ('rede', ?1)
                 ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
                params![if permitida { "1" } else { "0" }],
            )
            .map_err(bd)?;
        Ok(())
    }

    /// Erro `SEM_REDE` (em português) quando a pessoa desligou a rede nos Ajustes.
    pub fn exigir_rede(&self, o_que: &str) -> Result<(), ErroFierium> {
        if self.rede_permitida()? {
            Ok(())
        } else {
            Err(ErroFierium::SemRede(format!(
                "A rede está desligada nos Ajustes, então não dá pra {o_que}. Ligue a rede e tente de novo."
            )))
        }
    }
}
