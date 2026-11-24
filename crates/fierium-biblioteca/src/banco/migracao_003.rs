//! Migração 003 (em Rust, porque junta dados): de "uma obra por arquivo" pra obra → edições → arquivos.
use crate::bd;
use crate::obras::chave::{achar_obra, chave_do_autor, chave_do_titulo};
use crate::obras::{absorver_relacao, ler_relacao};
use fierium_core::ErroFierium;
use rusqlite::{params, Connection};
use std::collections::HashMap;

/// Migração v3: de "uma obra por arquivo" pra obra → edições → arquivos. O id de cada edição que já existia é o id
/// do arquivo dela (é o que o progresso e as marcações já guardavam), então nada precisa ser reescrito pra continuar
/// valendo. Arquivos iguais (mesma impressão) viram uma edição só; obras com a mesma chave viram uma obra só.
pub(super) fn migrar(c: &mut Connection) -> Result<(), ErroFierium> {
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
                let obra = match achar_obra(&tx, &kt, &ka, "")? {
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
