//! Ler obras: a lista com filtros e ordens, uma obra, a obra que já existe com uma chave. Só leitura (roda na
//! conexão de leitura).
use super::chave::{achar_obra, chave_do_autor, chave_do_titulo};
use super::json::{ArquivoLinha, EdicaoLinha, MetaLeve, ObraLinha, Resumo};
use crate::banco::Biblioteca;
use crate::{bd, normalizar};
use fierium_core::ErroFierium;
use rusqlite::params;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::Path;

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
    /// Uma obra com as edições (erro `NAO_ENCONTRADO` se não existir). Carrega só ela.
    pub(crate) fn uma(&self, id: &str) -> Result<ObraLinha, ErroFierium> {
        self.carregar_obras(Some(&[id.to_string()]))?
            .pop()
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("obra {id}")))
    }

    /// O resumo leve de cada obra da estante (só o que precisa pra filtrar e ordenar), na ordem da tabela. A obra
    /// só entra se tiver ao menos um arquivo no disco (e, com `formato`, um arquivo desse formato). Uma consulta
    /// só pra estante inteira: o JSON pesado (edições, arquivos) é montado depois, só pras obras que vão aparecer.
    pub(crate) fn resumos(
        &self,
        estado: Option<&str>,
        favoritas: bool,
        formato: Option<&str>,
        com_fracao: bool,
    ) -> Result<Vec<Resumo>, ErroFierium> {
        // `fracao` (quanto foi lido) custa uma junção a mais: só quem ordena ou decide por ela pede
        let (coluna, juncao) = if com_fracao {
            (
                "COALESCE(f.fracao, 0.0)",
                "LEFT JOIN (SELECT e.obra_id AS obra_id, p.fracao AS fracao, MAX(p.quando) AS q
                            FROM edicoes e JOIN progresso p ON p.edicao_id = e.id GROUP BY e.obra_id) f
                      ON f.obra_id = o.id",
            )
        } else {
            ("0.0", "")
        };
        let mut st = self
            .bd
            .prepare_cached(&format!(
                "SELECT o.id, o.titulo, o.autor, o.estado, o.adicionada_em, o.ultima_leitura, {coluna}
                 FROM obras o
                 JOIN (SELECT DISTINCT e.obra_id AS obra_id FROM edicoes e
                       JOIN arquivos a ON a.edicao_id = e.id AND a.existe = 1
                       WHERE (?3 IS NULL OR e.formato = ?3)) d ON d.obra_id = o.id
                 {juncao}
                 WHERE (?1 IS NULL OR o.estado = ?1) AND (?2 = 0 OR o.favorita = 1)
                 ORDER BY o.rowid"
            ))
            .map_err(bd)?;
        let v = st
            .query_map(params![estado, favoritas as i64, formato], |r| {
                Ok(Resumo {
                    id: r.get(0)?,
                    titulo: r.get(1)?,
                    autor: r.get(2)?,
                    estado: r.get(3)?,
                    adicionada_em: r.get(4)?,
                    ultima_leitura: r.get(5)?,
                    fracao: r.get(6)?,
                })
            })
            .map_err(bd)?
            .collect::<Result<_, _>>()
            .map_err(bd)?;
        Ok(v)
    }

    /// Carrega por inteiro só as obras de `ids` e devolve o JSON delas NA ORDEM de `ids`.
    pub(crate) fn obras_em_ordem(&self, ids: &[String]) -> Result<Vec<ObraLinha>, ErroFierium> {
        let mut por_id: HashMap<String, ObraLinha> = self
            .carregar_obras(Some(ids))?
            .into_iter()
            .map(|o| (o.id.clone(), o))
            .collect();
        Ok(ids.iter().filter_map(|id| por_id.remove(id)).collect())
    }

    /// A estante: filtros `texto`, `estado`, `formato`, `favoritas`; `ordem` ("recentes", "titulo", "autor",
    /// "progresso"); e, opcionais, `limite` e `deslocamento` (uma página; sem `limite`, vem tudo, como sempre).
    pub fn obras_listar(&self, filtro: &Value) -> Result<Value, ErroFierium> {
        let texto = normalizar(filtro["texto"].as_str().unwrap_or(""));
        let palavras: Vec<&str> = texto.split_whitespace().collect();
        let ordem = filtro["ordem"].as_str().unwrap_or("recentes");
        if !["titulo", "autor", "progresso", "recentes"].contains(&ordem) {
            return Err(ErroFierium::argumento("ordem", format!("ordem desconhecida: {ordem}")));
        }
        let mut r = self.resumos(
            filtro["estado"].as_str(),
            filtro["favoritas"].as_bool().unwrap_or(false),
            filtro["formato"].as_str(),
            ordem == "progresso",
        )?;
        if !palavras.is_empty() {
            r.retain(|o| {
                let alvo = normalizar(&format!("{} {}", o.titulo, o.autor));
                palavras.iter().all(|p| alvo.contains(p))
            });
        }
        match ordem {
            "titulo" => r.sort_by_cached_key(|o| normalizar(&o.titulo)),
            "autor" => r.sort_by_cached_key(|o| (o.autor.is_empty(), normalizar(&o.autor), normalizar(&o.titulo))),
            "progresso" => r.sort_by(|a, b| b.fracao.total_cmp(&a.fracao)),
            _ => r.sort_by(|a, b| (b.adicionada_em, &b.id).cmp(&(a.adicionada_em, &a.id))),
        }
        let desloc = filtro["deslocamento"].as_u64().unwrap_or(0) as usize;
        let limite = filtro["limite"].as_u64().map_or(usize::MAX, |l| l as usize);
        let ids: Vec<String> = r.into_iter().skip(desloc).take(limite).map(|o| o.id).collect();
        Ok(Value::Array(
            self.obras_em_ordem(&ids)?.iter().map(ObraLinha::json).collect(),
        ))
    }

    pub fn obra_obter(&self, id: &str) -> Result<Value, ErroFierium> {
        Ok(self.uma(id)?.json())
    }

    /// As obras (todas, ou só as de `ids`) já com as edições e os arquivos, na ordem em que estão na tabela.
    /// Tudo dentro de uma transação de leitura, pra as três consultas verem o mesmo instante do banco.
    pub(crate) fn carregar_obras(&self, ids: Option<&[String]>) -> Result<Vec<ObraLinha>, ErroFierium> {
        if ids.is_some_and(<[String]>::is_empty) {
            return Ok(Vec::new());
        }
        let ids_json = ids.map(|v| serde_json::to_string(v).unwrap_or_default());
        let (onde_obra, onde_edicao, onde_arquivo) = if ids.is_some() {
            (
                "WHERE id IN (SELECT value FROM json_each(?1))",
                "WHERE e.obra_id IN (SELECT value FROM json_each(?1))",
                "AND edicao_id IN (SELECT e.id FROM edicoes e WHERE e.obra_id IN (SELECT value FROM json_each(?1)))",
            )
        } else {
            ("", "", "")
        };
        let parametros = || -> Vec<&dyn rusqlite::ToSql> {
            match &ids_json {
                Some(j) => vec![j as &dyn rusqlite::ToSql],
                None => vec![],
            }
        };
        let tx = self.bd.unchecked_transaction().map_err(bd)?;

        let mut arquivos: HashMap<String, Vec<ArquivoLinha>> = HashMap::new();
        {
            let mut st = tx
                .prepare_cached(&format!(
                    "SELECT edicao_id, id, nome, caminho_rel, tamanho, existe FROM arquivos
                     WHERE edicao_id IS NOT NULL {onde_arquivo}
                     ORDER BY edicao_id, existe DESC, caminho_rel, id"
                ))
                .map_err(bd)?;
            let linhas = st
                .query_map(parametros().as_slice(), |r| {
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

        // muitas obras: uma listagem da pasta de capas vale mais que um `stat` por capa
        let capas_na_pasta: Option<HashSet<std::ffi::OsString>> = if ids.is_none_or(|v| v.len() > 1500) {
            std::fs::read_dir(&self.capas)
                .ok()
                .map(|d| d.filter_map(Result::ok).map(|e| e.file_name()).collect())
        } else {
            None
        };
        let capa_existe = |c: &str| -> bool {
            let p = Path::new(c);
            match (&capas_na_pasta, p.parent(), p.file_name()) {
                (Some(set), Some(pai), Some(nome)) if pai == self.capas => set.contains(nome),
                _ => p.is_file(),
            }
        };

        let mut edicoes: HashMap<String, Vec<EdicaoLinha>> = HashMap::new();
        {
            let mut st = tx
                .prepare_cached(&format!(
                    "SELECT e.obra_id, e.id, e.formato, p.posicao, p.fracao, p.quando, e.meta, e.capa
                     FROM edicoes e LEFT JOIN progresso p ON p.edicao_id = e.id {onde_edicao}"
                ))
                .map_err(bd)?;
            let mut linhas = st.query(parametros().as_slice()).map_err(bd)?;
            while let Some(r) = linhas.next().map_err(bd)? {
                let posicao: Option<String> = r.get(3).map_err(bd)?;
                let progresso = match posicao {
                    Some(p) => Some((p, r.get(4).map_err(bd)?, r.get(5).map_err(bd)?)),
                    None => None,
                };
                // `meta` e `capa` são só olhados (emprestados do SQLite), sem copiar o texto
                let meta = r
                    .get_ref(6)
                    .map_err(bd)?
                    .as_str_or_null()
                    .map_err(|e| ErroFierium::Banco(e.to_string()))?
                    .and_then(|m| serde_json::from_str::<MetaLeve>(m).ok());
                let tem_capa = r
                    .get_ref(7)
                    .map_err(bd)?
                    .as_str_or_null()
                    .map_err(|e| ErroFierium::Banco(e.to_string()))?
                    .is_some_and(&capa_existe);
                let id: String = r.get(1).map_err(bd)?;
                let arqs = arquivos.remove(&id).unwrap_or_default();
                edicoes.entry(r.get(0).map_err(bd)?).or_default().push(EdicaoLinha {
                    id,
                    formato: r.get(2).map_err(bd)?,
                    arquivos: arqs,
                    progresso,
                    meta,
                    tem_capa,
                });
            }
        }

        let mut obras: Vec<ObraLinha> = {
            let mut st = tx
                .prepare_cached(&format!(
                    "SELECT id, titulo, autor, matiz, adicionada_em, estado, favorita, ultima_leitura, terminada_em,
                     serie, volume, ano, criadores FROM obras {onde_obra} ORDER BY rowid"
                ))
                .map_err(bd)?;
            let v = st
                .query_map(parametros().as_slice(), |r| {
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
                })
                .map_err(bd)?
                .collect::<Result<_, _>>()
                .map_err(bd)?;
            v
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
