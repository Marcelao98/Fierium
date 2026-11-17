use super::*;
use crate::gutenberg::{autor_legivel, ler_csv};

pub const CSV: &str = "Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves\n\
1,Text,2000-01-01,Memórias Póstumas de Brás Cubas,pt,\"Machado de Assis, 1839-1908\",\"Brazil -- Fiction; Satire\",PQ,Brazilian Literature\n\
2,Text,2000-01-01,\"Dom Casmurro\",pt,\"Assis, Machado de, 1839-1908\",Brazil -- Fiction,PQ,\n\
3,Sound,2000-01-01,Um áudio,en,\"Fulano, Beltrano\",,,\n\
4,Text,2000-01-01,\"Frankenstein; Or, The Modern Prometheus\",en,\"Shelley, Mary Wollstonecraft, 1797-1851\",Science fiction,PR,Gothic Fiction; Category: Science-Fiction & Fantasy\n\
5,Text,2000-01-01,\"Duas línguas\nsubtítulo\",fr; en,\"Hugo, Victor, 1802-1885; Smith, John, 1800-1850 [Translator]\",,PQ,\n";

pub fn catalogo_de_teste() -> (tempfile::TempDir, Catalogo) {
    let d = tempfile::tempdir().unwrap();
    let mut c = Catalogo::abrir(&d.path().join("catalogo.db")).unwrap();
    let itens = ler_csv(CSV.as_bytes()).unwrap();
    c.importar(&Gutenberg::default(), &itens).unwrap();
    (d, c)
}

#[test]
fn csv_so_texto_e_autores_legiveis() {
    let itens = ler_csv(CSV.as_bytes()).unwrap();
    assert_eq!(itens.len(), 4, "o áudio fica de fora");
    assert_eq!(itens[0].pessoas[0].nome, "Machado de Assis");
    assert_eq!(itens[1].pessoas[0].nome, "Machado de Assis");
    assert_eq!(itens[2].pessoas[0].nome, "Mary Wollstonecraft Shelley");
    assert_eq!(itens[3].titulo, "Duas línguas: subtítulo");
    assert_eq!(itens[3].idioma, "fr");
    assert_eq!(itens[3].pessoas[1].papel, "tradutor");
    assert!(itens[0].assuntos.contains(&"LoCC: PQ".to_string()));
    assert_eq!(
        itens[0].ofertas[0].url,
        "https://gutenberg.pglaf.org/cache/epub/1/pg1-images-3.epub"
    );
    assert!(itens[0].ofertas[0].licenca.contains("Domínio público"));
    assert_eq!(autor_legivel("Anônimo").unwrap().nome, "Anônimo");
    // os formatos de verdade do CSV: iniciais com o nome por extenso, título de nobreza, "Jr."
    let nome = |b: &str| autor_legivel(b).unwrap().nome;
    assert_eq!(nome("Wells, H. G. (Herbert George), 1866-1946"), "H. G. Wells");
    assert_eq!(
        nome("Taunay, Alfredo d'Escragnolle Taunay, Visconde de, 1843-1899"),
        "Alfredo d'Escragnolle Taunay"
    );
    assert_eq!(nome("Camões, Luís de, 1524?-1580"), "Luís de Camões");
    assert_eq!(nome("King, Martin Luther, Jr., 1929-1968"), "Martin Luther King Jr.");
    // as estantes entram como assunto, sem o "Category:"
    assert!(itens[0].assuntos.contains(&"Brazilian Literature".to_string()));
    assert!(itens[2].assuntos.contains(&"Science-Fiction & Fantasy".to_string()));
}

#[test]
fn colecoes_por_estante_e_enderecos_alternativos() {
    use crate::gutenberg::alternativas_do_epub;
    let (_d, c) = catalogo_de_teste();
    let r = c.buscar(&json!({ "assunto": "Science-Fiction & Fantasy" })).unwrap();
    assert_eq!(r["total"], 1);
    assert_eq!(r["itens"][0]["id"], "gutenberg:4");
    assert_eq!(
        c.buscar(&json!({ "assunto": "fiction", "idioma": "pt" })).unwrap()["total"],
        2
    );
    // sem texto, a ordem é a do número no Gutenberg (os clássicos primeiro)
    let r = c.buscar(&json!({ "idioma": "pt" })).unwrap();
    assert_eq!(r["itens"][0]["id"], "gutenberg:1");
    assert_eq!(r["itens"][1]["id"], "gutenberg:2");
    // a fonte existe antes da primeira atualização (pra dar pra atualizar à mão)
    let d = tempfile::tempdir().unwrap();
    let vazio = Catalogo::abrir(&d.path().join("c.db")).unwrap();
    assert_eq!(vazio.fontes().unwrap()[0]["itens"], 0);
    let alt = alternativas_do_epub("https://gutenberg.pglaf.org/cache/epub/7/pg7-images-3.epub");
    assert_eq!(alt.len(), 6);
    assert_eq!(alt[1], "https://www.gutenberg.org/cache/epub/7/pg7-images-3.epub");
    assert_eq!(alt[5], "https://www.gutenberg.org/cache/epub/7/pg7.epub");
    assert_eq!(alternativas_do_epub("https://outro.exemplo/a.epub").len(), 1);
}

