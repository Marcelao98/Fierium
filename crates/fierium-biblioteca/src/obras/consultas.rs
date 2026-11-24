//! Ler obras: a lista com filtros e ordens, uma obra, a obra que já existe com uma chave. Só leitura (roda na
//! conexão de leitura).
use super::chave::{achar_obra, chave_do_autor, chave_do_titulo};
use super::json::{ArquivoLinha, EdicaoLinha, ObraLinha};
use crate::banco::Biblioteca;
use crate::{bd, normalizar};
use fierium_core::ErroFierium;
use rusqlite::params;
use serde_json::Value;
use std::collections::HashMap;

fn ordem_do_formato(f: &str) -> u8 {
    match f {
        "epub" => 0,
        "pdf" => 1,
        _ => 2,
    }
}

impl Biblioteca {
    /// A obra que a pessoa já tem com este título e autor (mesma regra da varredura). Usado pelo catálogo público.
    pub fn obra_por_chave(&self, titulo: &str, autor: &str) -> Result<Option<String>, ErroFierium> {
        achar_obra(&self.bd, &chave_do_titulo(titulo), &chave_do_autor(autor), "")
    }

    /// (obra, edição) do arquivo que está neste caminho, se a biblioteca já o conhece.
    pub fn edicao_do_caminho(&self, caminho: &std::path::Path) -> Result<Option<(String, String)>, ErroFierium> {
        let alvo = caminho.canonicalize().unwrap_or_else(|_| caminho.to_path_buf());
        let mut st = self
            .bd
            .prepare(
                "SELECT a.pasta, a.caminho_rel, e.obra_id, e.id FROM arquivos a JOIN edicoes e ON e.id = a.edicao_id
                 WHERE a.existe = 1",
            )
            .map_err(bd)?;
        let linhas = st
            .query_map([], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get(2)?, r.get(3)?))
            })
            .map_err(bd)?;
        for l in linhas {
            let (pasta, rel, obra, edicao) = l.map_err(bd)?;
            let mut p = std::path::PathBuf::from(pasta);
            p.extend(rel.split('/'));
            if p == alvo {
                return Ok(Some((obra, edicao)));
            }
        }
        Ok(None)
    }
}

impl Biblioteca {
    pub(crate) fn todas(&self, so_existentes: bool) -> Result<Vec<ObraLinha>, ErroFierium> {
        let mut v = self.carregar_obras(None)?;
        if so_existentes {
            v.retain(ObraLinha::disponivel);
        }
        Ok(v)
    }

