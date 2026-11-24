//! A busca (Ctrl+K) e o "eco" do limiar.
use crate::banco::Biblioteca;
use crate::marcacoes::DIA_MS;
use crate::normalizar;
use fierium_core::ErroFierium;
use serde_json::{json, Value};

impl Biblioteca {
    /// Ctrl+K: obras (título/autor), autores e marcações (trecho/nota), sem acento, todas as palavras.
    pub fn busca_tudo(&self, consulta: &str) -> Result<Value, ErroFierium> {
        let busca = normalizar(consulta);
        let palavras: Vec<&str> = busca.split_whitespace().collect();
        if palavras.is_empty() {
            return Ok(json!([]));
        }
        let combina = |s: &str| {
            let alvo = normalizar(s);
            palavras.iter().all(|p| alvo.contains(p))
        };
        let mut obras = self.todas(true)?;
        obras.sort_by_cached_key(|o| normalizar(&o.titulo));
        let mut r: Vec<Value> = Vec::new();
        for o in obras
            .iter()
            .filter(|o| combina(&format!("{} {}", o.titulo, o.autor)))
            .take(8)
        {
            let autor = if o.autor.is_empty() {
                "Autor desconhecido"
            } else {
                &o.autor
            };
            r.push(json!({
                "tipo": "obra", "id": o.id, "titulo": o.titulo,
                "detalhe": format!("{autor} · biblioteca"), "obraId": o.id,
            }));
        }
        let mut autores: Vec<&str> = obras
            .iter()
            .map(|o| o.autor.as_str())
            .filter(|a| !a.is_empty())
            .collect();
        autores.sort_unstable();
        autores.dedup();
        for a in autores.into_iter().filter(|a| combina(a)).take(3) {
            let n = obras.iter().filter(|o| o.autor == a).count();
            let primeira = obras.iter().find(|o| o.autor == a).map(|o| o.id.clone());
            r.push(json!({
                "tipo": "criador", "id": a, "titulo": a, "detalhe": format!("{n} obras"), "obraId": primeira,
            }));
        }
        let mut achadas = 0;
        for m in self.todas_marcacoes()? {
            if achadas == 5 {
                break;
            }
            let alvo = format!(
                "{} {}",
                m["trecho"].as_str().unwrap_or(""),
                m["nota"].as_str().unwrap_or("")
            );
            if !combina(&alvo) {
                continue;
            }
            achadas += 1;
            let titulo_obra = m["obraId"]
                .as_str()
                .and_then(|id| self.uma(id).ok())
                .map(|o| o.titulo)
                .unwrap_or_default();
            r.push(json!({
                "tipo": "marcacao", "id": m["id"], "titulo": format!("“{}”", m["trecho"].as_str().unwrap_or("")),
                "detalhe": titulo_obra, "obraId": m["obraId"],
            }));
        }
        Ok(Value::Array(r))
    }

    /// O eco do limiar: uma marcação com mais de 30 dias, a mesma o dia todo (escolhida pelo dia).
    pub(crate) fn eco(&self, agora_ms: i64) -> Result<Value, ErroFierium> {
        let mut velhas: Vec<Value> = self
            .todas_marcacoes()?
            .into_iter()
            .filter(|m| m["criadaEm"].as_i64().is_some_and(|c| agora_ms - c > 30 * DIA_MS))
            .collect();
        velhas.sort_by(|a, b| a["id"].as_str().cmp(&b["id"].as_str()));
        if velhas.is_empty() {
            return Ok(Value::Null);
        }
        let dia = (agora_ms / DIA_MS).max(0) as usize;
        let m = velhas.swap_remove(dia % velhas.len());
        let Ok(obra) = self.obra_obter(m["obraId"].as_str().unwrap_or("")) else {
            return Ok(Value::Null);
        };
        Ok(json!({ "marcacao": m, "obra": obra }))
    }
}