/// Baixador de mentira: o primeiro endereço falha (site em manutenção), o segundo entrega o CSV compactado.
struct SiteFora;
impl Baixador for SiteFora {
    fn baixar(&self, url: &str, destino: &Path) -> Result<u64, ErroFierium> {
        if url.contains("www.gutenberg.org") {
            return Err(ErroFierium::Rede("o servidor está em manutenção (erro 503)".into()));
        }
        use std::io::Write;
        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        gz.write_all(CSV.as_bytes()).unwrap();
        let corpo = gz.finish().unwrap();
        std::fs::write(destino, &corpo).unwrap();
        Ok(corpo.len() as u64)
    }
}

#[test]
fn catalogo_vem_do_espelho_quando_o_site_cai() {
    let d = tempfile::tempdir().unwrap();
    let mut avisos = 0;
    let itens = Gutenberg::default()
        .carregar(&SiteFora, d.path(), &mut |_, _| avisos += 1)
        .unwrap();
    assert_eq!(itens.len(), 4);
    assert!(avisos > 0);
    // todos fora do ar e sem cópia: erro de rede em português, dizendo que tentou os dois
    struct TudoFora;
    impl Baixador for TudoFora {
        fn baixar(&self, _: &str, _: &Path) -> Result<u64, ErroFierium> {
            Err(ErroFierium::Rede("o servidor está em manutenção (erro 503)".into()))
        }
    }
    let d2 = tempfile::tempdir().unwrap();
    let e = Gutenberg::default()
        .carregar(&TudoFora, d2.path(), &mut |_, _| {})
        .unwrap_err();
    assert_eq!(e.codigo(), "ERRO_DE_REDE");
    assert!(e.to_string().contains("nem do site nem do espelho"), "{e}");
}

