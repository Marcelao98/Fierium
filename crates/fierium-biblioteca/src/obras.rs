//! Obra ≠ edição ≠ arquivo (MODELO_DE_DADOS §1–2). A **obra** é o livro; cada **edição** é uma forma dele (o PDF, o
//! EPUB, outra tradução); cada **arquivo** é uma cópia no disco. Aqui ficam: a chave que reconhece a mesma obra
//! (título + primeiro autor normalizados), a migração v3 (que junta o que já estava no banco sem perder progresso nem
//! marcações), a leitura das obras com as edições e o juntar/separar à mão.
use super::{agora, bd, matiz_do_titulo, normalizar, novo_id, titulo_e_autor, Biblioteca};
use fierium_core::ErroFierium;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::collections::HashMap;

const ARTIGOS: &[&str] = &[
    "o", "a", "os", "as", "um", "uma", "uns", "umas", "the", "an", "el", "la", "los", "las",
];

/// Minúsculas, sem acento, sem pontuação, um espaço só entre as palavras.
fn palavras(s: &str) -> Vec<String> {
    normalizar(s)
        .split(|c: char| !c.is_alphanumeric())
        .filter(|p| !p.is_empty())
        .map(String::from)
        .collect()
}

/// A chave do título: "O Alienista", "Alienista, O" e "o alienista!" dão a mesma ("alienista").
pub fn chave_do_titulo(titulo: &str) -> String {
    let t = normalizar(titulo);
    // artigo no fim, depois da vírgula ("Alienista, O")
    let t = match t.rsplit_once(',') {
        Some((resto, fim)) if ARTIGOS.contains(&fim.trim()) && !resto.trim().is_empty() => resto.to_string(),
        _ => t,
    };
    let mut p = palavras(&t);
    if p.len() > 1 && ARTIGOS.contains(&p[0].as_str()) {
        p.remove(0);
    }
    p.join(" ")
}

/// A chave do autor (o primeiro criador): só normaliza.
pub fn chave_do_autor(autor: &str) -> String {
    palavras(autor).join(" ")
}

/// A obra que já tem uma edição com esta chave (edições separadas à mão não contam: a escolha da pessoa vale).
/// Mesmo título e mesmo autor = mesma obra. Se um dos lados não tem autor, vale o título, desde que aponte pra uma
/// obra só (dois livros diferentes com o mesmo título não são misturados).
pub(crate) fn achar_obra(c: &Connection, titulo: &str, autor: &str) -> Result<Option<String>, ErroFierium> {
    if titulo.is_empty() {
        return Ok(None);
    }
    let exata: Option<String> = c
        .query_row(
            "SELECT obra_id FROM edicoes WHERE separada = 0 AND chave_titulo = ?1 AND chave_autor = ?2
             ORDER BY criada_em, id LIMIT 1",
            params![titulo, autor],
            |r| r.get(0),
        )
        .optional()
        .map_err(bd)?;
    if exata.is_some() {
        return Ok(exata);
    }
    let sql = if autor.is_empty() {
        "SELECT DISTINCT obra_id FROM edicoes WHERE separada = 0 AND chave_titulo = ?1"
    } else {
        "SELECT DISTINCT obra_id FROM edicoes WHERE separada = 0 AND chave_titulo = ?1 AND chave_autor = ''"
    };
    let mut st = c.prepare(sql).map_err(bd)?;
    let mut achadas: Vec<String> = st
        .query_map(params![titulo], |r| r.get(0))
        .map_err(bd)?
        .collect::<Result<_, _>>()
        .map_err(bd)?;
    Ok(if achadas.len() == 1 { achadas.pop() } else { None })
}

/// O que é pessoal na obra (pra somar quando duas viram uma).
struct Relacao {
    estado: String,
    favorita: bool,
    adicionada_em: i64,
    ultima_leitura: Option<i64>,
    terminada_em: Option<i64>,
}

fn ler_relacao(c: &Connection, tabela: &str, id: &str) -> Result<Relacao, ErroFierium> {
    c.query_row(
        &format!("SELECT estado, favorita, adicionada_em, ultima_leitura, terminada_em FROM {tabela} WHERE id = ?1"),
        params![id],
        |r| {
            Ok(Relacao {
                estado: r.get(0)?,
                favorita: r.get::<_, i64>(1)? != 0,
                adicionada_em: r.get(2)?,
                ultima_leitura: r.get(3)?,
                terminada_em: r.get(4)?,
            })
        },
    )
    .optional()
    .map_err(bd)?
    .ok_or_else(|| ErroFierium::NaoEncontrado(format!("obra {id}")))
}

/// Soma a relação de uma obra que vai sumir na que fica: favorita se uma era, a data mais antiga de entrada, a
/// leitura mais recente (e o estado de quem foi lida por último).
fn absorver_relacao(c: &Connection, alvo: &str, outra: &Relacao) -> Result<(), ErroFierium> {
    let a = ler_relacao(c, "obras", alvo)?;
    let outra_mais_recente = outra.ultima_leitura > a.ultima_leitura;
    let estado = if outra_mais_recente || (a.estado == "nao-lida" && a.ultima_leitura == outra.ultima_leitura) {
        &outra.estado
    } else {
        &a.estado
    };
    c.execute(
        "UPDATE obras SET estado = ?2, favorita = ?3, adicionada_em = ?4, ultima_leitura = ?5, terminada_em = ?6
         WHERE id = ?1",
        params![
            alvo,
            estado,
            (a.favorita || outra.favorita) as i64,
            a.adicionada_em.min(outra.adicionada_em),
            a.ultima_leitura.max(outra.ultima_leitura),
            a.terminada_em.max(outra.terminada_em),
        ],
    )
    .map_err(bd)?;
    Ok(())
}

