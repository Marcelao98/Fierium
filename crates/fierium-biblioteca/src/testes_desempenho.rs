//! Orçamentos de desempenho (docs/ARQUITETURA.md, "Desempenho"). Os dados são GERADOS aqui, direto no SQLite
//! (10.000 obras, 20.000 marcações), e as consultas rodam numa conexão de leitura, como o app faz.
//!
//! Rodam só em release (em debug o SQLite e o serde são 10 a 30 vezes mais lentos e o orçamento não vale):
//! `cargo test --release -p fierium-biblioteca desempenho -- --ignored --nocapture`
use crate::banco::{Biblioteca, Leitor};
use crate::metadados::{Metadados, Pessoa};
use rusqlite::params;
use serde_json::json;
use std::time::Instant;

const OBRAS: usize = 10_000;
const MARCACOES: usize = 20_000;
const AGORA: i64 = 1_800_000_000_000;
const DIA: i64 = 86_400_000;

const PALAVRAS: &[&str] = &[
    "Memórias",
    "Póstumas",
    "Alienista",
    "Primo",
    "Basílio",
    "Dom",
    "Casmurro",
    "Senhora",
    "Iracema",
    "Quincas",
    "Borba",
    "Cortiço",
    "Ateneu",
    "Sagarana",
    "Vidas",
    "Secas",
    "Grande",
    "Sertão",
    "Veredas",
    "Capitães",
    "Areia",
    "Ressurreição",
    "Helena",
    "Guarani",
    "Lucíola",
    "Macunaíma",
    "Triste",
    "Fim",
    "Policarpo",
    "Quaresma",
];
const AUTORES: &[&str] = &[
    "Machado de Assis",
    "Eça de Queirós",
    "José de Alencar",
    "Raul Pompeia",
    "Guimarães Rosa",
    "Graciliano Ramos",
    "Jorge Amado",
    "Lima Barreto",
    "Clarice Lispector",
    "Aluísio Azevedo",
];

fn titulo(i: usize) -> String {
    format!(
        "{} {} {} {}",
        PALAVRAS[i % PALAVRAS.len()],
        PALAVRAS[(i / 7) % PALAVRAS.len()],
        PALAVRAS[(i / 31) % PALAVRAS.len()],
        i
    )
}

