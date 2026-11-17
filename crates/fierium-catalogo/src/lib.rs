//! O catálogo público (D30): o que existe nos catálogos abertos, mesmo que a pessoa não tenha baixado. Fica num SQLite
//! **separado** da biblioteca (`catalogo.db`, descartável: se estragar, apaga e baixa de novo). Esquema genérico, pronto
//! pra mangá, HQ, revista e artigo. Sem Tauri: o `fierium-app` só chama isto. As respostas JSON têm o formato EXATO
//! dos tipos do contrato TypeScript (camelCase).
use fierium_core::ErroFierium;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

mod baixar;
pub mod gutenberg;

pub use baixar::{nome_do_arquivo, Baixador, BaixadorHttp, USER_AGENT};
pub use gutenberg::Gutenberg;

const VERSAO_BANCO: i64 = 1;

fn bd(e: rusqlite::Error) -> ErroFierium {
    ErroFierium::Banco(e.to_string())
}

pub fn agora() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Minúsculas e sem acento (pra comparar nomes fora do SQLite).
pub fn normalizar(s: &str) -> String {
    s.chars()
        .flat_map(char::to_lowercase)
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            'ñ' => 'n',
            c => c,
        })
        .collect()
}

#[derive(Debug, Clone, PartialEq)]
pub struct Pessoa {
    pub nome: String,
    /// "autor", "tradutor", "ilustrador", "narrador" ou "organizador"
    pub papel: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Oferta {
    pub fonte: String,
    pub formato: String,
    pub url: String,
    pub licenca: String,
    pub tamanho: Option<i64>,
}

/// Um item como a fonte o entrega, antes de entrar no banco.
#[derive(Debug, Clone, PartialEq)]
pub struct ItemNovo {
    /// o id dentro da fonte ("55752"); o id final é "<fonte>:<id>"
    pub id: String,
    pub tipo: String,
    pub titulo: String,
    pub idioma: String,
    pub ano: Option<i64>,
    pub sinopse: Option<String>,
    pub serie: Option<(String, i64)>,
    pub capa: Option<String>,
    pub pessoas: Vec<Pessoa>,
    pub assuntos: Vec<String>,
    /// (esquema, valor): isbn, gutenberg, openlibrary, wikidata, doi, anilist
    pub identificadores: Vec<(String, String)>,
    pub ofertas: Vec<Oferta>,
}

/// Um conector de catálogo (Gutenberg agora; Standard Ebooks, Wikisource, OPDS depois).
pub trait Fonte {
    fn id(&self) -> &'static str;
    fn nome(&self) -> &'static str;
    /// Baixa o catálogo da fonte (com cache em `cache`) e devolve os itens. Não mexe no banco.
    /// `aviso` recebe o andamento do download: (bytes, total quando o servidor diz).
    fn carregar(
        &self,
        baixador: &dyn Baixador,
        cache: &Path,
        aviso: &mut dyn FnMut(u64, Option<u64>),
    ) -> Result<Vec<ItemNovo>, ErroFierium>;
}

pub struct Catalogo {
    bd: Connection,
}

impl Catalogo {
    pub fn abrir(caminho_db: &Path) -> Result<Self, ErroFierium> {
        if let Some(pai) = caminho_db.parent() {
            std::fs::create_dir_all(pai).map_err(|e| ErroFierium::de_io(pai.display(), e))?;
        }
        let conexao = Connection::open(caminho_db).map_err(bd)?;
        conexao
            .execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
            .map_err(bd)?;
        let mut c = Self { bd: conexao };
        c.migrar()?;
        Ok(c)
    }

    fn migrar(&mut self) -> Result<(), ErroFierium> {
        let v: i64 = self.bd.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(bd)?;
        if v < 1 {
            self.bd
                .execute_batch(
                    "BEGIN;
                     CREATE TABLE itens (
                        id TEXT PRIMARY KEY, fonte TEXT NOT NULL, tipo TEXT NOT NULL, titulo TEXT NOT NULL,
                        idioma TEXT NOT NULL, ano INTEGER, sinopse TEXT, serie_nome TEXT, serie_volume INTEGER,
                        capa TEXT);
                     CREATE INDEX itens_fonte ON itens (fonte);
                     CREATE TABLE pessoas (
                        item TEXT NOT NULL REFERENCES itens(id), nome TEXT NOT NULL, papel TEXT NOT NULL,
                        ordem INTEGER NOT NULL);
                     CREATE INDEX pessoas_item ON pessoas (item);
                     CREATE TABLE assuntos (item TEXT NOT NULL REFERENCES itens(id), assunto TEXT NOT NULL);
                     CREATE INDEX assuntos_item ON assuntos (item);
                     CREATE TABLE identificadores (
                        item TEXT NOT NULL REFERENCES itens(id), esquema TEXT NOT NULL, valor TEXT NOT NULL);
                     CREATE INDEX identificadores_item ON identificadores (item);
                     CREATE INDEX identificadores_valor ON identificadores (esquema, valor);
                     CREATE TABLE ofertas (
                        item TEXT NOT NULL REFERENCES itens(id), fonte TEXT NOT NULL, formato TEXT NOT NULL,
                        url TEXT NOT NULL, licenca TEXT NOT NULL CHECK (length(licenca) > 0), tamanho INTEGER);
                     CREATE INDEX ofertas_item ON ofertas (item);
                     CREATE TABLE fontes (
                        id TEXT PRIMARY KEY, nome TEXT NOT NULL, ligada INTEGER NOT NULL DEFAULT 1,
                        atualizada_em INTEGER);
                     CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
                     CREATE VIRTUAL TABLE busca USING fts5(
                        item UNINDEXED, titulo, pessoas, assuntos, tokenize = 'unicode61 remove_diacritics 2');
                     PRAGMA user_version = 1;
                     COMMIT;",
                )
                .map_err(bd)?;
        }
        debug_assert_eq!(VERSAO_BANCO, 1);
        // as fontes que o Fierium conhece existem desde o começo (com 0 itens), pra dar pra atualizar à mão nos Ajustes
        self.bd
            .execute(
                "INSERT OR IGNORE INTO fontes (id, nome, ligada) VALUES ('gutenberg', 'Project Gutenberg', 1)",
                [],
            )
            .map_err(bd)?;
        Ok(())
    }

