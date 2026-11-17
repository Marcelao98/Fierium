//! Sugestões de dados certos pra uma obra: o que veio de dentro de cada arquivo, o deduzido do nome e, se a rede
//! estiver permitida, a busca na Open Library (só título, autor e ISBN saem do computador; resposta guardada em cache).
use super::metadados::{self, Metadados};
use super::obras::{chave_do_autor, chave_do_titulo};
use super::{agora, bd, Biblioteca};
use fierium_core::ErroFierium;
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

const OPEN_LIBRARY: &str = "https://openlibrary.org/search.json";
const CACHE_MS: i64 = 30 * 24 * 3600 * 1000;

fn codificar(s: &str) -> String {
    let mut o = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) {
            o.push(b as char);
        } else {
            o.push_str(&format!("%{b:02X}"));
        }
    }
    o
}

/// O pedido de verdade (só é chamado com a rede permitida).
fn buscar_http(url: &str) -> Result<String, String> {
    let agente: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(8)))
        .user_agent(format!(
            "Fierium/{} (+https://github.com/Marcelao98/Fierium)",
            env!("CARGO_PKG_VERSION")
        ))
        .build()
        .into();
    let mut r = agente.get(url).call().map_err(|e| e.to_string())?;
    r.body_mut().read_to_string().map_err(|e| e.to_string())
}

fn sugestao(id: String, origem: &str, m: &Metadados, confianca: f64) -> Value {
    let mut s = json!({
        "id": id,
        "origem": origem,
        "titulo": m.titulo,
        "pessoas": m.criadores,
        "confianca": confianca,
    });
    if let Some(a) = m.ano {
        s["ano"] = json!(a);
    }
    if let Some(se) = &m.serie {
        s["serie"] = json!({ "nome": se.nome, "volume": se.volume });
    }
    s
}

/// Lê a resposta da Open Library e devolve as sugestões (já com a confiança). Separado pra testar sem rede.
pub(crate) fn da_open_library(resposta: &str, titulo: &str, autor: &str, por_isbn: bool) -> Vec<Value> {
    let Ok(v) = serde_json::from_str::<Value>(resposta) else {
        return vec![];
    };
    let (kt, ka) = (chave_do_titulo(titulo), chave_do_autor(autor));
    v["docs"]
        .as_array()
        .map(|d| d.iter().take(5).collect::<Vec<_>>())
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .filter_map(|(i, d)| {
            let t = d["title"].as_str()?.trim().to_string();
            let pessoas: Vec<_> = d["author_name"]
                .as_array()
                .map(|a| a.iter().filter_map(|x| x.as_str()).map(String::from).collect())
                .unwrap_or_default();
            let mut c: f64 = if por_isbn { 0.9 } else { 0.4 };
            if chave_do_titulo(&t) == kt && !kt.is_empty() {
                c += 0.3;
            }
            if pessoas
                .first()
                .is_some_and(|p| chave_do_autor(&metadados::nome_natural(p)) == ka)
                && !ka.is_empty()
            {
                c += 0.1;
            }
            let m = Metadados {
                titulo: t,
                criadores: pessoas
                    .iter()
                    .map(|n| metadados::Pessoa {
                        nome: n.clone(),
                        papel: "autor".into(),
                    })
                    .collect(),
                ano: d["first_publish_year"].as_i64().map(|a| a as i32),
                ..Default::default()
            };
            Some(sugestao(
                format!("openlibrary:{i}"),
                "Open Library",
                &m,
                (c.min(0.95) * 100.0).round() / 100.0,
            ))
        })
        .collect()
}

impl Biblioteca {
    pub fn obra_sugestoes(&self, id: &str, permitida: bool) -> Result<Value, ErroFierium> {
        self.obra_sugestoes_com(id, permitida, &buscar_http)
    }

