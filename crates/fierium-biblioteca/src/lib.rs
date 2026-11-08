//! A biblioteca de verdade (trilha "Lendo de verdade", M3 enxuto): pastas escolhidas, varredura de PDF e EPUB,
//! SQLite, obra deduzida do nome do arquivo, progresso. Sem Tauri: o `fierium-app` só chama isto.
//! As respostas JSON têm o formato EXATO dos tipos do contrato TypeScript (camelCase).
use fierium_core::ErroFierium;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

const VERSAO_BANCO: i64 = 1;
const LIDA: f64 = 0.98;
const BLOCO: u64 = 64 * 1024;

fn bd(e: rusqlite::Error) -> ErroFierium {
    ErroFierium::Banco(e.to_string())
}

fn agora() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn novo_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

/// Endereço do arquivo no protocolo da interface.
pub fn url_do_arquivo(id: &str) -> String {
    if cfg!(windows) {
        format!("http://fierium.localhost/arquivo/{id}")
    } else {
        format!("fierium://localhost/arquivo/{id}")
    }
}

fn expandir_til(caminho: &str) -> PathBuf {
    let c = caminho.trim();
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).ok();
    match (c, home) {
        ("~", Some(h)) => PathBuf::from(h),
        (c, Some(h)) if c.starts_with("~/") || c.starts_with("~\\") => PathBuf::from(h).join(&c[2..]),
        (c, _) => PathBuf::from(c),
    }
}

