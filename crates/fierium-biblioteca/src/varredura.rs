//! A varredura das pastas: acha PDF e EPUB, reconhece o que já era conhecido (mesmo lugar, movido ou trocado) e
//! registra o que é novo. Em duas fases: `plano_da_varredura` só LÊ (anda nas pastas, calcula impressões, lê os
//! metadados de dentro dos arquivos novos) e roda numa conexão de leitura; `aplicar_varredura` só ESCREVE (uma
//! transação curta). Assim a varredura nunca segura a conexão de escrita enquanto o disco trabalha.
use crate::banco::Biblioteca;
use crate::metadados;
use crate::obras;
use crate::{agora, bd, novo_id};
use fierium_core::ErroFierium;
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::Instant;

const BLOCO: u64 = 64 * 1024;

fn impressao(caminho: &Path, tamanho: u64) -> std::io::Result<String> {
    let mut f = std::fs::File::open(caminho)?;
    let mut h = blake3::Hasher::new();
    let mut buf = vec![0u8; BLOCO.min(tamanho) as usize];
    f.read_exact(&mut buf)?;
    h.update(&buf);
    if tamanho > BLOCO {
        let ini = tamanho.saturating_sub(BLOCO).max(BLOCO);
        f.seek(SeekFrom::Start(ini))?;
        let mut fim = Vec::new();
        f.read_to_end(&mut fim)?;
        h.update(&fim);
    }
    h.update(&tamanho.to_le_bytes());
    Ok(h.finalize().to_hex().to_string())
}

fn formato_de(p: &Path) -> Option<&'static str> {
    match p.extension()?.to_str()?.to_lowercase().as_str() {
        "pdf" => Some("pdf"),
        "epub" => Some("epub"),
        _ => None,
    }
}

struct Achado {
    pasta: String,
    rel: String,
    nome: String,
    formato: &'static str,
    tamanho: i64,
    impressao: String,
}

struct Linha {
    id: String,
    pasta: String,
    rel: String,
    impressao: String,
    existe: bool,
}

/// O que a fase de leitura descobriu: os arquivos achados e, pros que são conteúdo novo, os metadados já lidos.
pub struct PlanoDeVarredura {
    achados: Vec<Achado>,
    lidos: HashMap<String, (metadados::Metadados, Option<std::path::PathBuf>)>,
    ini: Instant,
}

impl Biblioteca {
    fn achar_arquivos(&self) -> Result<Vec<Achado>, ErroFierium> {
        let pastas: Vec<String> = {
            let mut st = self.bd.prepare("SELECT caminho FROM pastas").map_err(bd)?;
            let v = st
                .query_map([], |r| r.get(0))
                .map_err(bd)?
                .collect::<Result<_, _>>()
                .map_err(bd)?;
            v
        };
        let mut achados = Vec::new();
        for pasta in &pastas {
            let raiz = Path::new(pasta);
            if !raiz.is_dir() {
                continue;
            }
            let it = walkdir::WalkDir::new(raiz)
                .into_iter()
                .filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.'));
            for e in it {
                let e = match e {
                    Ok(e) => e,
                    Err(err) => {
                        tracing::warn!("varredura: {err}");
                        continue;
                    }
                };
                if !e.file_type().is_file() {
                    continue;
                }
                let Some(formato) = formato_de(e.path()) else { continue };
                let Ok(meta) = e.metadata() else { continue };
                let tamanho = meta.len();
                if tamanho == 0 {
                    continue;
                }
                let imp = match impressao(e.path(), tamanho) {
                    Ok(i) => i,
                    Err(err) => {
                        tracing::warn!("varredura: não li {}: {err}", e.path().display());
                        continue;
                    }
                };
                let rel = e
                    .path()
                    .strip_prefix(raiz)
                    .unwrap_or(e.path())
                    .components()
                    .map(|c| c.as_os_str().to_string_lossy().into_owned())
                    .collect::<Vec<_>>()
                    .join("/");
                achados.push(Achado {
                    pasta: pasta.clone(),
                    rel,
                    nome: e.file_name().to_string_lossy().into_owned(),
                    formato,
                    tamanho: tamanho as i64,
                    impressao: imp,
                });
            }
        }
        Ok(achados)
    }

