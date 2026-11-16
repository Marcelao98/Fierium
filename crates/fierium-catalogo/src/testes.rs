use super::*;
use crate::gutenberg::{autor_legivel, ler_csv};

pub const CSV: &str = "Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves\n\
1,Text,2000-01-01,Memórias Póstumas de Brás Cubas,pt,\"Machado de Assis, 1839-1908\",\"Brazil -- Fiction; Satire\",PQ,Brazilian Literature\n\
2,Text,2000-01-01,\"Dom Casmurro\",pt,\"Assis, Machado de, 1839-1908\",Brazil -- Fiction,PQ,\n\
3,Sound,2000-01-01,Um áudio,en,\"Fulano, Beltrano\",,,\n\
4,Text,2000-01-01,\"Frankenstein; Or, The Modern Prometheus\",en,\"Shelley, Mary Wollstonecraft, 1797-1851\",Science fiction,PR,\n\
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
        "https://www.gutenberg.org/cache/epub/1/pg1-images-3.epub"
    );
    assert!(itens[0].ofertas[0].licenca.contains("Domínio público"));
    assert_eq!(autor_legivel("Anônimo").unwrap().nome, "Anônimo");
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