/// Monta o banco com `OBRAS` obras (1 edição e 1 arquivo cada; 1 em 5 também tem um PDF), metade com progresso,
/// e `MARCACOES` marcações. Devolve a conexão de escrita (que fica viva) e o arquivo de capa que as edições citam.
fn montar() -> (tempfile::TempDir, Biblioteca) {
    let dir = tempfile::tempdir().unwrap();
    let mut b = Biblioteca::abrir_com_capas(&dir.path().join("fierium.db"), dir.path().join("capas")).unwrap();
    std::fs::create_dir_all(dir.path().join("capas")).unwrap();
    let tx = b.bd.transaction().unwrap();
    {
        let mut obra = tx
            .prepare(
                "INSERT INTO obras (id, titulo, autor, matiz, adicionada_em, estado, favorita, ultima_leitura,
                    terminada_em, serie, volume, ano, criadores) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,NULL,NULL,?10,?11)",
            )
            .unwrap();
        let mut ed = tx
            .prepare(
                "INSERT INTO edicoes (id, obra_id, formato, chave_titulo, chave_autor, separada, criada_em, meta,
                    capa, meta_v) VALUES (?1,?2,?3,?4,?5,0,?6,?7,?8,1)",
            )
            .unwrap();
        let mut arq = tx
            .prepare(
                "INSERT INTO arquivos (id, pasta, caminho_rel, nome, formato, tamanho, impressao, existe, visto_em,
                    edicao_id) VALUES (?1,'/livros',?2,?3,?4,1000,?5,?6,1,?7)",
            )
            .unwrap();
        let mut prog = tx
            .prepare("INSERT INTO progresso (edicao_id, posicao, fracao, quando) VALUES (?1,'12',?2,?3)")
            .unwrap();
        for i in 0..OBRAS {
            let t = titulo(i);
            let autor = AUTORES[i % AUTORES.len()];
            let (estado, lida) = match i % 10 {
                0..=3 => ("nao-lida", None),
                4..=7 => ("lendo", Some(AGORA - (i as i64) * 60_000)),
                _ => ("lida", Some(AGORA - (i as i64) * 60_000)),
            };
            let criadores = serde_json::to_string(&[Pessoa {
                nome: autor.into(),
                papel: "autor".into(),
            }])
            .unwrap();
            obra.execute(params![
                format!("o{i:05}"),
                t,
                autor,
                (i % 360) as i64,
                AGORA - (i as i64) * 1000,
                estado,
                (i % 17 == 0) as i64,
                lida,
                (estado == "lida").then_some(lida),
                1900 + (i % 120) as i64,
                criadores
            ])
            .unwrap();
            let meta = serde_json::to_string(&Metadados {
                titulo: t.clone(),
                criadores: vec![Pessoa {
                    nome: autor.into(),
                    papel: "autor".into(),
                }],
                idioma: "pt".into(),
                assuntos: vec!["Romance".into(), "Literatura brasileira".into(), "Século XIX".into()],
                paginas: Some(100 + (i % 400) as u32),
                ..Default::default()
            })
            .unwrap();
            let formatos: &[&str] = if i % 5 == 0 { &["epub", "pdf"] } else { &["epub"] };
            for (k, f) in formatos.iter().enumerate() {
                let e = format!("e{i:05}{k}");
                let capa = dir.path().join("capas").join(format!("imp{i:05}{k}.png"));
                std::fs::write(&capa, b"png").unwrap();
                ed.execute(params![
                    e,
                    format!("o{i:05}"),
                    f,
                    crate::chave_do_titulo(&t),
                    crate::chave_do_autor(autor),
                    AGORA - (i as i64) * 1000 + k as i64,
                    meta,
                    capa.to_string_lossy()
                ])
                .unwrap();
                arq.execute(params![
                    format!("a{i:05}{k}"),
                    format!("{autor}/{t}.{f}"),
                    format!("{t}.{f}"),
                    f,
                    format!("imp{i:05}{k}"),
                    // 1 em 50 sumiu do disco: não aparece na estante
                    (i % 50 != 3) as i64,
                    e
                ])
                .unwrap();
                if k == 0 && lida.is_some() {
                    prog.execute(params![e, if estado == "lida" { 1.0 } else { 0.4 }, lida])
                        .unwrap();
                }
            }
        }
        let mut m = tx
            .prepare(
                "INSERT INTO marcacoes (id, obra_id, edicao_id, tipo, ancora, trecho, cor, nota, etiquetas, ligacoes,
                    criada_em, editada_em, apagado_em) VALUES (?1,?2,?3,'destaque','{}',?4,?5,?6,'[]','[]',?7,?7,?8)",
            )
            .unwrap();
        for j in 0..MARCACOES {
            let o = (j * 7) % OBRAS;
            m.execute(params![
                format!("m{j:06}"),
                format!("o{o:05}"),
                format!("e{o:05}0"),
                format!("Um trecho marcado número {j}, com {}", PALAVRAS[j % PALAVRAS.len()]),
                ["amarelo", "verde", "rosa"][j % 3],
                (j % 4 == 0).then(|| format!("nota sobre {}", AUTORES[j % AUTORES.len()])),
                AGORA - (j as i64) * 3_600_000 - 40 * DIA,
                (j % 100 == 99).then_some(AGORA),
            ])
            .unwrap();
        }
    }
    tx.commit().unwrap();
    b.bd.execute_batch("ANALYZE").unwrap();
    (dir, b)
}

fn ms(f: impl Fn()) -> f64 {
    f(); // aquece (cache de páginas e de statements)
    let mut t: Vec<f64> = (0..7)
        .map(|_| {
            let i = Instant::now();
            f();
            i.elapsed().as_secs_f64() * 1000.0
        })
        .collect();
    t.sort_by(f64::total_cmp);
    t[t.len() / 2]
}

