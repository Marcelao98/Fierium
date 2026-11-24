//! Orçamento de desempenho do catálogo (docs/ARQUITETURA.md, "Desempenho"): 75.000 itens (o tamanho do Gutenberg),
//! gerados aqui e importados pelo caminho de verdade (`importar`), buscados numa conexão de leitura.
//!
//! Só em release (em debug o SQLite é 10 a 30 vezes mais lento): a importação de 75 mil itens leva alguns segundos.
//! `cargo test --release -p fierium-catalogo desempenho -- --ignored --nocapture`
use crate::{Baixador, Catalogo, Fonte, ItemNovo, Oferta, Pessoa};
use fierium_core::ErroFierium;
use serde_json::json;
use std::path::Path;
use std::time::Instant;

const ITENS: usize = 75_000;

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
    "Pride",
    "Prejudice",
    "Frankenstein",
    "Modern",
    "Prometheus",
    "Moby",
    "Dick",
    "Whale",
    "Alice",
    "Wonderland",
    "Adventures",
    "Sherlock",
    "Holmes",
    "Treasure",
    "Island",
    "Great",
    "Expectations",
    "Romeo",
    "Juliet",
];
const SOBRENOMES: &[&str] = &[
    "Assis",
    "Queirós",
    "Alencar",
    "Pompeia",
    "Rosa",
    "Ramos",
    "Amado",
    "Barreto",
    "Austen",
    "Shelley",
    "Melville",
    "Carroll",
    "Doyle",
    "Stevenson",
    "Dickens",
    "Shakespeare",
    "Twain",
    "Wilde",
    "Verne",
    "Dumas",
];
const ASSUNTOS: &[&str] = &[
    "Fiction",
    "Brazil -- Fiction",
    "Science fiction",
    "Poetry",
    "Philosophy",
    "Adventure stories",
    "Detective",
    "Gothic Fiction",
    "Drama",
    "History",
];

struct FonteFalsa;

impl Fonte for FonteFalsa {
    fn id(&self) -> &'static str {
        "gutenberg"
    }
    fn nome(&self) -> &'static str {
        "Project Gutenberg"
    }
    fn carregar(
        &self,
        _: &dyn Baixador,
        _: &Path,
        _: &mut dyn FnMut(u64, Option<u64>),
    ) -> Result<Vec<ItemNovo>, ErroFierium> {
        Ok(vec![])
    }
}

fn item(i: usize) -> ItemNovo {
    ItemNovo {
        id: (i + 1).to_string(),
        tipo: "livro".into(),
        titulo: format!(
            "{} {} {}",
            PALAVRAS[i % PALAVRAS.len()],
            PALAVRAS[(i / 7) % PALAVRAS.len()],
            PALAVRAS[(i / 41) % PALAVRAS.len()]
        ),
        idioma: ["en", "pt", "fr", "de"][i % 4].into(),
        ano: Some(1800 + (i % 200) as i64),
        sinopse: None,
        serie: None,
        capa: None,
        pessoas: vec![Pessoa {
            nome: format!(
                "{} {}",
                ["Ana", "João", "Maria", "Pedro"][i % 4],
                SOBRENOMES[(i / 3) % SOBRENOMES.len()]
            ),
            papel: "autor".into(),
        }],
        assuntos: vec![
            ASSUNTOS[i % ASSUNTOS.len()].into(),
            ASSUNTOS[(i / 5) % ASSUNTOS.len()].into(),
        ],
        identificadores: vec![("gutenberg".into(), (i + 1).to_string())],
        ofertas: vec![Oferta {
            fonte: "gutenberg".into(),
            formato: "epub".into(),
            url: format!("https://exemplo.invalido/{i}.epub"),
            licenca: "Domínio público".into(),
            tamanho: None,
        }],
    }
}

fn ms(f: impl Fn()) -> f64 {
    f();
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

#[test]
#[ignore = "orçamento de desempenho: rode em release (ver o topo do arquivo)"]
fn desempenho_do_catalogo_com_75_mil_itens() {
    let dir = tempfile::tempdir().unwrap();
    let mut escrita = Catalogo::abrir(&dir.path().join("catalogo.db")).unwrap();
    let itens: Vec<ItemNovo> = (0..ITENS).map(item).collect();
    let inicio = Instant::now();
    escrita.importar(&FonteFalsa, &itens).unwrap();
    println!("importar {ITENS} itens: {:.1} s", inicio.elapsed().as_secs_f64());
    let pool = escrita.leitores(4);
    let l = pool.emprestar().unwrap();
    assert_eq!(l.total_de_itens().unwrap(), ITENS as i64);

    let casos = [
        ("sem texto (primeira página)", json!({})),
        ("sem texto (página 500)", json!({ "deslocamento": 25_000 })),
        ("título", json!({ "texto": "memorias postumas" })),
        ("prefixo curto", json!({ "texto": "al" })),
        ("autor", json!({ "autor": "Assis" })),
        (
            "assunto + idioma",
            json!({ "assunto": "Science fiction", "idioma": "pt" }),
        ),
        ("só idioma", json!({ "idioma": "pt" })),
    ];
    let mut pior: f64 = 0.0;
    for (nome, filtro) in &casos {
        let t = ms(|| {
            let r = l.buscar(filtro).unwrap();
            assert!(r["total"].as_i64().unwrap() > 0, "{nome}");
        });
        println!("catalogo.buscar [{nome}]: {t:.1} ms");
        pior = pior.max(t);
    }
    for sql in [
        "SELECT i.id FROM itens i ORDER BY CAST(substr(i.id, instr(i.id, ':') + 1) AS INTEGER), i.titulo COLLATE NOCASE LIMIT 50",
        "SELECT COUNT(*) FROM itens i",
    ] {
        let mut st = l.bd.prepare(&format!("EXPLAIN QUERY PLAN {sql}")).unwrap();
        let p: Vec<String> = st
            .query_map([], |r| r.get::<_, String>(3))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        println!("plano: {sql}\n  -> {}", p.join(" | "));
        assert!(!p.join(" ").contains("TEMP B-TREE"), "{p:?}");
    }
    assert!(
        pior < 30.0,
        "catalogo.buscar levou {pior:.1} ms no pior caso (orçamento: 30)"
    );
}