#[test]
fn busca_sem_acento_e_filtros() {
    let (_d, c) = catalogo_de_teste();
    let r = c.buscar(&json!({ "texto": "machado assis" })).unwrap();
    assert_eq!(r["total"], 2);
    let r = c.buscar(&json!({ "texto": "memorias postumas" })).unwrap();
    assert_eq!(r["total"], 1);
    assert_eq!(r["itens"][0]["id"], "gutenberg:1");
    assert_eq!(r["itens"][0]["pessoas"][0]["nome"], "Machado de Assis");
    assert_eq!(r["itens"][0]["ofertas"][0]["formato"], "epub");
    // assunto, prefixo, idioma e autor
    assert_eq!(c.buscar(&json!({ "texto": "satir" })).unwrap()["total"], 1);
    assert_eq!(c.buscar(&json!({ "idioma": "en" })).unwrap()["total"], 1);
    assert_eq!(c.buscar(&json!({ "autor": "shelley" })).unwrap()["total"], 1);
    assert_eq!(
        c.buscar(&json!({ "texto": "casmurro", "autor": "machado" })).unwrap()["total"],
        1
    );
    assert_eq!(c.buscar(&json!({ "texto": "nada disso existe" })).unwrap()["total"], 0);
    // aspas e símbolos não quebram a consulta
    assert!(c.buscar(&json!({ "texto": "\"(*) OR" })).is_ok());
    assert_eq!(c.buscar(&json!({})).unwrap()["total"], 4);
    assert_eq!(
        c.buscar(&json!({ "limite": 1, "deslocamento": 1 })).unwrap()["itens"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn reimportar_substitui_e_fontes_contam() {
    let (_d, mut c) = catalogo_de_teste();
    let um = ler_csv(CSV.as_bytes()).unwrap()[..1].to_vec();
    c.importar(&Gutenberg::default(), &um).unwrap();
    assert_eq!(c.total_de_itens().unwrap(), 1);
    assert_eq!(c.buscar(&json!({ "texto": "frankenstein" })).unwrap()["total"], 0);
    let f = c.fontes().unwrap();
    assert_eq!(f[0]["id"], "gutenberg");
    assert_eq!(f[0]["itens"], 1);
    assert!(f[0]["atualizadaEm"].as_i64().unwrap() > 0);
    assert_eq!(c.item("gutenberg:99").unwrap_err().codigo(), "NAO_ENCONTRADO");
}

#[test]
fn interruptor_de_rede() {
    let (_d, c) = catalogo_de_teste();
    assert!(c.rede_permitida().unwrap());
    c.rede_definir(false).unwrap();
    assert!(!c.rede_permitida().unwrap());
    let e = c.exigir_rede("atualizar o catálogo").unwrap_err();
    assert_eq!(e.codigo(), "SEM_REDE");
    assert!(e.to_string().contains("desligada"));
    c.rede_definir(true).unwrap();
    assert!(c.exigir_rede("x").is_ok());
}

#[test]
fn nome_limpo() {
    assert_eq!(
        nome_do_arquivo("Machado de Assis", "Dom: Casmurro?", "epub"),
        "Machado de Assis - Dom Casmurro.epub"
    );
    assert_eq!(nome_do_arquivo("", "A/B", "epub"), "A B.epub");
    assert_eq!(nome_do_arquivo("", "", "epub"), "Sem título.epub");
}

#[test]
fn baixador_http_com_servidor_local() {
    use std::io::{Read, Write};
    let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let porta = l.local_addr().unwrap().port();
    let t = std::thread::spawn(move || {
        let (mut s, _) = l.accept().unwrap();
        let mut buf = [0u8; 2048];
        let n = s.read(&mut buf).unwrap();
        let pedido = String::from_utf8_lossy(&buf[..n]).to_lowercase();
        s.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nabcde")
            .unwrap();
        pedido
    });
    let d = tempfile::tempdir().unwrap();
    let alvo = d.path().join("x/livro.epub");
    let n = BaixadorHttp::default()
        .baixar(&format!("http://127.0.0.1:{porta}/a.epub"), &alvo)
        .unwrap();
    assert_eq!(n, 5);
    assert_eq!(std::fs::read(&alvo).unwrap(), b"abcde");
    assert!(!alvo.with_extension("part").exists());
    let pedido = t.join().unwrap();
    assert!(pedido.contains("user-agent: fierium/"), "{pedido}");
    assert!(!pedido.contains('@'));
}

/// Com o catálogo de verdade (não roda nos portões: precisa do arquivo baixado).
/// `FIERIUM_CSV=/caminho/pg_catalog.csv.gz cargo test --release -p fierium-catalogo de_verdade -- --ignored --nocapture`
#[test]
#[ignore = "precisa do pg_catalog.csv(.gz) de verdade em FIERIUM_CSV"]
fn catalogo_de_verdade() {
    let origem = std::env::var("FIERIUM_CSV").expect("FIERIUM_CSV");
    let d = tempfile::tempdir().unwrap();
    std::fs::copy(&origem, d.path().join("pg_catalog.csv.gz")).unwrap();
    struct SemRede;
    impl Baixador for SemRede {
        fn baixar(&self, _: &str, _: &Path) -> Result<u64, ErroFierium> {
            panic!("o cache está fresco, não era pra baixar")
        }
    }
    let t = std::time::Instant::now();
    let itens = Gutenberg::default()
        .carregar(&SemRede, d.path(), &mut |_, _| {})
        .unwrap();
    println!("ler o CSV: {} itens em {:?}", itens.len(), t.elapsed());
    let t = std::time::Instant::now();
    let mut c = Catalogo::abrir(&d.path().join("catalogo.db")).unwrap();
    c.importar(&Gutenberg::default(), &itens).unwrap();
    println!("importar: {:?}", t.elapsed());
    assert!(itens.len() > 70_000);
    for f in [
        json!({ "texto": "machado de assis" }),
        json!({ "autor": "Machado de Assis", "idioma": "pt" }),
        json!({ "idioma": "pt" }),
        json!({ "assunto": "Fantasy" }),
        json!({ "assunto": "Philosophy" }),
        json!({ "assunto": "Poetry", "idioma": "pt" }),
        json!({ "assunto": "Science - Physics" }),
        json!({ "assunto": "Best Books Ever Listings" }),
    ] {
        let t = std::time::Instant::now();
        let r = c
            .buscar(&json!({ "limite": 5, "texto": f["texto"], "autor": f["autor"],
            "idioma": f["idioma"], "assunto": f["assunto"] }))
            .unwrap();
        let nomes: Vec<String> = r["itens"]
            .as_array()
            .unwrap()
            .iter()
            .map(|i| {
                format!(
                    "{} ({})",
                    i["titulo"].as_str().unwrap(),
                    i["pessoas"][0]["nome"].as_str().unwrap_or("?")
                )
            })
            .collect();
        println!("{f} → {} em {:?}: {nomes:?}", r["total"], t.elapsed());
        assert!(r["total"].as_i64().unwrap() > 0, "{f}");
    }
}
