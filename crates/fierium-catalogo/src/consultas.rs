//! Ler o catálogo: as fontes, um item e a busca (FTS5 + filtros).
use crate::banco::Catalogo;
use crate::bd;
use fierium_core::ErroFierium;
use rusqlite::{params, params_from_iter, OptionalExtension};
use serde_json::{json, Value};

impl Catalogo {
    pub fn fontes(&self) -> Result<Value, ErroFierium> {
        let mut st = self.bd.prepare("SELECT id FROM fontes ORDER BY nome").map_err(bd)?;
        let ids: Vec<String> = st
            .query_map([], |r| r.get(0))
            .map_err(bd)?
            .collect::<Result<_, _>>()
            .map_err(bd)?;
        let v = ids.iter().map(|i| self.fonte(i)).collect::<Result<Vec<_>, _>>()?;
        Ok(Value::Array(v))
    }

    pub fn fonte(&self, id: &str) -> Result<Value, ErroFierium> {
        self.bd
            .query_row(
                "SELECT f.id, f.nome, f.ligada, f.atualizada_em, (SELECT COUNT(*) FROM itens WHERE fonte = f.id)
                 FROM fontes f WHERE f.id = ?1",
                params![id],
                |r| {
                    let mut o = json!({ "id": r.get::<_, String>(0)?, "nome": r.get::<_, String>(1)?,
                        "ligada": r.get::<_, i64>(2)? != 0, "itens": r.get::<_, i64>(4)? });
                    if let Some(t) = r.get::<_, Option<i64>>(3)? {
                        o["atualizadaEm"] = json!(t);
                    }
                    Ok(o)
                },
            )
            .optional()
            .map_err(bd)?
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("fonte {id}")))
    }

    /// Quantos itens o catálogo todo tem (0 = nunca atualizado).
    pub fn total_de_itens(&self) -> Result<i64, ErroFierium> {
        self.bd
            .query_row("SELECT COUNT(*) FROM itens", [], |r| r.get(0))
            .map_err(bd)
    }

    pub fn item(&self, id: &str) -> Result<Value, ErroFierium> {
        let base = self
            .bd
            .query_row(
                "SELECT id, tipo, titulo, idioma, ano, sinopse, serie_nome, serie_volume, capa FROM itens WHERE id = ?1",
                params![id],
                |r| {
                    let mut o = json!({ "id": r.get::<_, String>(0)?, "tipo": r.get::<_, String>(1)?,
                        "titulo": r.get::<_, String>(2)?, "idioma": r.get::<_, String>(3)? });
                    if let Some(a) = r.get::<_, Option<i64>>(4)? {
                        o["ano"] = json!(a);
                    }
                    if let Some(s) = r.get::<_, Option<String>>(5)? {
                        o["sinopse"] = json!(s);
                    }
                    if let (Some(n), Some(v)) = (r.get::<_, Option<String>>(6)?, r.get::<_, Option<i64>>(7)?) {
                        o["serie"] = json!({ "nome": n, "volume": v });
                    }
                    if let Some(c) = r.get::<_, Option<String>>(8)? {
                        o["capa"] = json!(c);
                    }
                    Ok(o)
                },
            )
            .optional()
            .map_err(bd)?
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("item do catálogo {id}")))?;
        let mut o = base;
        o["pessoas"] = self.coluna_json(
            "SELECT nome, papel FROM pessoas WHERE item = ?1 ORDER BY ordem",
            id,
            |r| Ok(json!({ "nome": r.get::<_, String>(0)?, "papel": r.get::<_, String>(1)? })),
        )?;
        o["assuntos"] = self.coluna_json("SELECT assunto FROM assuntos WHERE item = ?1", id, |r| {
            Ok(json!(r.get::<_, String>(0)?))
        })?;
        o["ofertas"] = self.coluna_json(
            "SELECT fonte, formato, url, licenca, tamanho FROM ofertas WHERE item = ?1 ORDER BY rowid",
            id,
            |r| {
                let mut x = json!({ "fonte": r.get::<_, String>(0)?, "formato": r.get::<_, String>(1)?,
                    "url": r.get::<_, String>(2)?, "licenca": r.get::<_, String>(3)? });
                if let Some(t) = r.get::<_, Option<i64>>(4)? {
                    x["tamanho"] = json!(t);
                }
                Ok(x)
            },
        )?;
        Ok(o)
    }

    fn coluna_json(
        &self,
        sql: &str,
        id: &str,
        f: impl Fn(&rusqlite::Row) -> rusqlite::Result<Value>,
    ) -> Result<Value, ErroFierium> {
        let mut st = self.bd.prepare(sql).map_err(bd)?;
        let v: Vec<Value> = st
            .query_map(params![id], f)
            .map_err(bd)?
            .collect::<Result<_, _>>()
            .map_err(bd)?;
        Ok(Value::Array(v))
    }

    /// Busca: texto (título, pessoas e assuntos; sem acento, por prefixo) + filtros. `{ itens, total }`.
    pub fn buscar(&self, filtro: &Value) -> Result<Value, ErroFierium> {
        let texto = filtro["texto"].as_str().unwrap_or("");
        let autor = filtro["autor"].as_str().unwrap_or("");
        let limite = filtro["limite"].as_i64().unwrap_or(50).clamp(1, 500);
        let desloc = filtro["deslocamento"].as_i64().unwrap_or(0).max(0);
        let mut casa: Vec<String> = Vec::new();
        let t = fts_termos(texto, None);
        if !t.is_empty() {
            casa.push(t);
        }
        let a = fts_termos(autor, Some("pessoas"));
        if !a.is_empty() {
            casa.push(a);
        }
        // assunto ou estante, como frase ("Science-Fiction & Fantasy" casa com a estante de mesmo nome)
        let frase: Vec<&str> = filtro["assunto"]
            .as_str()
            .unwrap_or("")
            .split(|c: char| !c.is_alphanumeric())
            .filter(|p| !p.is_empty())
            .collect();
        if !frase.is_empty() {
            casa.push(format!("assuntos : \"{}\"", frase.join(" ")));
        }
        let mut onde: Vec<String> = Vec::new();
        let mut args: Vec<String> = Vec::new();
        // sem texto digitado (coleções, "tudo em português"): na ordem em que entraram na fonte. No Gutenberg os
        // números baixos são os clássicos mais conhecidos, então a linha começa pelo que a pessoa reconhece.
        const POR_NUMERO: &str = "CAST(substr(i.id, instr(i.id, ':') + 1) AS INTEGER), i.titulo COLLATE NOCASE";
        let (from, ordem) = if casa.is_empty() {
            ("itens i".to_string(), POR_NUMERO)
        } else if texto.trim().is_empty() {
            args.push(casa.join(" AND "));
            onde.push("busca MATCH ?1".into());
            ("busca JOIN itens i ON i.id = busca.item".to_string(), POR_NUMERO)
        } else {
            args.push(casa.join(" AND "));
            onde.push("busca MATCH ?1".into());
            (
                "busca JOIN itens i ON i.id = busca.item".to_string(),
                "busca.rank, i.titulo COLLATE NOCASE",
            )
        };
        if let Some(l) = filtro["idioma"].as_str().filter(|s| !s.is_empty()) {
            args.push(l.to_lowercase());
            onde.push(format!("lower(i.idioma) = ?{}", args.len()));
        }
        if let Some(t) = filtro["tipo"].as_str().filter(|s| !s.is_empty()) {
            args.push(t.into());
            onde.push(format!("i.tipo = ?{}", args.len()));
        }
        let cond = if onde.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", onde.join(" AND "))
        };
        // só o MATCH (sem idioma nem tipo): contar direto no índice de busca, sem juntar com `itens`
        let so_busca = onde.len() == 1 && onde[0] == "busca MATCH ?1";
        let total: i64 = self
            .bd
            .query_row(
                &format!(
                    "SELECT COUNT(*) FROM {}{cond}",
                    if so_busca { "busca" } else { from.as_str() }
                ),
                params_from_iter(args.iter()),
                |r| r.get(0),
            )
            .map_err(bd)?;
        let mut st = self
            .bd
            .prepare(&format!(
                "SELECT i.id FROM {from}{cond} ORDER BY {ordem} LIMIT {limite} OFFSET {desloc}"
            ))
            .map_err(bd)?;
        let ids: Vec<String> = st
            .query_map(params_from_iter(args.iter()), |r| r.get(0))
            .map_err(bd)?
            .collect::<Result<_, _>>()
            .map_err(bd)?;
        let itens = ids.iter().map(|i| self.item(i)).collect::<Result<Vec<_>, _>>()?;
        Ok(json!({ "itens": itens, "total": total }))
    }
}

/// Transforma o que a pessoa digitou numa consulta FTS5 segura: cada palavra vira `"palavra"*` (prefixo), todas
/// precisam aparecer. Com `coluna`, a consulta vale só naquela coluna.
fn fts_termos(texto: &str, coluna: Option<&str>) -> String {
    let palavras: Vec<String> = texto
        .split(|c: char| !c.is_alphanumeric())
        .filter(|p| !p.is_empty())
        .map(|p| format!("\"{p}\"*"))
        .collect();
    if palavras.is_empty() {
        return String::new();
    }
    let q = palavras.join(" ");
    match coluna {
        Some(c) => format!("{c} : ({q})"),
        None => format!("{{titulo pessoas assuntos}} : ({q})"),
    }
}