    pub fn varrer(&mut self) -> Result<Value, ErroFierium> {
        let ini = Instant::now();
        // a migração v4 deixa os metadados de dentro dos arquivos pra ler uma vez, aqui
        if let Err(e) = self.reprocessar_metadados() {
            tracing::warn!("metadados: reprocesso falhou: {e}");
        }
        let achados = self.achar_arquivos()?;
        let conhecidos: Vec<Linha> = {
            let mut st = self
                .bd
                .prepare("SELECT id, pasta, caminho_rel, impressao, existe FROM arquivos")
                .map_err(bd)?;
            let v = st
                .query_map([], |r| {
                    Ok(Linha {
                        id: r.get(0)?,
                        pasta: r.get(1)?,
                        rel: r.get(2)?,
                        impressao: r.get(3)?,
                        existe: r.get::<_, i64>(4)? != 0,
                    })
                })
                .map_err(bd)?
                .collect::<Result<_, _>>()
                .map_err(bd)?;
            v
        };

        // casa cada achado com um arquivo conhecido: mesmo lugar e conteúdo, depois movido, depois conteúdo trocado
        let mut usado: HashSet<usize> = HashSet::new();
        let mut casado: Vec<Option<usize>> = vec![None; achados.len()];
        for passo in 0..3 {
            for (i, a) in achados.iter().enumerate() {
                if casado[i].is_some() {
                    continue;
                }
                let alvo = conhecidos.iter().enumerate().find(|(j, k)| {
                    !usado.contains(j)
                        && match passo {
                            0 => k.pasta == a.pasta && k.rel == a.rel && k.impressao == a.impressao,
                            1 => k.impressao == a.impressao,
                            _ => k.pasta == a.pasta && k.rel == a.rel,
                        }
                });
                if let Some((j, _)) = alvo {
                    usado.insert(j);
                    casado[i] = Some(j);
                }
            }
        }

        let agora_ = agora();
        let (mut novos, mut sumiram) = (0, 0);
        let tx = self.bd.transaction().map_err(bd)?;
        for (i, a) in achados.iter().enumerate() {
            match casado[i] {
                Some(j) => {
                    tx.execute(
                        "UPDATE arquivos SET pasta=?2, caminho_rel=?3, nome=?4, formato=?5, tamanho=?6, impressao=?7,
                         existe=1, visto_em=?8 WHERE id=?1",
                        params![
                            conhecidos[j].id,
                            a.pasta,
                            a.rel,
                            a.nome,
                            a.formato,
                            a.tamanho,
                            a.impressao,
                            agora_
                        ],
                    )
                    .map_err(bd)?;
                }
                None => {
                    // o mesmo conteúdo já está na biblioteca (outra pasta): é mais uma cópia da mesma edição
                    let conhecida: Option<String> = tx
                        .query_row(
                            "SELECT edicao_id FROM arquivos WHERE impressao = ?1 AND edicao_id IS NOT NULL
                             ORDER BY existe DESC, visto_em, id LIMIT 1",
                            params![a.impressao],
                            |r| r.get(0),
                        )
                        .optional()
                        .map_err(bd)?;
                    let edicao = match conhecida {
                        Some(e) => e,
                        None => {
                            // arquivo novo: outra edição de uma obra que já existe (mesma chave) ou uma obra nova
                            let mut caminho = PathBuf::from(&a.pasta);
                            caminho.extend(a.rel.split('/'));
                            let (dentro, capa) = metadados::ler_do_arquivo(&caminho, a.formato, true);
                            let m = metadados::completar(&dentro, &metadados::pelo_nome(&a.nome));
                            let capa = capa.and_then(|c| metadados::gravar_capa(&self.capas, &a.impressao, &c));
                            let (kt, ka) = obras::chaves(&m);
                            let obra = match obras::achar_obra(&tx, &kt, &ka, "")? {
                                Some(o) => {
                                    obras::completar_obra(&tx, &o, &m)?;
                                    o
                                }
                                None => {
                                    let o = novo_id();
                                    obras::inserir_obra(&tx, &o, &m, agora_)?;
                                    o
                                }
                            };
                            let e = novo_id();
                            obras::inserir_edicao(&tx, &e, &obra, a.formato, &m, capa.as_deref(), agora_)?;
                            novos += 1;
                            e
                        }
                    };
                    tx.execute(
                        "INSERT INTO arquivos (id, pasta, caminho_rel, nome, formato, tamanho, impressao, existe,
                            visto_em, edicao_id) VALUES (?1,?2,?3,?4,?5,?6,?7,1,?8,?9)",
                        params![
                            novo_id(),
                            a.pasta,
                            a.rel,
                            a.nome,
                            a.formato,
                            a.tamanho,
                            a.impressao,
                            agora_,
                            edicao
                        ],
                    )
                    .map_err(bd)?;
                }
            }
        }
        for (j, k) in conhecidos.iter().enumerate() {
            if !usado.contains(&j) && k.existe {
                tx.execute("UPDATE arquivos SET existe = 0 WHERE id = ?1", params![k.id])
                    .map_err(bd)?;
                sumiram += 1;
            }
        }
        tx.commit().map_err(bd)?;
        let total: i64 = self
            .bd
            .query_row("SELECT COUNT(*) FROM arquivos WHERE existe = 1", [], |r| r.get(0))
            .map_err(bd)?;
        Ok(
            json!({ "novos": novos, "sumiram": sumiram, "total": total, "milissegundos": ini.elapsed().as_millis() as u64 }),
        )
    }

    /// Os arquivos que existem (id do arquivo + caminho), pro protocolo `fierium://`.
    pub fn arquivos_existentes(&self) -> Result<Vec<(String, PathBuf)>, ErroFierium> {
        let mut st = self
            .bd
            .prepare("SELECT id, pasta, caminho_rel FROM arquivos WHERE existe = 1")
            .map_err(bd)?;
        let v = st
            .query_map([], |r| {
                let rel: String = r.get(2)?;
                let mut p = PathBuf::from(r.get::<_, String>(1)?);
                p.extend(rel.split('/'));
                Ok((r.get::<_, String>(0)?, p))
            })
            .map_err(bd)?
            .collect::<Result<_, _>>()
            .map_err(bd)?;
        Ok(v)
    }
}