fn plano(l: &Leitor, sql: &str) -> String {
    let mut st = l.bd.prepare(&format!("EXPLAIN QUERY PLAN {sql}")).unwrap();
    st.query_map([], |r| r.get::<_, String>(3))
        .unwrap()
        .map(|r| r.unwrap())
        .collect::<Vec<_>>()
        .join(" | ")
}

#[test]
#[ignore = "orçamento de desempenho: rode em release (ver o topo do arquivo)"]
fn desempenho_da_biblioteca_com_10_mil_obras() {
    let (_d, b) = montar();
    let pool = b.leitores(4);
    let l = pool.emprestar().unwrap();

    let casos: Vec<(&str, serde_json::Value)> = vec![
        ("recentes", json!({})),
        ("titulo", json!({ "ordem": "titulo" })),
        ("autor", json!({ "ordem": "autor" })),
        ("progresso", json!({ "ordem": "progresso" })),
        ("favoritas", json!({ "favoritas": true })),
        ("estado lendo", json!({ "estado": "lendo" })),
        ("formato pdf", json!({ "formato": "pdf" })),
        ("texto", json!({ "texto": "memorias postumas" })),
    ];
    // a tela pede a estante por páginas (`limite`/`deslocamento`); a lista inteira (10 mil obras montadas em JSON)
    // também funciona, mas é medida à parte e não entra no orçamento
    let mut pior_pagina: f64 = 0.0;
    for (nome, filtro) in &casos {
        let mut pagina = filtro.clone();
        pagina["limite"] = json!(100);
        pagina["deslocamento"] = json!(300);
        let t = ms(|| {
            l.obras_listar(&pagina).unwrap();
        });
        let inteira = ms(|| {
            l.obras_listar(filtro).unwrap();
        });
        println!("obras.listar [{nome}]: página de 100 = {t:.1} ms; lista inteira = {inteira:.1} ms");
        pior_pagina = pior_pagina.max(t);
    }
    let limiar = ms(|| {
        l.limiar().unwrap();
    });
    let marcacoes = ms(|| {
        let r = l.marcacoes_listar(&json!({ "obraId": "o00007" })).unwrap();
        assert!(!r.as_array().unwrap().is_empty());
    });
    let busca = ms(|| {
        l.busca_tudo("memorias postumas").unwrap();
    });
    println!("biblioteca.limiar: {limiar:.1} ms");
    println!("marcacoes.listar (uma obra): {marcacoes:.1} ms");
    println!("busca.tudo: {busca:.1} ms");

    // os planos: nenhuma consulta quente pode varrer a tabela inteira sem índice
    for sql in [
        "SELECT id FROM marcacoes WHERE obra_id = 'o00007' AND apagado_em IS NULL ORDER BY criada_em DESC, id DESC",
        "SELECT id FROM marcacoes WHERE apagado_em IS NULL AND criada_em < 5 ORDER BY id",
        "SELECT edicao_id, id FROM arquivos WHERE edicao_id IN (SELECT id FROM edicoes WHERE obra_id = 'o00007')",
        "SELECT id FROM edicoes WHERE obra_id = 'o00007'",
    ] {
        let p = plano(&l, sql);
        println!("plano: {sql}\n  -> {p}");
        assert!(
            !p.contains("SCAN marcacoes") && !p.contains("SCAN arquivos") && !p.contains("SCAN edicoes"),
            "{p}"
        );
    }

    assert!(
        pior_pagina < 50.0,
        "obras.listar (página) levou {pior_pagina:.1} ms (orçamento: 50)"
    );
    assert!(limiar < 30.0, "biblioteca.limiar levou {limiar:.1} ms (orçamento: 30)");
    assert!(
        marcacoes < 10.0,
        "marcacoes.listar levou {marcacoes:.1} ms (orçamento: 10)"
    );
    assert!(busca < 30.0, "busca.tudo levou {busca:.1} ms (orçamento: 30)");
}