/// Migração v3: de "uma obra por arquivo" pra obra → edições → arquivos. O id de cada edição que já existia é o id
/// do arquivo dela (é o que o progresso e as marcações já guardavam), então nada precisa ser reescrito pra continuar
/// valendo. Arquivos iguais (mesma impressão) viram uma edição só; obras com a mesma chave viram uma obra só.
pub(crate) fn migrar_v3(c: &mut Connection) -> Result<(), ErroFierium> {
    // as tabelas são recriadas: as referências ficam desligadas só durante a troca
    c.execute_batch("PRAGMA foreign_keys = OFF;").map_err(bd)?;
    let r = migrar_v3_dentro(c);
    c.execute_batch("PRAGMA foreign_keys = ON;").map_err(bd)?;
    r
}

fn migrar_v3_dentro(c: &mut Connection) -> Result<(), ErroFierium> {
    let tx = c.transaction().map_err(bd)?;
    tx.execute_batch(
        "CREATE TABLE edicoes (
            id TEXT PRIMARY KEY, obra_id TEXT NOT NULL, formato TEXT NOT NULL,
            chave_titulo TEXT NOT NULL, chave_autor TEXT NOT NULL,
            separada INTEGER NOT NULL DEFAULT 0, criada_em INTEGER NOT NULL);
         CREATE INDEX edicoes_obra ON edicoes (obra_id);
         CREATE INDEX edicoes_chave ON edicoes (chave_titulo);
         ALTER TABLE arquivos ADD COLUMN edicao_id TEXT REFERENCES edicoes(id);
         CREATE INDEX arquivos_edicao ON arquivos (edicao_id);
         ALTER TABLE obras RENAME TO obras_v2;
         ALTER TABLE progresso RENAME TO progresso_v2;
         CREATE TABLE obras (
            id TEXT PRIMARY KEY, titulo TEXT NOT NULL, autor TEXT NOT NULL, matiz INTEGER NOT NULL,
            adicionada_em INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT 'nao-lida',
            favorita INTEGER NOT NULL DEFAULT 0, ultima_leitura INTEGER, terminada_em INTEGER);
         CREATE TABLE progresso (
            edicao_id TEXT PRIMARY KEY REFERENCES edicoes(id), posicao TEXT NOT NULL,
            fracao REAL NOT NULL, quando INTEGER NOT NULL);",
    )
    .map_err(bd)?;

    struct Antiga {
        obra: String,
        titulo: String,
        autor: String,
        matiz: i64,
        arquivo: String,
        formato: String,
        impressao: String,
        progresso: Option<(String, f64, i64)>,
    }
    let antigas: Vec<Antiga> = {
        let mut st = tx
            .prepare(
                "SELECT o.id, o.titulo, o.autor, o.matiz, a.id, a.formato, a.impressao, p.posicao, p.fracao, p.quando
                 FROM obras_v2 o JOIN arquivos a ON a.id = o.arquivo_id
                 LEFT JOIN progresso_v2 p ON p.edicao_id = a.id
                 ORDER BY o.adicionada_em, o.id",
            )
            .map_err(bd)?;
        let v = st
            .query_map([], |r| {
                let posicao: Option<String> = r.get(7)?;
                Ok(Antiga {
                    obra: r.get(0)?,
                    titulo: r.get(1)?,
                    autor: r.get(2)?,
                    matiz: r.get(3)?,
                    arquivo: r.get(4)?,
                    formato: r.get(5)?,
                    impressao: r.get(6)?,
                    progresso: match posicao {
                        Some(p) => Some((p, r.get(8)?, r.get(9)?)),
                        None => None,
                    },
                })
            })
            .map_err(bd)?
            .collect::<Result<_, _>>()
            .map_err(bd)?;
        v
    };

    let mut edicao_da_impressao: HashMap<String, String> = HashMap::new();
    let mut obra_da_edicao: HashMap<String, String> = HashMap::new();
    let mut progressos: HashMap<String, (String, f64, i64)> = HashMap::new();
    for a in &antigas {
        let relacao = ler_relacao(&tx, "obras_v2", &a.obra)?;
        let (edicao, obra) = match edicao_da_impressao.get(&a.impressao) {
            // o mesmo arquivo em outra pasta: mais uma cópia da mesma edição
            Some(e) => (e.clone(), obra_da_edicao[e].clone()),
            None => {
                let (kt, ka) = (chave_do_titulo(&a.titulo), chave_do_autor(&a.autor));
                let obra = match achar_obra(&tx, &kt, &ka)? {
                    Some(o) => o,
                    None => {
                        tx.execute(
                            "INSERT INTO obras (id, titulo, autor, matiz, adicionada_em, estado, favorita,
                                ultima_leitura, terminada_em) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
                            params![
                                a.obra,
                                a.titulo,
                                a.autor,
                                a.matiz,
                                relacao.adicionada_em,
                                relacao.estado,
                                relacao.favorita as i64,
                                relacao.ultima_leitura,
                                relacao.terminada_em
                            ],
                        )
                        .map_err(bd)?;
                        a.obra.clone()
                    }
                };
                tx.execute(
                    "INSERT INTO edicoes (id, obra_id, formato, chave_titulo, chave_autor, criada_em)
                     VALUES (?1,?2,?3,?4,?5,?6)",
                    params![a.arquivo, obra, a.formato, kt, ka, relacao.adicionada_em],
                )
                .map_err(bd)?;
                edicao_da_impressao.insert(a.impressao.clone(), a.arquivo.clone());
                obra_da_edicao.insert(a.arquivo.clone(), obra.clone());
                (a.arquivo.clone(), obra)
            }
        };
        tx.execute(
            "UPDATE arquivos SET edicao_id = ?2 WHERE id = ?1",
            params![a.arquivo, edicao],
        )
        .map_err(bd)?;
        if obra != a.obra {
            absorver_relacao(&tx, &obra, &relacao)?;
        }
        // as marcações seguem a edição e a obra que ficaram
        tx.execute(
            "UPDATE marcacoes SET obra_id = ?3, edicao_id = ?4 WHERE obra_id = ?1 OR edicao_id = ?2",
            params![a.obra, a.arquivo, obra, edicao],
        )
        .map_err(bd)?;
        if let Some(p) = &a.progresso {
            // duas cópias do mesmo arquivo com progresso: vale o mais recente
            if progressos.get(&edicao).is_none_or(|atual| p.2 > atual.2) {
                progressos.insert(edicao.clone(), p.clone());
            }
        }
    }
    for (edicao, (posicao, fracao, quando)) in &progressos {
        tx.execute(
            "INSERT INTO progresso (edicao_id, posicao, fracao, quando) VALUES (?1,?2,?3,?4)",
            params![edicao, posicao, fracao, quando],
        )
        .map_err(bd)?;
    }
    tx.execute_batch(
        "DELETE FROM arquivos WHERE edicao_id IS NULL;
         DROP TABLE obras_v2;
         DROP TABLE progresso_v2;
         PRAGMA user_version = 3;",
    )
    .map_err(bd)?;
    tx.commit().map_err(bd)
}