/// Minúsculas e sem acento, pra busca.
pub fn normalizar(s: &str) -> String {
    s.chars()
        .flat_map(char::to_lowercase)
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' | 'å' => 'a',
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

/// (autor, título) a partir do nome do arquivo.
pub fn titulo_e_autor(nome_arquivo: &str) -> (String, String) {
    let sem_ext = match nome_arquivo.rsplit_once('.') {
        Some((a, _)) if !a.is_empty() => a,
        _ => nome_arquivo,
    };
    let mut t = sem_ext.replace(['_', '.'], " ");
    // tira "(1899)"
    while let Some(i) = t.find('(') {
        match t[i..].find(')') {
            Some(f)
                if {
                    let d = t[i + 1..i + f].trim();
                    d.len() == 4 && d.chars().all(|c| c.is_ascii_digit())
                } =>
            {
                t.replace_range(i..=i + f, "");
            }
            _ => break,
        }
    }
    let t = t.split_whitespace().collect::<Vec<_>>().join(" ");
    match t.split_once(" - ") {
        Some((a, b)) if !a.trim().is_empty() && !b.trim().is_empty() => (a.trim().into(), b.trim().into()),
        _ => (String::new(), t),
    }
}

fn matiz_do_titulo(titulo: &str) -> i64 {
    let h = blake3::hash(titulo.as_bytes());
    let b = h.as_bytes();
    (u32::from_le_bytes([b[0], b[1], b[2], b[3]]) % 360) as i64
}

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

struct ObraLinha {
    id: String,
    arquivo_id: String,
    titulo: String,
    autor: String,
    matiz: i64,
    adicionada_em: i64,
    estado: String,
    favorita: bool,
    ultima_leitura: Option<i64>,
    terminada_em: Option<i64>,
    nome: String,
    rel: String,
    formato: String,
    tamanho: i64,
    existe: bool,
    progresso: Option<(String, f64, i64)>,
}

impl ObraLinha {
    fn fracao(&self) -> f64 {
        self.progresso.as_ref().map_or(0.0, |p| p.1)
    }

    fn json(&self) -> Value {
        let mut relacao = json!({
            "estado": self.estado,
            "favorita": self.favorita,
            "adicionadaEm": self.adicionada_em,
        });
        if let Some(u) = self.ultima_leitura {
            relacao["ultimaLeitura"] = json!(u);
        }
        if let Some(t) = self.terminada_em {
            relacao["terminadaEm"] = json!(t);
        }
        let mut edicao = json!({
            "id": self.arquivo_id,
            "obraId": self.id,
            "formato": self.formato,
            "idioma": "",
            "descricao": "",
            "arquivos": [{
                "id": self.arquivo_id,
                "nome": self.nome,
                "caminho": self.rel,
                "tamanho": self.tamanho,
                "disponivel": self.existe,
            }],
        });
        if let Some((posicao, fracao, quando)) = &self.progresso {
            edicao["progresso"] = json!({ "posicao": posicao, "fracao": fracao, "quando": quando });
        }
        let criadores = if self.autor.is_empty() {
            json!([])
        } else {
            json!([{ "nome": self.autor, "papel": "autor" }])
        };
        json!({
            "id": self.id,
            "titulo": self.titulo,
            "criadores": criadores,
            "assuntos": [],
            "reino": "biblioteca",
            "matiz": self.matiz,
            "colecaoIds": [],
            "edicoes": [edicao],
            "relacao": relacao,
        })
    }
}

const SELECAO: &str = "SELECT o.id, o.arquivo_id, o.titulo, o.autor, o.matiz, o.adicionada_em, o.estado, o.favorita, \
    o.ultima_leitura, o.terminada_em, a.nome, a.caminho_rel, a.formato, a.tamanho, a.existe, \
    p.posicao, p.fracao, p.quando \
    FROM obras o JOIN arquivos a ON a.id = o.arquivo_id LEFT JOIN progresso p ON p.edicao_id = a.id";

fn ler_obra(r: &rusqlite::Row) -> rusqlite::Result<ObraLinha> {
    let posicao: Option<String> = r.get(15)?;
    Ok(ObraLinha {
        id: r.get(0)?,
        arquivo_id: r.get(1)?,
        titulo: r.get(2)?,
        autor: r.get(3)?,
        matiz: r.get(4)?,
        adicionada_em: r.get(5)?,
        estado: r.get(6)?,
        favorita: r.get::<_, i64>(7)? != 0,
        ultima_leitura: r.get(8)?,
        terminada_em: r.get(9)?,
        nome: r.get(10)?,
        rel: r.get(11)?,
        formato: r.get(12)?,
        tamanho: r.get(13)?,
        existe: r.get::<_, i64>(14)? != 0,
        progresso: match posicao {
            Some(p) => Some((p, r.get(16)?, r.get(17)?)),
            None => None,
        },
    })
}

pub struct Biblioteca {
    bd: Connection,
}

impl Biblioteca {
    pub fn abrir(caminho_db: &Path) -> Result<Self, ErroFierium> {
        if let Some(pai) = caminho_db.parent() {
            std::fs::create_dir_all(pai).map_err(|e| ErroFierium::de_io(pai.display(), e))?;
        }
        let conexao = Connection::open(caminho_db).map_err(bd)?;
        conexao
            .execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
            .map_err(bd)?;
        let mut b = Self { bd: conexao };
        b.migrar()?;
        Ok(b)
    }

    fn migrar(&mut self) -> Result<(), ErroFierium> {
        let v: i64 = self.bd.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(bd)?;
        if v < 1 {
            self.bd
                .execute_batch(&format!(
                    "BEGIN;
                     CREATE TABLE pastas (caminho TEXT PRIMARY KEY, adicionada_em INTEGER NOT NULL);
                     CREATE TABLE arquivos (
                        id TEXT PRIMARY KEY, pasta TEXT NOT NULL, caminho_rel TEXT NOT NULL, nome TEXT NOT NULL,
                        formato TEXT NOT NULL, tamanho INTEGER NOT NULL, impressao TEXT NOT NULL,
                        existe INTEGER NOT NULL DEFAULT 1, visto_em INTEGER NOT NULL);
                     CREATE INDEX arquivos_impressao ON arquivos (impressao);
                     CREATE TABLE obras (
                        id TEXT PRIMARY KEY, arquivo_id TEXT NOT NULL UNIQUE REFERENCES arquivos(id),
                        titulo TEXT NOT NULL, autor TEXT NOT NULL, matiz INTEGER NOT NULL,
                        adicionada_em INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT 'nao-lida',
                        favorita INTEGER NOT NULL DEFAULT 0, ultima_leitura INTEGER, terminada_em INTEGER);
                     CREATE TABLE progresso (
                        edicao_id TEXT PRIMARY KEY REFERENCES arquivos(id), posicao TEXT NOT NULL,
                        fracao REAL NOT NULL, quando INTEGER NOT NULL);
                     PRAGMA user_version = {VERSAO_BANCO};
                     COMMIT;"
                ))
                .map_err(bd)?;
        }
        Ok(())
    }

    // ---------- pastas ----------

    pub fn pastas_listar(&self) -> Result<Value, ErroFierium> {
        let mut st = self
            .bd
            .prepare(
                "SELECT p.caminho, (SELECT COUNT(*) FROM arquivos a WHERE a.pasta = p.caminho AND a.existe = 1)
                 FROM pastas p ORDER BY p.adicionada_em, p.caminho",
            )
            .map_err(bd)?;
        let linhas = st
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
            .map_err(bd)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(bd)?;
        Ok(Value::Array(
            linhas
                .into_iter()
                .map(|(c, n)| json!({ "caminho": c, "existe": Path::new(&c).is_dir(), "arquivos": n }))
                .collect(),
        ))
    }

    pub fn pastas_adicionar(&self, caminho: &str) -> Result<Value, ErroFierium> {
        let p = expandir_til(caminho);
        if !p.is_dir() {
            return Err(ErroFierium::argumento(
                "caminho",
                format!("\"{}\" não é uma pasta que existe", caminho.trim()),
            ));
        }
        let p = p.canonicalize().map_err(|e| ErroFierium::de_io(p.display(), e))?;
        self.bd
            .execute(
                "INSERT OR IGNORE INTO pastas (caminho, adicionada_em) VALUES (?1, ?2)",
                params![p.to_string_lossy(), agora()],
            )
            .map_err(bd)?;
        self.pastas_listar()
    }

    pub fn pastas_remover(&self, caminho: &str) -> Result<Value, ErroFierium> {
        let p = expandir_til(caminho);
        let c = p.canonicalize().unwrap_or(p).to_string_lossy().into_owned();
        let n = self
            .bd
            .execute("DELETE FROM pastas WHERE caminho = ?1", params![c])
            .map_err(bd)?;
        if n == 0 {
            return Err(ErroFierium::NaoEncontrado(format!("pasta {}", caminho.trim())));
        }
        // os livros dela somem da estante (e voltam, com o progresso, se a pasta voltar)
        self.bd
            .execute("UPDATE arquivos SET existe = 0 WHERE pasta = ?1", params![c])
            .map_err(bd)?;
        self.pastas_listar()
    }

    // ---------- varredura ----------

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
                    let id = novo_id();
                    tx.execute(
                        "INSERT INTO arquivos (id, pasta, caminho_rel, nome, formato, tamanho, impressao, existe, visto_em)
                         VALUES (?1,?2,?3,?4,?5,?6,?7,1,?8)",
                        params![id, a.pasta, a.rel, a.nome, a.formato, a.tamanho, a.impressao, agora_],
                    )
                    .map_err(bd)?;
                    let (autor, titulo) = titulo_e_autor(&a.nome);
                    tx.execute(
                        "INSERT INTO obras (id, arquivo_id, titulo, autor, matiz, adicionada_em) VALUES (?1,?2,?3,?4,?5,?6)",
                        params![novo_id(), id, titulo, autor, matiz_do_titulo(&titulo), agora_],
                    )
                    .map_err(bd)?;
                    novos += 1;
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

    /// Os arquivos que existem (id da edição + caminho), pro protocolo `fierium://`.
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

    // ---------- obras ----------

    fn todas(&self, so_existentes: bool) -> Result<Vec<ObraLinha>, ErroFierium> {
        let sql = if so_existentes {
            format!("{SELECAO} WHERE a.existe = 1")
        } else {
            SELECAO.to_string()
        };
        let mut st = self.bd.prepare(&sql).map_err(bd)?;
        let v = st
            .query_map([], ler_obra)
            .map_err(bd)?
            .collect::<Result<_, _>>()
            .map_err(bd)?;
        Ok(v)
    }

    fn uma(&self, id: &str) -> Result<ObraLinha, ErroFierium> {
        self.bd
            .query_row(&format!("{SELECAO} WHERE o.id = ?1"), params![id], ler_obra)
            .optional()
            .map_err(bd)?
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
                    && formato.is_none_or(|f| o.formato == f)
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

    pub fn obra_atualizar(&self, id: &str, favorita: Option<bool>, estado: Option<&str>) -> Result<Value, ErroFierium> {
        self.uma(id)?;
        if let Some(e) = estado {
            if !["nao-lida", "lendo", "lida", "deixada"].contains(&e) {
                return Err(ErroFierium::argumento("estado", format!("estado desconhecido: {e}")));
            }
            self.bd
                .execute("UPDATE obras SET estado = ?2 WHERE id = ?1", params![id, e])
                .map_err(bd)?;
            if e == "lida" {
                self.bd
                    .execute(
                        "UPDATE obras SET terminada_em = COALESCE(terminada_em, ?2) WHERE id = ?1",
                        params![id, agora()],
                    )
                    .map_err(bd)?;
            }
        }
        if let Some(f) = favorita {
            self.bd
                .execute("UPDATE obras SET favorita = ?2 WHERE id = ?1", params![id, f as i64])
                .map_err(bd)?;
        }
        self.obra_obter(id)
    }

    pub fn limiar(&self) -> Result<Value, ErroFierium> {
        let todas = self.todas(true)?;
        let mut por_leitura: Vec<&ObraLinha> = todas.iter().filter(|o| o.ultima_leitura.is_some()).collect();
        por_leitura.sort_by_key(|o| std::cmp::Reverse(o.ultima_leitura));
        let ultimo = por_leitura.iter().find(|o| o.fracao() < LIDA).map(|o| o.json());
        let mut lendo: Vec<&ObraLinha> = todas.iter().filter(|o| o.estado == "lendo").collect();
        lendo.sort_by_key(|o| std::cmp::Reverse(o.ultima_leitura));
        let mut novas: Vec<&ObraLinha> = todas.iter().collect();
        novas.sort_by(|a, b| (b.adicionada_em, &b.id).cmp(&(a.adicionada_em, &a.id)));
        let mut velhas: Vec<&ObraLinha> = todas.iter().filter(|o| o.ultima_leitura.is_none()).collect();
        velhas.sort_by(|a, b| (a.adicionada_em, &a.id).cmp(&(b.adicionada_em, &b.id)));
        let lista = |v: &[&ObraLinha], n: usize| Value::Array(v.iter().take(n).map(|o| o.json()).collect());
        Ok(json!({
            "ultimo": ultimo,
            "emAndamento": lista(&lendo, 12),
            "eco": null,
            "novidades": lista(&novas, 12),
            "esquecidas": lista(&velhas, 3),
            "totalObras": todas.len(),
        }))
    }

    pub fn edicao_abrir(&self, edicao_id: &str) -> Result<Value, ErroFierium> {
        let r: Option<(String, i64)> = self
            .bd
            .query_row(
                "SELECT formato, tamanho FROM arquivos WHERE id = ?1 AND existe = 1",
                params![edicao_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(bd)?;
        let (formato, tamanho) =
            r.ok_or_else(|| ErroFierium::NaoEncontrado(format!("edição {edicao_id} (o arquivo sumiu?)")))?;
        Ok(json!({
            "tipo": "arquivo",
            "edicaoId": edicao_id,
            "formato": formato,
            "url": url_do_arquivo(edicao_id),
            "tamanho": tamanho,
        }))
    }

    pub fn progresso_salvar(&self, edicao_id: &str, posicao: &str, fracao: f64) -> Result<(), ErroFierium> {
        if !(0.0..=1.0).contains(&fracao) {
            return Err(ErroFierium::argumento("fracao", "tem que ficar entre 0 e 1"));
        }
        let existe: bool = self
            .bd
            .query_row("SELECT 1 FROM arquivos WHERE id = ?1", params![edicao_id], |_| Ok(()))
            .optional()
            .map_err(bd)?
            .is_some();
        if !existe {
            return Err(ErroFierium::NaoEncontrado(format!("edição {edicao_id}")));
        }
        let t = agora();
        self.bd
            .execute(
                "INSERT INTO progresso (edicao_id, posicao, fracao, quando) VALUES (?1,?2,?3,?4)
                 ON CONFLICT(edicao_id) DO UPDATE SET posicao=?2, fracao=?3, quando=?4",
                params![edicao_id, posicao, fracao, t],
            )
            .map_err(bd)?;
        if fracao >= LIDA {
            self.bd
                .execute(
                    "UPDATE obras SET estado='lida', ultima_leitura=?2, terminada_em=COALESCE(terminada_em, ?2)
                     WHERE arquivo_id=?1",
                    params![edicao_id, t],
                )
                .map_err(bd)?;
        } else {
            self.bd
                .execute(
                    "UPDATE obras SET estado='lendo', ultima_leitura=?2 WHERE arquivo_id=?1",
                    params![edicao_id, t],
                )
                .map_err(bd)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::fs;

    fn livro(p: &Path, conteudo: &str) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, format!("%PDF-falso {conteudo}")).unwrap();
    }

    fn montar() -> (tempfile::TempDir, tempfile::TempDir, Biblioteca) {
        let dados = tempfile::tempdir().unwrap();
        let livros = tempfile::tempdir().unwrap();
        let b = Biblioteca::abrir(&dados.path().join("fierium.db")).unwrap();
        (dados, livros, b)
    }

    fn n(v: &Value) -> usize {
        v.as_array().unwrap().len()
    }

    #[test]
    fn nome_do_arquivo_vira_titulo_e_autor() {
        assert_eq!(
            titulo_e_autor("Machado de Assis - Dom_Casmurro (1899).PDF"),
            ("Machado de Assis".into(), "Dom Casmurro".into())
        );
        assert_eq!(
            titulo_e_autor("o.alienista.epub"),
            (String::new(), "o alienista".into())
        );
        assert_eq!(titulo_e_autor("Livro (Edição 2).pdf").1, "Livro (Edição 2)");
    }

    #[test]
    fn pasta_varredura_e_filtro_sem_acento() {
        let (_d, l, mut b) = montar();
        livro(&l.path().join("Machado - Memórias Póstumas.pdf"), "a");
        livro(&l.path().join("sub/Eça de Queirós - O Primo Basílio.EPUB"), "b");
        livro(&l.path().join(".oculta/escondido.pdf"), "c");
        fs::write(l.path().join("nota.txt"), "x").unwrap();
        assert_eq!(
            b.pastas_adicionar("/nao/existe/mesmo").unwrap_err().codigo(),
            "ARGUMENTO_INVALIDO"
        );
        let pastas = b.pastas_adicionar(l.path().to_str().unwrap()).unwrap();
        assert_eq!(pastas[0]["existe"], true);
        let r = b.varrer().unwrap();
        assert_eq!(
            (r["novos"].as_i64(), r["sumiram"].as_i64(), r["total"].as_i64()),
            (Some(2), Some(0), Some(2))
        );
        assert_eq!(b.varrer().unwrap()["novos"], 0);
        assert_eq!(b.pastas_listar().unwrap()[0]["arquivos"], 2);
        let achou = b.obras_listar(&json!({ "texto": "MEMORIAS postumas" })).unwrap();
        assert_eq!(n(&achou), 1);
        assert_eq!(achou[0]["titulo"], "Memórias Póstumas");
        assert_eq!(achou[0]["criadores"][0]["nome"], "Machado");
        assert_eq!(n(&b.obras_listar(&json!({ "formato": "epub" })).unwrap()), 1);
        assert_eq!(n(&b.obras_listar(&json!({ "texto": "queiros basilio" })).unwrap()), 1);
        assert_eq!(n(&b.obras_listar(&json!({ "texto": "nada disso" })).unwrap()), 0);
        assert_eq!(b.arquivos_existentes().unwrap().len(), 2);
    }

    #[test]
    fn mover_mantem_id_e_progresso_e_apagar_marca_sumiu() {
        let (_d, l, mut b) = montar();
        livro(&l.path().join("Autor - Um.pdf"), "um");
        livro(&l.path().join("Autor - Dois.pdf"), "dois");
        b.pastas_adicionar(l.path().to_str().unwrap()).unwrap();
        b.varrer().unwrap();
        let obras = b.obras_listar(&json!({ "texto": "um" })).unwrap();
        let id_obra = obras[0]["id"].as_str().unwrap().to_string();
        let edicao = obras[0]["edicoes"][0]["id"].as_str().unwrap().to_string();
        b.progresso_salvar(&edicao, "12", 0.4).unwrap();

        fs::create_dir_all(l.path().join("novo")).unwrap();
        fs::rename(
            l.path().join("Autor - Um.pdf"),
            l.path().join("novo/Renomeado - Um.pdf"),
        )
        .unwrap();
        fs::remove_file(l.path().join("Autor - Dois.pdf")).unwrap();
        let r = b.varrer().unwrap();
        assert_eq!(
            (r["novos"].as_i64(), r["sumiram"].as_i64(), r["total"].as_i64()),
            (Some(0), Some(1), Some(1))
        );
        let o = b.obra_obter(&id_obra).unwrap();
        assert_eq!(o["edicoes"][0]["id"], edicao.as_str());
        assert_eq!(o["edicoes"][0]["progresso"]["fracao"], 0.4);
        assert_eq!(o["edicoes"][0]["arquivos"][0]["caminho"], "novo/Renomeado - Um.pdf");
        assert_eq!(b.edicao_abrir(&edicao).unwrap()["tipo"], "arquivo");
        assert_eq!(n(&b.obras_listar(&json!({})).unwrap()), 1);
        assert_eq!(b.edicao_abrir("nao-existe").unwrap_err().codigo(), "NAO_ENCONTRADO");
    }

    #[test]
    fn progresso_alimenta_o_limiar() {
        let (_d, l, mut b) = montar();
        for nome in ["A", "B", "C"] {
            livro(&l.path().join(format!("{nome}.pdf")), nome);
        }
        b.pastas_adicionar(l.path().to_str().unwrap()).unwrap();
        b.varrer().unwrap();
        let lim = b.limiar().unwrap();
        assert_eq!(lim["ultimo"], Value::Null);
        assert_eq!(lim["totalObras"], 3);
        assert_eq!(n(&lim["esquecidas"]), 3);
        let obras = b.obras_listar(&json!({ "ordem": "titulo" })).unwrap();
        let ed = |i: usize| obras[i]["edicoes"][0]["id"].as_str().unwrap().to_string();
        b.progresso_salvar(&ed(1), "9", 1.0).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(3));
        b.progresso_salvar(&ed(0), "3", 0.2).unwrap();
        let lim = b.limiar().unwrap();
        assert_eq!(lim["ultimo"]["titulo"], "A");
        assert_eq!(n(&lim["emAndamento"]), 1);
        assert_eq!(n(&lim["esquecidas"]), 1);
        let lida = b.obra_obter(obras[1]["id"].as_str().unwrap()).unwrap();
        assert_eq!(lida["relacao"]["estado"], "lida");
        assert!(lida["relacao"]["terminadaEm"].is_i64());
        let fav = b
            .obra_atualizar(obras[2]["id"].as_str().unwrap(), Some(true), None)
            .unwrap();
        assert_eq!(fav["relacao"]["favorita"], true);
        assert_eq!(n(&b.obras_listar(&json!({ "favoritas": true })).unwrap()), 1);
        assert_eq!(
            b.progresso_salvar(&ed(0), "x", 2.0).unwrap_err().codigo(),
            "ARGUMENTO_INVALIDO"
        );
    }
}
