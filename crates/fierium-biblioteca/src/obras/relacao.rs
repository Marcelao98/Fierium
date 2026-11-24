//! O que é pessoal na obra (estado, favorita, datas) e como somar quando duas obras viram uma.
use crate::bd;
use fierium_core::ErroFierium;
use rusqlite::{params, Connection, OptionalExtension};

/// O que é pessoal na obra (pra somar quando duas viram uma).
pub(crate) struct Relacao {
    pub(crate) estado: String,
    pub(crate) favorita: bool,
    pub(crate) adicionada_em: i64,
    pub(crate) ultima_leitura: Option<i64>,
    pub(crate) terminada_em: Option<i64>,
}

pub(crate) fn ler_relacao(c: &Connection, tabela: &str, id: &str) -> Result<Relacao, ErroFierium> {
    c.query_row(
        &format!("SELECT estado, favorita, adicionada_em, ultima_leitura, terminada_em FROM {tabela} WHERE id = ?1"),
        params![id],
        |r| {
            Ok(Relacao {
                estado: r.get(0)?,
                favorita: r.get::<_, i64>(1)? != 0,
                adicionada_em: r.get(2)?,
                ultima_leitura: r.get(3)?,
                terminada_em: r.get(4)?,
            })
        },
    )
    .optional()
    .map_err(bd)?
    .ok_or_else(|| ErroFierium::NaoEncontrado(format!("obra {id}")))
}

/// Soma a relação de uma obra que vai sumir na que fica: favorita se uma era, a data mais antiga de entrada, a
/// leitura mais recente (e o estado de quem foi lida por último).
pub(crate) fn absorver_relacao(c: &Connection, alvo: &str, outra: &Relacao) -> Result<(), ErroFierium> {
    let a = ler_relacao(c, "obras", alvo)?;
    let outra_mais_recente = outra.ultima_leitura > a.ultima_leitura;
    let estado = if outra_mais_recente || (a.estado == "nao-lida" && a.ultima_leitura == outra.ultima_leitura) {
        &outra.estado
    } else {
        &a.estado
    };
    c.execute(
        "UPDATE obras SET estado = ?2, favorita = ?3, adicionada_em = ?4, ultima_leitura = ?5, terminada_em = ?6
         WHERE id = ?1",
        params![
            alvo,
            estado,
            (a.favorita || outra.favorita) as i64,
            a.adicionada_em.min(outra.adicionada_em),
            a.ultima_leitura.max(outra.ultima_leitura),
            a.terminada_em.max(outra.terminada_em),
        ],
    )
    .map_err(bd)?;
    Ok(())
}