// ---------- leitura (obra com as edições e os arquivos) ----------

pub(crate) struct ArquivoLinha {
    pub id: String,
    pub nome: String,
    pub rel: String,
    pub tamanho: i64,
    pub existe: bool,
}

pub(crate) struct EdicaoLinha {
    pub id: String,
    pub formato: String,
    pub arquivos: Vec<ArquivoLinha>,
    pub progresso: Option<(String, f64, i64)>,
}

impl EdicaoLinha {
    pub fn disponivel(&self) -> bool {
        self.arquivos.iter().any(|a| a.existe)
    }

    fn lida_em(&self) -> Option<i64> {
        self.progresso.as_ref().map(|p| p.2)
    }

    fn json(&self, obra_id: &str) -> Value {
        let mut e = json!({
            "id": self.id,
            "obraId": obra_id,
            "formato": self.formato,
            "idioma": "",
            "descricao": "",
            "arquivos": self.arquivos.iter().map(|a| json!({
                "id": a.id,
                "nome": a.nome,
                "caminho": a.rel,
                "tamanho": a.tamanho,
                "disponivel": a.existe,
            })).collect::<Vec<_>>(),
        });
        if let Some((posicao, fracao, quando)) = &self.progresso {
            e["progresso"] = json!({ "posicao": posicao, "fracao": fracao, "quando": quando });
        }
        e
    }
}

pub(crate) struct ObraLinha {
    pub id: String,
    pub titulo: String,
    pub autor: String,
    pub matiz: i64,
    pub adicionada_em: i64,
    pub estado: String,
    pub favorita: bool,
    pub ultima_leitura: Option<i64>,
    pub terminada_em: Option<i64>,
    /// a primeira é a que "Continuar"/"Ler" abre: a lida por último; nunca aberta, EPUB antes de PDF
    pub edicoes: Vec<EdicaoLinha>,
}

impl ObraLinha {
    /// Quanto já foi lido: o da edição lida por último.
    pub fn fracao(&self) -> f64 {
        self.edicoes
            .iter()
            .filter_map(|e| e.progresso.as_ref())
            .max_by_key(|p| p.2)
            .map_or(0.0, |p| p.1)
    }

    pub fn disponivel(&self) -> bool {
        self.edicoes.iter().any(EdicaoLinha::disponivel)
    }

    pub fn tem_formato(&self, formato: &str) -> bool {
        self.edicoes.iter().any(|e| e.disponivel() && e.formato == formato)
    }