    // ---------- rede ----------

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

    // ---------- importar ----------

    /// Troca tudo o que veio de `fonte` pelos `itens`, numa transação só (se algo falhar, o catálogo antigo fica).
    pub fn importar(&mut self, fonte: &dyn Fonte, itens: &[ItemNovo]) -> Result<Value, ErroFierium> {
        self.importar_avisando(fonte, itens, &mut |_| {})
    }

    /// O mesmo, avisando quantos itens já entraram (a cada mil).
    pub fn importar_avisando(
        &mut self,
        fonte: &dyn Fonte,
        itens: &[ItemNovo],
        aviso: &mut dyn FnMut(usize),
    ) -> Result<Value, ErroFierium> {
        let fid = fonte.id();
        let tx = self.bd.transaction().map_err(bd)?;
        for t in ["pessoas", "assuntos", "identificadores", "ofertas"] {
            tx.execute(
                &format!("DELETE FROM {t} WHERE item IN (SELECT id FROM itens WHERE fonte = ?1)"),
                params![fid],
            )
            .map_err(bd)?;
        }
        tx.execute(
            "DELETE FROM busca WHERE item IN (SELECT id FROM itens WHERE fonte = ?1)",
            params![fid],
        )
        .map_err(bd)?;
        tx.execute("DELETE FROM itens WHERE fonte = ?1", params![fid])
            .map_err(bd)?;
        {
            let mut i_item = tx
                .prepare(
                    "INSERT OR REPLACE INTO itens (id, fonte, tipo, titulo, idioma, ano, sinopse, serie_nome,
                        serie_volume, capa) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                )
                .map_err(bd)?;
            let mut i_pes = tx
                .prepare("INSERT INTO pessoas (item, nome, papel, ordem) VALUES (?1,?2,?3,?4)")
                .map_err(bd)?;
            let mut i_ass = tx
                .prepare("INSERT INTO assuntos (item, assunto) VALUES (?1,?2)")
                .map_err(bd)?;
            let mut i_ide = tx
                .prepare("INSERT INTO identificadores (item, esquema, valor) VALUES (?1,?2,?3)")
                .map_err(bd)?;
            let mut i_ofe = tx
                .prepare("INSERT INTO ofertas (item, fonte, formato, url, licenca, tamanho) VALUES (?1,?2,?3,?4,?5,?6)")
                .map_err(bd)?;
            let mut i_bus = tx
                .prepare("INSERT INTO busca (item, titulo, pessoas, assuntos) VALUES (?1,?2,?3,?4)")
                .map_err(bd)?;
            for (feitos, it) in itens.iter().enumerate() {
                if feitos % 1000 == 0 {
                    aviso(feitos);
                }
                let id = format!("{fid}:{}", it.id);
                i_item
                    .execute(params![
                        id,
                        fid,
                        it.tipo,
                        it.titulo,
                        it.idioma,
                        it.ano,
                        it.sinopse,
                        it.serie.as_ref().map(|s| s.0.clone()),
                        it.serie.as_ref().map(|s| s.1),
                        it.capa
                    ])
                    .map_err(bd)?;
                for (n, p) in it.pessoas.iter().enumerate() {
                    i_pes.execute(params![id, p.nome, p.papel, n as i64]).map_err(bd)?;
                }
                for a in &it.assuntos {
                    i_ass.execute(params![id, a]).map_err(bd)?;
                }
                for (e, v) in &it.identificadores {
                    i_ide.execute(params![id, e, v]).map_err(bd)?;
                }
                for o in &it.ofertas {
                    i_ofe
                        .execute(params![id, o.fonte, o.formato, o.url, o.licenca, o.tamanho])
                        .map_err(bd)?;
                }
                let pessoas = it
                    .pessoas
                    .iter()
                    .map(|p| p.nome.as_str())
                    .collect::<Vec<_>>()
                    .join(" ; ");
                i_bus
                    .execute(params![id, it.titulo, pessoas, it.assuntos.join(" ; ")])
                    .map_err(bd)?;
            }
        }
        tx.execute(
            "INSERT INTO fontes (id, nome, ligada, atualizada_em) VALUES (?1,?2,1,?3)
             ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, atualizada_em = excluded.atualizada_em",
            params![fid, fonte.nome(), agora()],
        )
        .map_err(bd)?;
        tx.commit().map_err(bd)?;
        self.fonte(fid)
    }

    // ---------- ler ----------

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
        let total: i64 = self
            .bd
            .query_row(
                &format!("SELECT COUNT(*) FROM {from}{cond}"),
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

#[cfg(test)]
pub mod testes;
