//! Metadados na biblioteca: reprocesso único dos arquivos que já estavam lá, edição à mão e capas registradas.
use super::metadados::{self, Pessoa};
use super::obras::{absorver_relacao, achar_obra, chave_do_autor, chave_do_titulo, chaves, completar_obra};
use super::obras::{criadores_json, ler_relacao, primeiro_autor};
use super::{bd, matiz_do_titulo, Biblioteca};
use fierium_core::ErroFierium;
use rusqlite::{params, OptionalExtension};
use serde_json::Value;
use std::path::PathBuf;

impl Biblioteca {
    /// Edição → primeiro arquivo que existe (caminho completo, nome, impressão).
    pub(crate) fn arquivo_da_edicao(&self, edicao: &str) -> Result<Option<(PathBuf, String, String)>, ErroFierium> {
        let r: Option<(String, String, String, String)> = self
            .bd
            .query_row(
                "SELECT pasta, caminho_rel, nome, impressao FROM arquivos WHERE edicao_id = ?1 AND existe = 1
                 ORDER BY caminho_rel, id LIMIT 1",
                params![edicao],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .optional()
            .map_err(bd)?;
        Ok(r.map(|(pasta, rel, nome, imp)| {
            let mut p = PathBuf::from(pasta);
            p.extend(rel.split('/'));
            (p, nome, imp)
        }))
    }

    /// Lê, uma vez, os metadados de dentro dos arquivos que já estavam na biblioteca (edições com `meta_v = 0`),
    /// corrige título/autor/série das obras que a pessoa não editou à mão e junta as obras que agora têm a mesma
    /// chave. Progresso e marcações seguem a edição; edições separadas à mão e obras editadas à mão não são tocadas.
    pub fn reprocessar_metadados(&mut self) -> Result<usize, ErroFierium> {
        let pendentes: Vec<(String, String, String)> = {
            let mut st = self
                .bd
                .prepare("SELECT id, obra_id, formato FROM edicoes WHERE meta_v = 0 ORDER BY criada_em, id")
                .map_err(bd)?;
            let v = st
                .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
                .map_err(bd)?
                .collect::<Result<_, _>>()
                .map_err(bd)?;
            v
        };
        let mut feitos: Vec<String> = Vec::new();
        for (edicao, obra, formato) in &pendentes {
            let Some((caminho, nome, impressao)) = self.arquivo_da_edicao(edicao)? else {
                continue;
            };
            let (dentro, capa) = metadados::ler_do_arquivo(&caminho, formato, true);
            let mut m = metadados::completar(&dentro, &metadados::pelo_nome(&nome));
            if m.titulo.trim().is_empty() {
                m.titulo = nome.clone();
            }
            let capa = capa.and_then(|c| metadados::gravar_capa(&self.capas, &impressao, &c));
            let (kt, ka) = chaves(&m);
            let tx = self.bd.unchecked_transaction().map_err(bd)?;
            tx.execute(
                "UPDATE edicoes SET chave_titulo = ?2, chave_autor = ?3, meta = ?4, capa = COALESCE(?5, capa),
                 meta_v = 1 WHERE id = ?1",
                params![
                    edicao,
                    kt,
                    ka,
                    serde_json::to_string(&m).unwrap_or_default(),
                    capa.map(|p| p.to_string_lossy().into_owned())
                ],
            )
            .map_err(bd)?;
            let so_ela = tx
                .query_row("SELECT COUNT(*) FROM edicoes WHERE obra_id = ?1", params![obra], |r| {
                    r.get::<_, i64>(0)
                })
                .map_err(bd)?
                == 1;
            if so_ela {
                tx.execute(
                    "UPDATE obras SET titulo = ?2, autor = ?3, matiz = ?4, serie = ?5, volume = ?6, ano = ?7,
                     criadores = ?8 WHERE id = ?1 AND editada = 0",
                    params![
                        obra,
                        m.titulo,
                        primeiro_autor(&m),
                        matiz_do_titulo(&m.titulo),
                        m.serie.as_ref().map(|s| s.nome.clone()),
                        m.serie.as_ref().map(|s| s.volume),
                        m.ano,
                        criadores_json(&m)
                    ],
                )
                .map_err(bd)?;
            } else {
                completar_obra(&tx, obra, &m)?;
            }
            tx.commit().map_err(bd)?;
            feitos.push(edicao.clone());
        }
        // juntar as obras de uma edição só que agora têm a mesma chave de outra
        for edicao in &feitos {
            let tx = self.bd.unchecked_transaction().map_err(bd)?;
            let linha: Option<(String, String, String, i64)> = tx
                .query_row(
                    "SELECT obra_id, chave_titulo, chave_autor, separada FROM edicoes WHERE id = ?1",
                    params![edicao],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
                )
                .optional()
                .map_err(bd)?;
            let Some((obra, kt, ka, separada)) = linha else {
                continue;
            };
            let (n, editada): (i64, i64) = tx
                .query_row(
                    "SELECT (SELECT COUNT(*) FROM edicoes WHERE obra_id = o.id), o.editada FROM obras o
                     WHERE o.id = ?1",
                    params![obra],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .map_err(bd)?;
            if separada != 0 || n != 1 || editada != 0 {
                continue;
            }
            let Some(alvo) = achar_obra(&tx, &kt, &ka, &obra)? else {
                continue;
            };
            let relacao = ler_relacao(&tx, "obras", &obra)?;
            absorver_relacao(&tx, &alvo, &relacao)?;
            tx.execute(
                "UPDATE edicoes SET obra_id = ?2 WHERE obra_id = ?1",
                params![obra, alvo],
            )
            .map_err(bd)?;
            tx.execute(
                "UPDATE marcacoes SET obra_id = ?2 WHERE obra_id = ?1",
                params![obra, alvo],
            )
            .map_err(bd)?;
            tx.execute("DELETE FROM obras WHERE id = ?1", params![obra])
                .map_err(bd)?;
            tx.commit().map_err(bd)?;
        }
        Ok(feitos.len())
    }

    /// Edição à mão: título, autores, série/volume, ano (campo ausente = não mexe; `null` em série/ano = apaga).
    /// Marca a obra como editada à mão: a varredura nunca mais sobrescreve.
    pub fn obra_editar(&self, a: &Value) -> Result<Value, ErroFierium> {
        let id = a["id"]
            .as_str()
            .ok_or_else(|| ErroFierium::argumento("id", "falta o id da obra"))?;
        self.uma(id)?;
        let tx = self.bd.unchecked_transaction().map_err(bd)?;
        if let Some(t) = a.get("titulo") {
            let t = t.as_str().map(str::trim).unwrap_or("");
            if t.is_empty() {
                return Err(ErroFierium::argumento("titulo", "o título não pode ficar vazio"));
            }
            tx.execute(
                "UPDATE obras SET titulo = ?2, matiz = ?3 WHERE id = ?1",
                params![id, t, matiz_do_titulo(t)],
            )
            .map_err(bd)?;
        }
        if let Some(v) = a.get("autores") {
            let nomes: Vec<String> = v
                .as_array()
                .ok_or_else(|| ErroFierium::argumento("autores", "tem que ser uma lista de nomes"))?
                .iter()
                .filter_map(|x| x.as_str())
                .map(metadados::nome_natural)
                .filter(|n| !n.is_empty())
                .collect();
            let pessoas: Vec<Pessoa> = nomes
                .iter()
                .map(|n| Pessoa {
                    nome: n.clone(),
                    papel: "autor".into(),
                })
                .collect();
            tx.execute(
                "UPDATE obras SET autor = ?2, criadores = ?3 WHERE id = ?1",
                params![
                    id,
                    nomes.first().cloned().unwrap_or_default(),
                    (!pessoas.is_empty()).then(|| serde_json::to_string(&pessoas).unwrap_or_default())
                ],
            )
            .map_err(bd)?;
        }
        match a.get("serie") {
            Some(Value::Null) => {
                tx.execute(
                    "UPDATE obras SET serie = NULL, volume = NULL WHERE id = ?1",
                    params![id],
                )
                .map_err(bd)?;
            }
            Some(s) => {
                let nome = s["nome"].as_str().map(str::trim).unwrap_or("");
                if nome.is_empty() {
                    return Err(ErroFierium::argumento("serie", "falta o nome da série"));
                }
                tx.execute(
                    "UPDATE obras SET serie = ?2, volume = ?3 WHERE id = ?1",
                    params![id, nome, s["volume"].as_f64().unwrap_or(0.0)],
                )
                .map_err(bd)?;
            }
            None => {}
        }
        match a.get("ano") {
            Some(Value::Null) => {
                tx.execute("UPDATE obras SET ano = NULL WHERE id = ?1", params![id])
                    .map_err(bd)?;
            }
            Some(n) => {
                let n = n
                    .as_i64()
                    .ok_or_else(|| ErroFierium::argumento("ano", "tem que ser um número"))?;
                tx.execute("UPDATE obras SET ano = ?2 WHERE id = ?1", params![id, n])
                    .map_err(bd)?;
            }
            None => {}
        }
        tx.execute("UPDATE obras SET editada = 1 WHERE id = ?1", params![id])
            .map_err(bd)?;
        // as chaves seguem o que a pessoa escreveu (arquivos novos com o mesmo nome certo juntam aqui)
        let (t, au): (String, String) = tx
            .query_row("SELECT titulo, autor FROM obras WHERE id = ?1", params![id], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .map_err(bd)?;
        tx.execute(
            "UPDATE edicoes SET chave_titulo = ?2, chave_autor = ?3 WHERE obra_id = ?1 AND separada = 0",
            params![id, chave_do_titulo(&t), chave_do_autor(&au)],
        )
        .map_err(bd)?;
        tx.commit().map_err(bd)?;
        self.obra_obter(id)
    }
}