    pub fn json(&self) -> Value {
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
            "edicoes": self.edicoes.iter().map(|e| e.json(&self.id)).collect::<Vec<_>>(),
            "relacao": relacao,
        })
    }
}

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
        achar_obra(&self.bd, &chave_do_titulo(titulo), &chave_do_autor(autor))
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
                    "SELECT e.obra_id, e.id, e.formato, p.posicao, p.fracao, p.quando
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
                    ))
                })
                .map_err(bd)?;
            for l in linhas {
                let (obra, id, formato, progresso) = l.map_err(bd)?;
                let arqs = arquivos.remove(&id).unwrap_or_default();
                edicoes.entry(obra).or_default().push(EdicaoLinha {
                    id,
                    formato,
                    arquivos: arqs,
                    progresso,
                });
            }
        }
        let sql = "SELECT id, titulo, autor, matiz, adicionada_em, estado, favorita, ultima_leitura, terminada_em
                   FROM obras";
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

    /// Junta obras à mão: todas viram a primeira (`ids[0]`), com as edições, as marcações e a relação das outras.
    /// A varredura não desfaz: ela só decide a obra de arquivo NOVO, e os novos seguem as edições pra onde elas foram.
    pub fn obra_juntar(&self, ids: &[String]) -> Result<Value, ErroFierium> {
        let mut unicos: Vec<&String> = Vec::new();
        for id in ids {
            if !unicos.contains(&id) {
                unicos.push(id);
            }
        }
        if unicos.len() < 2 {
            return Err(ErroFierium::argumento(
                "ids",
                "preciso de duas obras diferentes pra juntar",
            ));
        }
        for id in &unicos {
            self.uma(id)?;
        }
        let alvo = unicos[0];
        let tx = self.bd.unchecked_transaction().map_err(bd)?;
        for outra in &unicos[1..] {
            let relacao = ler_relacao(&tx, "obras", outra)?;
            absorver_relacao(&tx, alvo, &relacao)?;
            tx.execute(
                "UPDATE edicoes SET obra_id = ?2 WHERE obra_id = ?1",
                params![outra, alvo],
            )
            .map_err(bd)?;
            tx.execute(
                "UPDATE marcacoes SET obra_id = ?2 WHERE obra_id = ?1",
                params![outra, alvo],
            )
            .map_err(bd)?;
            tx.execute("DELETE FROM obras WHERE id = ?1", params![outra])
                .map_err(bd)?;
        }
        tx.commit().map_err(bd)?;
        self.obra_obter(alvo)
    }

    /// Separa uma edição à mão: ela vira uma obra própria (com o progresso e as marcações dela) e fica marcada
    /// como separada, pra nenhuma varredura juntar de novo nem mandar arquivos novos atrás dela.
    pub fn edicao_separar(&self, edicao_id: &str) -> Result<Value, ErroFierium> {
        let obra_id: String = self
            .bd
            .query_row("SELECT obra_id FROM edicoes WHERE id = ?1", params![edicao_id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(bd)?
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("edição {edicao_id}")))?;
        let obra = self.uma(&obra_id)?;
        if obra.edicoes.len() < 2 {
            return Err(ErroFierium::argumento(
                "edicaoId",
                "esta é a única edição da obra: não há do que separar",
            ));
        }
        let edicao = obra
            .edicoes
            .iter()
            .find(|e| e.id == edicao_id)
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("edição {edicao_id}")))?;
        // o nome da obra nova vem do arquivo da edição (como numa obra recém-achada)
        let (autor, titulo) = match edicao.arquivos.first() {
            Some(a) => titulo_e_autor(&a.nome),
            None => (obra.autor.clone(), obra.titulo.clone()),
        };
        let (estado, lida_em) = match &edicao.progresso {
            Some((_, f, quando)) if *f >= super::LIDA => ("lida", Some(*quando)),
            Some((_, _, quando)) => ("lendo", Some(*quando)),
            None => ("nao-lida", None),
        };
        let nova = novo_id();
        let tx = self.bd.unchecked_transaction().map_err(bd)?;
        tx.execute(
            "INSERT INTO obras (id, titulo, autor, matiz, adicionada_em, estado, ultima_leitura, terminada_em)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                nova,
                titulo,
                autor,
                matiz_do_titulo(&titulo),
                agora(),
                estado,
                lida_em,
                if estado == "lida" { lida_em } else { None }
            ],
        )
        .map_err(bd)?;
        tx.execute(
            "UPDATE edicoes SET obra_id = ?2, separada = 1 WHERE id = ?1",
            params![edicao_id, nova],
        )
        .map_err(bd)?;
        tx.execute(
            "UPDATE marcacoes SET obra_id = ?2 WHERE edicao_id = ?1",
            params![edicao_id, nova],
        )
        .map_err(bd)?;
        tx.commit().map_err(bd)?;
        self.obra_obter(&nova)
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::fs;
    use std::path::Path;

    fn livro(p: &Path, conteudo: &str) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, format!("%PDF-falso {conteudo}")).unwrap();
    }

    fn montar() -> (tempfile::TempDir, tempfile::TempDir, Biblioteca) {
        let dados = tempfile::tempdir().unwrap();
        let livros = tempfile::tempdir().unwrap();
        let b = Biblioteca::abrir(&dados.path().join("fierium.db")).unwrap();
        b.pastas_adicionar(livros.path().to_str().unwrap()).unwrap();
        (dados, livros, b)
    }

    fn todas(b: &Biblioteca) -> Vec<Value> {
        b.obras_listar(&json!({ "ordem": "titulo" }))
            .unwrap()
            .as_array()
            .unwrap()
            .clone()
    }

    fn formatos(o: &Value) -> Vec<&str> {
        o["edicoes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| e["formato"].as_str().unwrap())
            .collect()
    }

    #[test]
    fn chave_ignora_artigo_acento_e_pontuacao() {
        assert_eq!(chave_do_titulo("O Alienista"), "alienista");
        assert_eq!(chave_do_titulo("Alienista, O"), "alienista");
        assert_eq!(chave_do_titulo("  o  ALIENISTA! "), "alienista");
        assert_eq!(
            chave_do_titulo("Memórias Póstumas de Brás Cubas"),
            "memorias postumas de bras cubas"
        );
        assert_eq!(chave_do_titulo("The Hobbit"), chave_do_titulo("Hobbit, The"));
        // um título que é só o artigo continua sendo ele mesmo
        assert_eq!(chave_do_titulo("A"), "a");
        assert_ne!(chave_do_titulo("O Alienista"), chave_do_titulo("O Ateneu"));
        assert_eq!(chave_do_autor("Machado de Assis"), chave_do_autor("machado  de ASSIS."));
    }

    #[test]
    fn pdf_e_epub_do_mesmo_livro_viram_uma_obra_com_duas_edicoes() {
        let (_d, l, mut b) = montar();
        livro(&l.path().join("Terry Pratchett - Guards! Guards!.pdf"), "pdf");
        livro(&l.path().join("epub/Terry Pratchett - Guards! Guards!.epub"), "epub");
        livro(&l.path().join("Outro - Livro.pdf"), "outro");
        let r = b.varrer().unwrap();
        assert_eq!((r["novos"].as_i64(), r["total"].as_i64()), (Some(3), Some(3)));
        let obras = todas(&b);
        assert_eq!(obras.len(), 2);
        let guards = &obras[0];
        assert_eq!(guards["titulo"], "Guards! Guards!");
        // nunca aberta: o EPUB vem antes do PDF (é o que "Ler" abre)
        assert_eq!(formatos(guards), ["epub", "pdf"]);
        for e in guards["edicoes"].as_array().unwrap() {
            assert_eq!(e["obraId"], guards["id"]);
            assert_eq!(e["arquivos"].as_array().unwrap().len(), 1);
        }
        // os filtros enxergam as duas formas
        assert_eq!(
            b.obras_listar(&json!({ "formato": "epub" }))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            b.obras_listar(&json!({ "formato": "pdf" }))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            2
        );
        assert_eq!(b.limiar().unwrap()["totalObras"], 2);

        // ler o PDF: ele passa a ser a edição que "Continuar" abre, e o EPUB continua sem progresso
        let pdf = guards["edicoes"][1]["id"].as_str().unwrap();
        b.progresso_salvar(pdf, "12", 0.3).unwrap();
        let o = b.obra_obter(guards["id"].as_str().unwrap()).unwrap();
        assert_eq!(formatos(&o), ["pdf", "epub"]);
        assert_eq!(o["edicoes"][0]["progresso"]["posicao"], "12");
        assert!(o["edicoes"][1].get("progresso").is_none());
        assert_eq!(o["relacao"]["estado"], "lendo");
        // cada edição abre o arquivo dela
        let fonte = b.edicao_abrir(pdf).unwrap();
        assert_eq!(
            (fonte["formato"].as_str(), fonte["edicaoId"].as_str()),
            (Some("pdf"), Some(pdf))
        );
        assert!(fonte["url"]
            .as_str()
            .unwrap()
            .ends_with(o["edicoes"][0]["arquivos"][0]["id"].as_str().unwrap()));
    }

    #[test]
    fn o_alienista_e_alienista_o_juntam_e_sem_autor_vale_o_titulo() {
        let (_d, l, mut b) = montar();
        livro(&l.path().join("Machado de Assis - O Alienista.pdf"), "1");
        livro(&l.path().join("Machado de Assis - Alienista, O.epub"), "2");
        livro(&l.path().join("o.alienista.epub"), "3");
        b.varrer().unwrap();
        let obras = todas(&b);
        assert_eq!(obras.len(), 1);
        assert_eq!(obras[0]["edicoes"].as_array().unwrap().len(), 3);

        // mesmo título com autores diferentes: são livros diferentes, e o sem autor não escolhe um lado
        livro(&l.path().join("Ana - Contos.pdf"), "4");
        livro(&l.path().join("Bia - Contos.pdf"), "5");
        b.varrer().unwrap();
        livro(&l.path().join("Contos.epub"), "6");
        b.varrer().unwrap();
        assert_eq!(todas(&b).len(), 4);
    }

    #[test]
    fn mesmo_arquivo_em_duas_pastas_e_uma_edicao_com_dois_arquivos() {
        let (_d, l, mut b) = montar();
        livro(&l.path().join("a/Autor - Livro.pdf"), "igual");
        livro(&l.path().join("b/Autor - Livro.pdf"), "igual");
        let r = b.varrer().unwrap();
        // um livro novo (a cópia não é outro livro); dois arquivos no disco
        assert_eq!((r["novos"].as_i64(), r["total"].as_i64()), (Some(1), Some(2)));
        let obras = todas(&b);
        assert_eq!(obras.len(), 1);
        assert_eq!(obras[0]["edicoes"].as_array().unwrap().len(), 1);
        assert_eq!(obras[0]["edicoes"][0]["arquivos"].as_array().unwrap().len(), 2);
        let edicao = obras[0]["edicoes"][0]["id"].as_str().unwrap().to_string();
        b.progresso_salvar(&edicao, "5", 0.5).unwrap();

        // apagar uma cópia: a edição continua abrindo pela outra, com o progresso
        fs::remove_file(l.path().join("a/Autor - Livro.pdf")).unwrap();
        b.varrer().unwrap();
        let o = &todas(&b)[0];
        assert_eq!(o["edicoes"][0]["progresso"]["fracao"], 0.5);
        assert_eq!(o["edicoes"][0]["arquivos"][0]["caminho"], "b/Autor - Livro.pdf");
        assert_eq!(o["edicoes"][0]["arquivos"][0]["disponivel"], true);
        assert_eq!(o["edicoes"][0]["arquivos"][1]["disponivel"], false);
        let fonte = b.edicao_abrir(&edicao).unwrap();
        assert!(fonte["url"]
            .as_str()
            .unwrap()
            .ends_with(o["edicoes"][0]["arquivos"][0]["id"].as_str().unwrap()));
    }

    #[test]
    fn separar_e_varrer_de_novo_nao_junta_outra_vez() {
        let (_d, l, mut b) = montar();
        livro(&l.path().join("Autor - Livro.pdf"), "pdf");
        livro(&l.path().join("Autor - Livro.epub"), "epub");
        b.varrer().unwrap();
        let obra = todas(&b).remove(0);
        let id = obra["id"].as_str().unwrap();
        let (epub, pdf) = (
            obra["edicoes"][0]["id"].as_str().unwrap(),
            obra["edicoes"][1]["id"].as_str().unwrap(),
        );
        b.progresso_salvar(pdf, "7", 0.25).unwrap();
        let marca = b
            .marcacao_criar(&json!({
                "obraId": id, "edicaoId": pdf, "tipo": "destaque", "trecho": "um trecho", "cor": "ideia",
                "ancora": { "tipo": "pdf", "pagina": 7, "retangulos": [] }, "etiquetas": [], "ligacoes": [],
            }))
            .unwrap();

        let nova = b.edicao_separar(pdf).unwrap();
        assert_ne!(nova["id"], obra["id"]);
        assert_eq!(nova["edicoes"][0]["id"], pdf);
        assert_eq!(nova["edicoes"][0]["progresso"]["posicao"], "7");
        assert_eq!(nova["relacao"]["estado"], "lendo");
        // a marcação foi junto com a edição dela
        let marcas = b.marcacoes_listar(&json!({ "obraId": nova["id"] })).unwrap();
        assert_eq!(marcas[0]["id"], marca["id"]);
        assert_eq!(b.marcacoes_listar(&json!({ "obraId": id })).unwrap(), json!([]));
        assert_eq!(todas(&b).len(), 2);

        // varrer de novo (até com o arquivo mudando de lugar) respeita a escolha
        b.varrer().unwrap();
        fs::create_dir_all(l.path().join("outra")).unwrap();
        fs::rename(
            l.path().join("Autor - Livro.pdf"),
            l.path().join("outra/Autor - Livro.pdf"),
        )
        .unwrap();
        b.varrer().unwrap();
        assert_eq!(todas(&b).len(), 2);
        // um arquivo novo do mesmo livro vai pra obra original, não pra edição separada
        livro(&l.path().join("Autor - Livro (2020).epub"), "outra tradução");
        b.varrer().unwrap();
        let obras = todas(&b);
        assert_eq!(obras.len(), 2);
        let original = obras.iter().find(|o| o["id"] == obra["id"]).unwrap();
        assert_eq!(original["edicoes"].as_array().unwrap().len(), 2);
        assert!(original["edicoes"].as_array().unwrap().iter().any(|e| e["id"] == epub));

        // a única edição de uma obra não se separa
        assert_eq!(b.edicao_separar(pdf).unwrap_err().codigo(), "ARGUMENTO_INVALIDO");
        assert_eq!(b.edicao_separar("nada").unwrap_err().codigo(), "NAO_ENCONTRADO");
    }

    #[test]
    fn juntar_a_mao_soma_tudo_e_a_varredura_respeita() {
        let (_d, l, mut b) = montar();
        livro(&l.path().join("Frankenstein.pdf"), "pdf");
        livro(&l.path().join("shelley-frankenstein.epub"), "epub");
        b.varrer().unwrap();
        let obras = todas(&b);
        assert_eq!(obras.len(), 2);
        let (pdf, epub) = (&obras[0], &obras[1]);
        let ed_pdf = pdf["edicoes"][0]["id"].as_str().unwrap();
        let ed_epub = epub["edicoes"][0]["id"].as_str().unwrap();
        b.progresso_salvar(ed_epub, "epubcfi(/6/4)", 0.6).unwrap();
        b.obra_atualizar(epub["id"].as_str().unwrap(), Some(true), None)
            .unwrap();
        b.marcacao_criar(&json!({
            "obraId": epub["id"], "edicaoId": ed_epub, "tipo": "destaque", "trecho": "do epub", "cor": "ideia",
            "ancora": { "tipo": "epub", "cfiInicio": "a", "cfiFim": "b" }, "etiquetas": [], "ligacoes": [],
        }))
        .unwrap();

        let ids = [
            pdf["id"].as_str().unwrap().to_string(),
            epub["id"].as_str().unwrap().to_string(),
        ];
        let junta = b.obra_juntar(&ids).unwrap();
        assert_eq!(junta["id"], pdf["id"]);
        assert_eq!(junta["titulo"], "Frankenstein");
        // a lida por último (o EPUB) é a que "Continuar" abre; nada se perdeu
        assert_eq!(junta["edicoes"][0]["id"], ed_epub);
        assert_eq!(junta["edicoes"][0]["progresso"]["fracao"], 0.6);
        assert_eq!(junta["edicoes"][1]["id"], ed_pdf);
        assert_eq!(junta["relacao"]["favorita"], true);
        assert_eq!(junta["relacao"]["estado"], "lendo");
        assert_eq!(
            b.marcacoes_listar(&json!({ "obraId": pdf["id"] })).unwrap()[0]["trecho"],
            "do epub"
        );
        assert_eq!(todas(&b).len(), 1);
        assert_eq!(
            b.obra_obter(epub["id"].as_str().unwrap()).unwrap_err().codigo(),
            "NAO_ENCONTRADO"
        );

        // a varredura seguinte não desfaz, e outra cópia do EPUB (nome da obra que sumiu) entra na obra junta
        b.varrer().unwrap();
        livro(&l.path().join("shelley-frankenstein (1818).epub"), "outra");
        b.varrer().unwrap();
        let obras = todas(&b);
        assert_eq!(obras.len(), 1);
        assert_eq!(obras[0]["edicoes"].as_array().unwrap().len(), 3);

        assert_eq!(b.obra_juntar(&ids[..1]).unwrap_err().codigo(), "ARGUMENTO_INVALIDO");
        assert_eq!(
            b.obra_juntar(&[ids[0].clone(), "nada".into()]).unwrap_err().codigo(),
            "NAO_ENCONTRADO"
        );
    }

    /// Um banco da versão 2 (uma obra por arquivo), com progresso e marcações, tem de chegar inteiro na v3.
    #[test]
    fn banco_v2_migra_pra_v3_sem_perder_progresso_nem_marcacoes() {
        let dados = tempfile::tempdir().unwrap();
        let caminho = dados.path().join("fierium.db");
        {
            let c = Connection::open(&caminho).unwrap();
            c.execute_batch(
                "CREATE TABLE pastas (caminho TEXT PRIMARY KEY, adicionada_em INTEGER NOT NULL);
                 CREATE TABLE arquivos (id TEXT PRIMARY KEY, pasta TEXT NOT NULL, caminho_rel TEXT NOT NULL,
                    nome TEXT NOT NULL, formato TEXT NOT NULL, tamanho INTEGER NOT NULL, impressao TEXT NOT NULL,
                    existe INTEGER NOT NULL DEFAULT 1, visto_em INTEGER NOT NULL);
                 CREATE INDEX arquivos_impressao ON arquivos (impressao);
                 CREATE TABLE obras (id TEXT PRIMARY KEY, arquivo_id TEXT NOT NULL UNIQUE REFERENCES arquivos(id),
                    titulo TEXT NOT NULL, autor TEXT NOT NULL, matiz INTEGER NOT NULL, adicionada_em INTEGER NOT NULL,
                    estado TEXT NOT NULL DEFAULT 'nao-lida', favorita INTEGER NOT NULL DEFAULT 0,
                    ultima_leitura INTEGER, terminada_em INTEGER);
                 CREATE TABLE progresso (edicao_id TEXT PRIMARY KEY REFERENCES arquivos(id), posicao TEXT NOT NULL,
                    fracao REAL NOT NULL, quando INTEGER NOT NULL);
                 CREATE TABLE marcacoes (
                    id TEXT PRIMARY KEY, obra_id TEXT NOT NULL, edicao_id TEXT NOT NULL, tipo TEXT NOT NULL,
                    ancora TEXT NOT NULL, trecho TEXT NOT NULL, cor TEXT NOT NULL, nota TEXT,
                    etiquetas TEXT NOT NULL DEFAULT '[]', ligacoes TEXT NOT NULL DEFAULT '[]',
                    criada_em INTEGER NOT NULL, editada_em INTEGER NOT NULL, apagado_em INTEGER);
                 CREATE INDEX marcacoes_obra ON marcacoes (obra_id);
                 INSERT INTO pastas VALUES ('/p', 1);
                 -- o mesmo livro em PDF e EPUB (duas obras na v2), cada um com progresso e marcação
                 INSERT INTO arquivos VALUES ('a-pdf','/p','Ana - O Livro.pdf','Ana - O Livro.pdf','pdf',10,'h1',1,1);
                 INSERT INTO arquivos VALUES ('a-epub','/p','Ana - Livro, O.epub','Ana - Livro, O.epub','epub',20,'h2',1,1);
                 INSERT INTO obras VALUES ('o-pdf','a-pdf','O Livro','Ana',10,100,'lendo',0,500,NULL);
                 INSERT INTO obras VALUES ('o-epub','a-epub','Livro, O','Ana',10,200,'lendo',1,900,NULL);
                 INSERT INTO progresso VALUES ('a-pdf','7:0.5',0.4,500);
                 INSERT INTO progresso VALUES ('a-epub','epubcfi(/6/8)',0.7,900);
                 INSERT INTO marcacoes VALUES ('m-pdf','o-pdf','a-pdf','destaque','{\"tipo\":\"pdf\",\"pagina\":7,\"retangulos\":[]}','no pdf','ideia','nota do pdf','[]','[]',1,1,NULL);
                 INSERT INTO marcacoes VALUES ('m-epub','o-epub','a-epub','destaque','{\"tipo\":\"epub\",\"cfiInicio\":\"a\",\"cfiFim\":\"b\"}','no epub','duvida',NULL,'[]','[]',2,2,NULL);
                 -- o mesmo arquivo em duas pastas (duas obras na v2); a cópia foi lida por último
                 INSERT INTO arquivos VALUES ('c1','/p','x/Copia.pdf','Copia.pdf','pdf',30,'igual',1,1);
                 INSERT INTO arquivos VALUES ('c2','/p','y/Copia.pdf','Copia.pdf','pdf',30,'igual',1,1);
                 INSERT INTO obras VALUES ('o-c1','c1','Copia','',20,300,'lendo',0,400,NULL);
                 INSERT INTO obras VALUES ('o-c2','c2','Copia','',20,310,'lida',0,800,800);
                 INSERT INTO progresso VALUES ('c1','3',0.1,400);
                 INSERT INTO progresso VALUES ('c2','99',1.0,800);
                 INSERT INTO marcacoes VALUES ('m-c2','o-c2','c2','marcador','{\"tipo\":\"pdf\",\"pagina\":9,\"retangulos\":[]}','Página 9','ideia',NULL,'[]','[]',3,3,NULL);
                 -- um livro sozinho, sem nada
                 INSERT INTO arquivos VALUES ('s1','/p','Sozinho.pdf','Sozinho.pdf','pdf',40,'h5',1,1);
                 INSERT INTO obras VALUES ('o-s','s1','Sozinho','',30,400,'nao-lida',0,NULL,NULL);
                 PRAGMA user_version = 2;",
            )
            .unwrap();
        }
        let b = Biblioteca::abrir(&caminho).unwrap();
        let v: i64 = b.bd.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(v, super::super::VERSAO_BANCO);
        // a cópia do banco antigo ficou ao lado, ainda na versão 2 e com tudo dentro
        let copia = Connection::open(dados.path().join("fierium.db.v2.bak")).unwrap();
        let antes: (i64, i64, i64) = copia
            .query_row(
                "SELECT (SELECT COUNT(*) FROM obras), (SELECT COUNT(*) FROM progresso), (SELECT COUNT(*) FROM marcacoes)",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(antes, (5, 4, 3));
        let obras = todas(&b);
        assert_eq!(obras.len(), 3);

        // PDF + EPUB: uma obra (a mais antiga fica), duas edições com os MESMOS ids e o progresso de cada uma
        let livro = b.obra_obter("o-pdf").unwrap();
        assert_eq!(livro["titulo"], "O Livro");
        assert_eq!(livro["edicoes"][0]["id"], "a-epub"); // lida por último
        assert_eq!(livro["edicoes"][0]["progresso"]["posicao"], "epubcfi(/6/8)");
        assert_eq!(livro["edicoes"][1]["id"], "a-pdf");
        assert_eq!(livro["edicoes"][1]["progresso"]["posicao"], "7:0.5");
        assert_eq!(livro["edicoes"][1]["progresso"]["fracao"], 0.4);
        assert_eq!(livro["relacao"]["favorita"], true);
        assert_eq!(livro["relacao"]["ultimaLeitura"], 900);
        assert_eq!(livro["relacao"]["adicionadaEm"], 100);
        assert_eq!(b.obra_obter("o-epub").unwrap_err().codigo(), "NAO_ENCONTRADO");
        // as duas marcações estão na obra que ficou, cada uma na edição dela, com a nota
        let marcas = b.marcacoes_listar(&json!({ "obraId": "o-pdf" })).unwrap();
        assert_eq!(marcas.as_array().unwrap().len(), 2);
        assert_eq!(
            (&marcas[0]["id"], &marcas[0]["edicaoId"]),
            (&json!("m-epub"), &json!("a-epub"))
        );
        assert_eq!(
            (&marcas[1]["id"], &marcas[1]["edicaoId"]),
            (&json!("m-pdf"), &json!("a-pdf"))
        );
        assert_eq!(marcas[1]["nota"], "nota do pdf");

        // mesma impressão: uma edição, dois arquivos, o progresso mais recente e a marcação da cópia
        let copia = b.obra_obter("o-c1").unwrap();
        assert_eq!(copia["edicoes"].as_array().unwrap().len(), 1);
        assert_eq!(copia["edicoes"][0]["id"], "c1");
        assert_eq!(copia["edicoes"][0]["arquivos"].as_array().unwrap().len(), 2);
        assert_eq!(copia["edicoes"][0]["progresso"]["posicao"], "99");
        assert_eq!(copia["relacao"]["estado"], "lida");
        assert_eq!(copia["relacao"]["terminadaEm"], 800);
        let marcas = b.marcacoes_listar(&json!({ "obraId": "o-c1" })).unwrap();
        assert_eq!(
            (&marcas[0]["id"], &marcas[0]["edicaoId"]),
            (&json!("m-c2"), &json!("c1"))
        );

        // o que não tinha par continua igual, e dá pra continuar usando (progresso, marcação, abrir de novo)
        let sozinho = b.obra_obter("o-s").unwrap();
        assert_eq!(sozinho["edicoes"][0]["id"], "s1");
        b.progresso_salvar("s1", "2", 0.2).unwrap();
        b.progresso_salvar("a-pdf", "8", 0.45).unwrap();
        assert_eq!(b.obra_obter("o-pdf").unwrap()["edicoes"][0]["id"], "a-pdf");
        drop(b);
        let b = Biblioteca::abrir(&caminho).unwrap();
        assert_eq!(todas(&b).len(), 3);
        assert_eq!(b.obra_obter("o-s").unwrap()["edicoes"][0]["progresso"]["posicao"], "2");
    }
}
