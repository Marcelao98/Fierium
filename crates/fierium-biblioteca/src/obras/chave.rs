//! A chave que reconhece a mesma obra: título + primeiro autor, sem acento, sem artigo, sem pontuação.
use crate::bd;
use crate::normalizar;
use fierium_core::ErroFierium;
use rusqlite::{params, Connection, OptionalExtension};

const ARTIGOS: &[&str] = &[
    "o", "a", "os", "as", "um", "uma", "uns", "umas", "the", "an", "el", "la", "los", "las",
];

/// Minúsculas, sem acento, sem pontuação, um espaço só entre as palavras.
fn palavras(s: &str) -> Vec<String> {
    normalizar(s)
        .split(|c: char| !c.is_alphanumeric())
        .filter(|p| !p.is_empty())
        .map(String::from)
        .collect()
}

/// A chave do título: "O Alienista", "Alienista, O" e "o alienista!" dão a mesma ("alienista").
pub fn chave_do_titulo(titulo: &str) -> String {
    let t = normalizar(titulo);
    // artigo no fim, depois da vírgula ("Alienista, O")
    let t = match t.rsplit_once(',') {
        Some((resto, fim)) if ARTIGOS.contains(&fim.trim()) && !resto.trim().is_empty() => resto.to_string(),
        _ => t,
    };
    let mut p = palavras(&t);
    if p.len() > 1 && ARTIGOS.contains(&p[0].as_str()) {
        p.remove(0);
    }
    p.join(" ")
}

/// A chave do autor (o primeiro criador): só normaliza.
pub fn chave_do_autor(autor: &str) -> String {
    palavras(autor).join(" ")
}

/// A obra que já tem uma edição com esta chave (edições separadas à mão não contam: a escolha da pessoa vale).
/// Mesmo título e mesmo autor = mesma obra. Se um dos lados não tem autor, vale o título, desde que aponte pra uma
/// obra só (dois livros diferentes com o mesmo título não são misturados).
pub(crate) fn achar_obra(
    c: &Connection,
    titulo: &str,
    autor: &str,
    excluir: &str,
) -> Result<Option<String>, ErroFierium> {
    if titulo.is_empty() {
        return Ok(None);
    }
    let exata: Option<String> = c
        .query_row(
            "SELECT obra_id FROM edicoes WHERE separada = 0 AND chave_titulo = ?1 AND chave_autor = ?2
             AND obra_id != ?3 ORDER BY criada_em, id LIMIT 1",
            params![titulo, autor, excluir],
            |r| r.get(0),
        )
        .optional()
        .map_err(bd)?;
    if exata.is_some() {
        return Ok(exata);
    }
    let sql = if autor.is_empty() {
        "SELECT DISTINCT obra_id FROM edicoes WHERE separada = 0 AND chave_titulo = ?1 AND obra_id != ?2"
    } else {
        "SELECT DISTINCT obra_id FROM edicoes WHERE separada = 0 AND chave_titulo = ?1 AND chave_autor = ''
         AND obra_id != ?2"
    };
    let mut st = c.prepare(sql).map_err(bd)?;
    let mut achadas: Vec<String> = st
        .query_map(params![titulo, excluir], |r| r.get(0))
        .map_err(bd)?
        .collect::<Result<_, _>>()
        .map_err(bd)?;
    Ok(if achadas.len() == 1 { achadas.pop() } else { None })
}