    /// `busca` recebe a URL e devolve o corpo da resposta (nos testes, uma resposta pronta).
    pub fn obra_sugestoes_com(
        &self,
        id: &str,
        permitida: bool,
        busca: &dyn Fn(&str) -> Result<String, String>,
    ) -> Result<Value, ErroFierium> {
        let obra = self.uma(id)?;
        let mut lista: Vec<Value> = Vec::new();
        let mut isbn = String::new();
        for e in &obra.edicoes {
            let Some((caminho, nome, _)) = self.arquivo_da_edicao(&e.id)? else {
                continue;
            };
            let (dentro, _) = metadados::ler_do_arquivo(&caminho, &e.formato, false);
            if isbn.is_empty() {
                isbn = dentro.isbn.clone();
            }
            if !metadados::titulo_lixo(&dentro.titulo) {
                let rotulo = format!("Dentro do arquivo ({})", e.formato.to_uppercase());
                lista.push(sugestao(format!("arquivo:{}", e.id), &rotulo, &dentro, 0.9));
            }
            let pelo = metadados::pelo_nome(&nome);
            if !pelo.titulo.is_empty() {
                lista.push(sugestao(format!("nome:{}", e.id), "Nome do arquivo", &pelo, 0.5));
            }
        }
        if permitida {
            let url = if !isbn.is_empty() {
                Some((
                    format!(
                        "{OPEN_LIBRARY}?q=isbn:{}&limit=3&fields=title,author_name,first_publish_year",
                        codificar(&isbn)
                    ),
                    true,
                ))
            } else if !obra.titulo.is_empty() {
                let mut u = format!(
                    "{OPEN_LIBRARY}?title={}&limit=5&fields=title,author_name,first_publish_year",
                    codificar(&obra.titulo)
                );
                if !obra.autor.is_empty() {
                    u.push_str(&format!("&author={}", codificar(&obra.autor)));
                }
                Some((u, false))
            } else {
                None
            };
            if let Some((url, por_isbn)) = url {
                match self.com_cache(&url, busca) {
                    Ok(corpo) => lista.extend(da_open_library(&corpo, &obra.titulo, &obra.autor, por_isbn)),
                    Err(e) => tracing::warn!("sugestões: Open Library indisponível: {e}"),
                }
            }
        }
        // iguais (mesmo título, pessoas, ano e série): fica a de maior confiança
        let mut unicas: Vec<Value> = Vec::new();
        for s in lista {
            let chave = |x: &Value| {
                (
                    x["titulo"].clone(),
                    x["pessoas"].clone(),
                    x["ano"].clone(),
                    x["serie"].clone(),
                )
            };
            match unicas.iter_mut().find(|u| chave(u) == chave(&s)) {
                Some(u) => {
                    if s["confianca"].as_f64() > u["confianca"].as_f64() {
                        *u = s;
                    }
                }
                None => unicas.push(s),
            }
        }
        unicas.sort_by(|a, b| {
            b["confianca"]
                .as_f64()
                .partial_cmp(&a["confianca"].as_f64())
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let tx = self.bd.unchecked_transaction().map_err(bd)?;
        tx.execute("DELETE FROM sugestoes WHERE obra_id = ?1", params![id])
            .map_err(bd)?;
        for s in &unicas {
            tx.execute(
                "INSERT OR REPLACE INTO sugestoes (obra_id, id, json) VALUES (?1,?2,?3)",
                params![id, s["id"].as_str().unwrap_or(""), s.to_string()],
            )
            .map_err(bd)?;
        }
        tx.commit().map_err(bd)?;
        Ok(Value::Array(unicas))
    }

    fn com_cache(&self, url: &str, busca: &dyn Fn(&str) -> Result<String, String>) -> Result<String, String> {
        let agora_ = agora();
        let guardada: Option<(String, i64)> = self
            .bd
            .query_row(
                "SELECT resposta, em FROM cache_rede WHERE consulta = ?1",
                params![url],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some((r, em)) = guardada {
            if agora_ - em < CACHE_MS {
                return Ok(r);
            }
        }
        let corpo = busca(url)?;
        self.bd
            .execute(
                "INSERT OR REPLACE INTO cache_rede (consulta, resposta, em) VALUES (?1,?2,?3)",
                params![url, corpo, agora_],
            )
            .map_err(|e| e.to_string())?;
        Ok(corpo)
    }

    /// Aplica uma sugestão que `obra_sugestoes` devolveu (vale como edição à mão: a varredura não desfaz).
    pub fn obra_aplicar_sugestao(&self, id: &str, sugestao_id: &str) -> Result<Value, ErroFierium> {
        let j: Option<String> = self
            .bd
            .query_row(
                "SELECT json FROM sugestoes WHERE obra_id = ?1 AND id = ?2",
                params![id, sugestao_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(bd)?;
        let s: Value = serde_json::from_str(&j.ok_or_else(|| {
            ErroFierium::NaoEncontrado(format!("sugestão {sugestao_id} (peça as sugestões de novo)"))
        })?)
        .map_err(|e| ErroFierium::Banco(e.to_string()))?;
        let mut a = json!({
            "id": id,
            "titulo": s["titulo"],
            "autores": s["pessoas"].as_array().map(|p| p.iter().map(|x| x["nome"].clone()).collect::<Vec<_>>()).unwrap_or_default(),
        });
        if let Some(y) = s.get("ano") {
            a["ano"] = y.clone();
        }
        if let Some(se) = s.get("serie") {
            a["serie"] = se.clone();
        }
        self.obra_editar(&a)
    }
}