    pub(crate) fn uma(&self, id: &str) -> Result<ObraLinha, ErroFierium> {
        self.carregar_obras(Some(id))?
            .pop()
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("obra {id}")))
    }

    pub fn obras_listar(&self, filtro: &Value) -> Result<Value, ErroFierium> {
        let texto = normalizar(filtro["texto"].as_str().unwrap_or(""));
        let palavras: Vec<&str> = texto.split_whitespace().collect();
        let estado = filtro["estado"].as_str();
        let formato = filtro["formato"].as_str();
        let favoritas = filtro["favoritas"].as_bool().unwrap_or(false);
        let mut v: Vec<ObraLinha> = self
            .todas(true)?
            .into_iter()
            .filter(|o| {
                let alvo = normalizar(&format!("{} {}", o.titulo, o.autor));
                palavras.iter().all(|p| alvo.contains(p))
                    && estado.is_none_or(|e| o.estado == e)
                    && formato.is_none_or(|f| o.tem_formato(f))
                    && (!favoritas || o.favorita)
            })
            .collect();
        match filtro["ordem"].as_str().unwrap_or("recentes") {
            "titulo" => v.sort_by_cached_key(|o| normalizar(&o.titulo)),
            "autor" => v.sort_by_cached_key(|o| (o.autor.is_empty(), normalizar(&o.autor), normalizar(&o.titulo))),
            "progresso" => v.sort_by(|a, b| b.fracao().total_cmp(&a.fracao())),
            "recentes" => v.sort_by(|a, b| (b.adicionada_em, &b.id).cmp(&(a.adicionada_em, &a.id))),
            outra => return Err(ErroFierium::argumento("ordem", format!("ordem desconhecida: {outra}"))),
        }
        Ok(Value::Array(v.iter().map(ObraLinha::json).collect()))
    }

    pub fn obra_obter(&self, id: &str) -> Result<Value, ErroFierium> {
        Ok(self.uma(id)?.json())
    }

    /// As obras (todas, ou só uma) já com as edições e os arquivos.
    pub(crate) fn carregar_obras(&self, so: Option<&str>) -> Result<Vec<ObraLinha>, ErroFierium> {
        let mut arquivos: HashMap<String, Vec<ArquivoLinha>> = HashMap::new();
        {
            let mut st = self
                .bd
                .prepare(
                    "SELECT edicao_id, id, nome, caminho_rel, tamanho, existe FROM arquivos
                     WHERE edicao_id IS NOT NULL ORDER BY existe DESC, caminho_rel, id",
                )
                .map_err(bd)?;
            let linhas = st
                .query_map([], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        ArquivoLinha {
                            id: r.get(1)?,
                            nome: r.get(2)?,
                            rel: r.get(3)?,
                            tamanho: r.get(4)?,
                            existe: r.get::<_, i64>(5)? != 0,
                        },
                    ))
                })
                .map_err(bd)?;
            for l in linhas {
                let (edicao, a) = l.map_err(bd)?;
                arquivos.entry(edicao).or_default().push(a);
            }
        }
        let mut edicoes: HashMap<String, Vec<EdicaoLinha>> = HashMap::new();
        {
            let mut st = self
                .bd
                .prepare(
                    "SELECT e.obra_id, e.id, e.formato, p.posicao, p.fracao, p.quando, e.meta, e.capa
                     FROM edicoes e LEFT JOIN progresso p ON p.edicao_id = e.id ORDER BY e.criada_em, e.id",
                )
                .map_err(bd)?;
            let linhas = st
                .query_map([], |r| {
                    let posicao: Option<String> = r.get(3)?;
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        match posicao {
                            Some(p) => Some((p, r.get(4)?, r.get(5)?)),
                            None => None,
                        },
                        r.get::<_, Option<String>>(6)?,
                        r.get::<_, Option<String>>(7)?,
                    ))
                })
                .map_err(bd)?;
            for l in linhas {
                let (obra, id, formato, progresso, meta, capa) = l.map_err(bd)?;
                let arqs = arquivos.remove(&id).unwrap_or_default();
                edicoes.entry(obra).or_default().push(EdicaoLinha {
                    id,
                    formato,
                    arquivos: arqs,
                    progresso,
                    meta: meta.and_then(|m| serde_json::from_str(&m).ok()),
                    tem_capa: capa.is_some_and(|c| std::path::Path::new(&c).is_file()),
                });
            }
        }
        let sql = "SELECT id, titulo, autor, matiz, adicionada_em, estado, favorita, ultima_leitura, terminada_em,
                   serie, volume, ano, criadores FROM obras";
        let ler = |r: &rusqlite::Row| -> rusqlite::Result<ObraLinha> {
            Ok(ObraLinha {
                id: r.get(0)?,
                titulo: r.get(1)?,
                autor: r.get(2)?,
                matiz: r.get(3)?,
                adicionada_em: r.get(4)?,
                estado: r.get(5)?,
                favorita: r.get::<_, i64>(6)? != 0,
                ultima_leitura: r.get(7)?,
                terminada_em: r.get(8)?,
                serie: r
                    .get::<_, Option<String>>(9)?
                    .map(|n| (n, r.get::<_, Option<f64>>(10).ok().flatten().unwrap_or(0.0))),
                ano: r.get(11)?,
                criadores: r
                    .get::<_, Option<String>>(12)?
                    .and_then(|j| serde_json::from_str(&j).ok()),
                edicoes: Vec::new(),
            })
        };
        let mut obras: Vec<ObraLinha> = match so {
            Some(id) => {
                let mut st = self.bd.prepare(&format!("{sql} WHERE id = ?1")).map_err(bd)?;
                let v = st
                    .query_map(params![id], ler)
                    .map_err(bd)?
                    .collect::<Result<_, _>>()
                    .map_err(bd)?;
                v
            }
            None => {
                let mut st = self.bd.prepare(sql).map_err(bd)?;
                let v = st
                    .query_map([], ler)
                    .map_err(bd)?
                    .collect::<Result<_, _>>()
                    .map_err(bd)?;
                v
            }
        };
        for o in &mut obras {
            let mut es = edicoes.remove(&o.id).unwrap_or_default();
            es.sort_by(|a, b| {
                (b.disponivel(), b.lida_em())
                    .cmp(&(a.disponivel(), a.lida_em()))
                    .then_with(|| ordem_do_formato(&a.formato).cmp(&ordem_do_formato(&b.formato)))
                    .then_with(|| a.id.cmp(&b.id))
            });
            o.edicoes = es;
        }
        // obra sem edição nenhuma não existe pra interface
        obras.retain(|o| !o.edicoes.is_empty());
        Ok(obras)
    }
}
