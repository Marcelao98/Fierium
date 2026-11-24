//! A busca (Ctrl+K) e o "eco" do limiar.
use crate::banco::Biblioteca;
use crate::marcacoes::DIA_MS;
use crate::obras::Resumo;
use crate::{bd, normalizar};
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
        let obras = self.resumos(None, false, None, false)?;
        // o texto de cada obra é normalizado uma vez só; a ordem por título vale só pras que combinam
        let mut achadas: Vec<&Resumo> = obras
            .iter()
            .filter(|o| combina(&format!("{} {}", o.titulo, o.autor)))
            .collect();
        achadas.sort_by_cached_key(|o| normalizar(&o.titulo));
        let mut r: Vec<Value> = Vec::new();
        for o in achadas.into_iter().take(8) {
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
            // "a primeira" é a primeira na ordem por título
            let primeira = obras
                .iter()
                .filter(|o| o.autor == a)
                .min_by_key(|o| normalizar(&o.titulo))
                .map(|o| o.id.clone());
            r.push(json!({
                "tipo": "criador", "id": a, "titulo": a, "detalhe": format!("{n} obras"), "obraId": primeira,
            }));
        }
        let aceita = |trecho: &str, nota: &str| combina(&format!("{trecho} {nota}"));
        for m in self.marcacoes_filtradas(None, None, 5, &aceita)? {
            let titulo_obra = m["obraId"]
                .as_str()
                .and_then(|id| self.titulo_da_obra(id))
                .unwrap_or_default();
            r.push(json!({
                "tipo": "marcacao", "id": m["id"], "titulo": format!("“{}”", m["trecho"].as_str().unwrap_or("")),
                "detalhe": titulo_obra, "obraId": m["obraId"],
            }));
        }
        Ok(Value::Array(r))
    }

    /// O título de uma obra que tem edição (a que a interface enxerga).
    fn titulo_da_obra(&self, id: &str) -> Option<String> {
        self.bd
            .query_row(
                "SELECT titulo FROM obras WHERE id = ?1 AND EXISTS (SELECT 1 FROM edicoes WHERE obra_id = ?1)",
                [id],
                |r| r.get(0),
            )
            .ok()
    }

    /// O eco do limiar: uma marcação com mais de 30 dias, a mesma o dia todo (escolhida pelo dia).
    pub(crate) fn eco(&self, agora_ms: i64) -> Result<Value, ErroFierium> {
        let limite = agora_ms - 30 * DIA_MS;
        let velhas: i64 = self
            .bd
            .query_row(
                "SELECT COUNT(*) FROM marcacoes WHERE apagado_em IS NULL AND criada_em < ?1",
                [limite],
                |r| r.get(0),
            )
            .map_err(bd)?;
        if velhas == 0 {
            return Ok(Value::Null);
        }
        let dia = (agora_ms / DIA_MS).max(0);
        let m = self.marcacao_velha(limite, dia % velhas)?;
        let Ok(obra) = self.obra_obter(m["obraId"].as_str().unwrap_or("")) else {
            return Ok(Value::Null);
        };
        Ok(json!({ "marcacao": m, "obra": obra }))
    }
}
