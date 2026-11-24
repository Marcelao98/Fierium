//! Escrever obra e edição a partir dos metadados lidos.
use super::chave::{chave_do_autor, chave_do_titulo};
use crate::metadados::Metadados;
use crate::{bd, matiz_do_titulo};
use fierium_core::ErroFierium;
use rusqlite::{params, Connection};

pub(crate) fn primeiro_autor(m: &Metadados) -> String {
    m.criadores.first().map(|p| p.nome.clone()).unwrap_or_default()
}

/// As chaves de junção (título, primeiro autor) de um conjunto de metadados.
pub(crate) fn chaves(m: &Metadados) -> (String, String) {
    (chave_do_titulo(&m.titulo), chave_do_autor(&primeiro_autor(m)))
}

pub(crate) fn criadores_json(m: &Metadados) -> Option<String> {
    (!m.criadores.is_empty()).then(|| serde_json::to_string(&m.criadores).unwrap_or_default())
}

pub(crate) fn inserir_obra(c: &Connection, id: &str, m: &Metadados, quando: i64) -> Result<(), ErroFierium> {
    c.execute(
        "INSERT INTO obras (id, titulo, autor, matiz, adicionada_em, serie, volume, ano, criadores)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            id,
            m.titulo,
            primeiro_autor(m),
            matiz_do_titulo(&m.titulo),
            quando,
            m.serie.as_ref().map(|s| s.nome.clone()),
            m.serie.as_ref().map(|s| s.volume),
            m.ano,
            criadores_json(m)
        ],
    )
    .map_err(bd)?;
    Ok(())
}

pub(crate) fn inserir_edicao(
    c: &Connection,
    id: &str,
    obra: &str,
    formato: &str,
    m: &Metadados,
    capa: Option<&std::path::Path>,
    quando: i64,
) -> Result<(), ErroFierium> {
    let (kt, ka) = chaves(m);
    c.execute(
        "INSERT INTO edicoes (id, obra_id, formato, chave_titulo, chave_autor, criada_em, meta, capa, meta_v)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,1)",
        params![
            id,
            obra,
            formato,
            kt,
            ka,
            quando,
            serde_json::to_string(m).unwrap_or_default(),
            capa.map(|p| p.to_string_lossy().into_owned())
        ],
    )
    .map_err(bd)?;
    Ok(())
}

/// Uma edição nova numa obra que já existe: só preenche o que a obra não tinha (a obra editada à mão fica como está).
pub(crate) fn completar_obra(c: &Connection, obra: &str, m: &Metadados) -> Result<(), ErroFierium> {
    c.execute(
        "UPDATE obras SET
            autor = CASE WHEN autor = '' THEN ?2 ELSE autor END,
            criadores = COALESCE(criadores, ?3),
            ano = COALESCE(ano, ?4),
            serie = CASE WHEN serie IS NULL THEN ?5 ELSE serie END,
            volume = CASE WHEN serie IS NULL THEN ?6 ELSE volume END
         WHERE id = ?1 AND editada = 0",
        params![
            obra,
            primeiro_autor(m),
            criadores_json(m),
            m.ano,
            m.serie.as_ref().map(|s| s.nome.clone()),
            m.serie.as_ref().map(|s| s.volume)
        ],
    )
    .map_err(bd)?;
    Ok(())
}
