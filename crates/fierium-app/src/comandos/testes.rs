use super::biblioteca::{escolher_documentos, livros_em};
use super::capas::base64_decodificar;
use super::*;
use fierium_catalogo::Baixador;
use serde_json::json;

#[test]
fn pasta_de_livros_no_estilo_do_windows_e_do_linux() {
    let win = livros_em(PathBuf::from(r"C:\Users\Ana\OneDrive\Documentos"));
    assert!(win.starts_with(r"C:\Users\Ana\OneDrive\Documentos"));
    assert!(win.ends_with("Fierium") && win.parent().unwrap().ends_with("Livros"));
    let casa = Path::new("/home/ana");
    assert_eq!(escolher_documentos(casa, |_| true), casa.join("Documentos"));
    assert_eq!(escolher_documentos(casa, |_| false), casa.join("Documents"));
}

fn contexto() -> (tempfile::TempDir, Contexto) {
    let d = tempfile::tempdir().unwrap();
    let c = Contexto::abrir(d.path()).unwrap();
    (d, c)
}

#[test]
fn nomes_iguais_aos_da_interface_e_erro_com_codigo() {
    let (_d, c) = contexto();
    let i = chamar(&c, "app.info", Value::Null).unwrap();
    assert_eq!(i["adaptador"], "tauri");
    assert_eq!(
        chamar(&c, "shell.rodar", Value::Null).unwrap_err().codigo(),
        "COMANDO_DESCONHECIDO"
    );
    let ruim = json!({ "nivel": "info" });
    assert_eq!(
        chamar(&c, "log.escrever", ruim).unwrap_err().codigo(),
        "ARGUMENTO_INVALIDO"
    );
    let ok = json!({ "nivel": "info", "origem": "teste", "mensagem": "oi" });
    assert_eq!(chamar(&c, "log.escrever", ok).unwrap(), Value::Null);
    assert_eq!(
        chamar(&c, "app.comandos", Value::Null)
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        comandos_do_rust().len()
    );
}

#[test]
fn biblioteca_de_ponta_a_ponta_e_arquivo_registrado() {
    let (_d, c) = contexto();
    let livros = tempfile::tempdir().unwrap();
    std::fs::write(livros.path().join("Ana - Um Livro.pdf"), b"%PDF-falso").unwrap();
    let caminho = livros.path().to_str().unwrap();
    chamar(&c, "pastas.adicionar", json!({ "caminho": caminho })).unwrap();
    let v = chamar(&c, "biblioteca.varrer", json!({})).unwrap();
    assert_eq!(v["novos"], 1);
    let obras = chamar(&c, "obras.listar", json!({ "texto": "livro" })).unwrap();
    let id = obras[0]["id"].as_str().unwrap();
    let ed = obras[0]["edicoes"][0]["id"].as_str().unwrap();
    // o protocolo entrega pelo id do ARQUIVO (a edição pode ter mais de uma cópia)
    let arq = obras[0]["edicoes"][0]["arquivos"][0]["id"].as_str().unwrap();
    assert!(c.arquivos.caminho(arq).is_some());
    let f = chamar(&c, "edicao.abrir", json!({ "edicaoId": ed })).unwrap();
    assert_eq!(f["tipo"], "arquivo");
    assert!(f["url"].as_str().unwrap().ends_with(arq));
    chamar(
        &c,
        "progresso.salvar",
        json!({ "edicaoId": ed, "posicao": "3", "fracao": 0.5 }),
    )
    .unwrap();
    let o = chamar(&c, "obra.atualizar", json!({ "id": id, "favorita": true })).unwrap();
    assert_eq!(o["relacao"]["estado"], "lendo");
    assert_eq!(chamar(&c, "biblioteca.limiar", json!({})).unwrap()["ultimo"]["id"], id);
    assert_eq!(
        chamar(&c, "obra.obter", json!({ "id": "x" })).unwrap_err().codigo(),
        "NAO_ENCONTRADO"
    );
    chamar(&c, "pastas.remover", json!({ "caminho": caminho })).unwrap();
    assert!(c.arquivos.caminho(arq).is_none());
}

const CSV: &str = "Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves\n\
1,Text,2000-01-01,Memórias Póstumas de Brás Cubas,pt,\"Machado de Assis, 1839-1908\",Satire,PQ,\n\
2,Text,2000-01-01,Dom Casmurro,pt,\"Assis, Machado de, 1839-1908\",Fiction,PQ,\n\
3,Sound,2000-01-01,Um áudio,en,\"Fulano, Beltrano\",,,\n\
4,Text,2000-01-01,Frankenstein,en,\"Shelley, Mary, 1797-1851\",Science fiction,PR,\n";

/// Baixador de mentira: serve o CSV de exemplo e um "EPUB" de poucos bytes, sem rede.
struct Falso;
impl Baixador for Falso {
    fn baixar(&self, url: &str, destino: &Path) -> Result<u64, ErroFierium> {
        let corpo: &[u8] = if url.contains("pg_catalog.csv") {
            CSV.as_bytes()
        } else {
            b"PK-epub-falso"
        };
        std::fs::create_dir_all(destino.parent().unwrap()).unwrap();
        std::fs::write(destino, corpo).unwrap();
        Ok(corpo.len() as u64)
    }
}

fn contexto_falso() -> (tempfile::TempDir, Contexto) {
    let d = tempfile::tempdir().unwrap();
    let mut c = Contexto::abrir(d.path()).unwrap();
    c.baixador = Box::new(Falso);
    c.pasta_de_livros = d.path().join("livros");
    c.pasta_de_cache = d.path().join("cache");
    (d, c)
}

#[test]
fn catalogo_atualizar_buscar_e_obra_id() {
    let (_d, c) = contexto_falso();
    let f = chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap();
    assert_eq!(f["itens"], 3);
    assert_eq!(chamar(&c, "catalogo.fontes", json!({})).unwrap()[0]["itens"], 3);
    let r = chamar(&c, "catalogo.buscar", json!({ "texto": "memorias postumas" })).unwrap();
    assert_eq!(r["total"], 1);
    assert!(r["itens"][0].get("obraId").is_none());
    assert_eq!(
        chamar(&c, "catalogo.atualizar", json!({ "fonte": "nao-existe" }))
            .unwrap_err()
            .codigo(),
        "NAO_ENCONTRADO"
    );
    // a pessoa já tem a obra (arquivo com o mesmo título e autor): o item aparece colorido
    let livros = tempfile::tempdir().unwrap();
    std::fs::write(
        livros
            .path()
            .join("Machado de Assis - Memórias Póstumas de Brás Cubas.pdf"),
        b"%PDF-falso",
    )
    .unwrap();
    chamar(
        &c,
        "pastas.adicionar",
        json!({ "caminho": livros.path().to_str().unwrap() }),
    )
    .unwrap();
    chamar(&c, "biblioteca.varrer", json!({})).unwrap();
    let obras = chamar(&c, "obras.listar", json!({})).unwrap();
    let r = chamar(&c, "catalogo.buscar", json!({ "texto": "machado assis" })).unwrap();
    let com: Vec<_> = r["itens"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|i| i.get("obraId").is_some())
        .collect();
    assert_eq!(com.len(), 1);
    assert_eq!(com[0]["id"], "gutenberg:1");
    assert_eq!(com[0]["obraId"], obras[0]["id"]);
    let i = chamar(&c, "catalogo.item", json!({ "id": "gutenberg:1" })).unwrap();
    assert_eq!(i["obraId"], obras[0]["id"]);
}

#[test]
fn estado_do_catalogo_vazio_erro_e_pronto() {
    let (_d, mut c) = contexto_falso();
    assert_eq!(chamar(&c, "catalogo.estado", json!({})).unwrap()["fase"], "vazio");
    // a fonte aparece antes da primeira atualização (o botão "Atualizar agora" dos Ajustes depende disso)
    assert_eq!(chamar(&c, "catalogo.fontes", json!({})).unwrap()[0]["itens"], 0);
    struct Fora;
    impl Baixador for Fora {
        fn baixar(&self, _: &str, _: &Path) -> Result<u64, ErroFierium> {
            Err(ErroFierium::Rede("o servidor está em manutenção (erro 503)".into()))
        }
    }
    c.baixador = Box::new(Fora);
    chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap_err();
    let e = chamar(&c, "catalogo.estado", json!({})).unwrap();
    assert_eq!(e["fase"], "erro");
    assert!(e["mensagem"].as_str().unwrap().contains("503"), "{e}");
    // o EPUB que não é zip (página de manutenção) não fica no disco
    c.baixador = Box::new(Falso);
    chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap();
    let e = chamar(&c, "catalogo.estado", json!({})).unwrap();
    assert_eq!((e["fase"].as_str(), e["itens"].as_i64()), (Some("pronto"), Some(3)));
    assert!(e.get("mensagem").is_none());
    struct Manutencao;
    impl Baixador for Manutencao {
        fn baixar(&self, _: &str, destino: &Path) -> Result<u64, ErroFierium> {
            std::fs::create_dir_all(destino.parent().unwrap()).unwrap();
            std::fs::write(destino, b"<html>Temporarily Down</html>").unwrap();
            Ok(29)
        }
    }
    c.baixador = Box::new(Manutencao);
    let e = chamar(&c, "catalogo.baixar", json!({ "id": "gutenberg:1" })).unwrap_err();
    assert_eq!(e.codigo(), "ERRO_DE_REDE");
    assert_eq!(std::fs::read_dir(&c.pasta_de_livros).unwrap().count(), 0);
    chamar(&c, "rede.definir", json!({ "permitida": false })).unwrap();
    assert_eq!(chamar(&c, "catalogo.estado", json!({})).unwrap()["fase"], "pronto");
}

#[test]
fn rede_desligada_da_sem_rede() {
    let (_d, c) = contexto_falso();
    assert_eq!(chamar(&c, "rede.ler", json!({})).unwrap()["permitida"], true);
    chamar(&c, "rede.definir", json!({ "permitida": false })).unwrap();
    assert_eq!(chamar(&c, "rede.ler", json!({})).unwrap()["permitida"], false);
    let e = chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap_err();
    assert_eq!(e.codigo(), "SEM_REDE");
    let e = chamar(&c, "catalogo.baixar", json!({ "id": "gutenberg:1" })).unwrap_err();
    assert_eq!(e.codigo(), "SEM_REDE");
    assert!(!c.pasta_de_livros.exists());
}

#[test]
fn baixar_grava_o_arquivo_e_entra_na_biblioteca() {
    let (_d, c) = contexto_falso();
    chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap();
    let r = chamar(&c, "catalogo.baixar", json!({ "id": "gutenberg:1" })).unwrap();
    let arq = c
        .pasta_de_livros
        .join("Machado de Assis - Memórias Póstumas de Brás Cubas.epub");
    assert_eq!(std::fs::read(&arq).unwrap(), b"PK-epub-falso");
    let obra = chamar(&c, "obra.obter", json!({ "id": r["obraId"] })).unwrap();
    assert_eq!(obra["edicoes"][0]["id"], r["edicaoId"]);
    assert_eq!(
        chamar(&c, "pastas.listar", json!({}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        1
    );
    // agora o item do catálogo aponta pra obra
    let i = chamar(&c, "catalogo.item", json!({ "id": "gutenberg:1" })).unwrap();
    assert_eq!(i["obraId"], r["obraId"]);
    // baixar de novo não duplica
    let r2 = chamar(&c, "catalogo.baixar", json!({ "id": "gutenberg:1" })).unwrap();
    assert_eq!(r2, r);
    assert_eq!(
        chamar(&c, "catalogo.baixar", json!({ "id": "gutenberg:999" }))
            .unwrap_err()
            .codigo(),
        "NAO_ENCONTRADO"
    );
}

#[test]
fn capa_salvar_grava_e_registra_na_edicao() {
    let d = tempfile::tempdir().unwrap();
    let b = Biblioteca::abrir_com_capas(&d.path().join("fierium.db"), d.path().join("capas")).unwrap();
    let c = Contexto::com(b, Catalogo::abrir(&d.path().join("catalogo.db")).unwrap());
    let livros = tempfile::tempdir().unwrap();
    std::fs::write(livros.path().join("Ana - Um Livro.pdf"), b"%PDF-falso").unwrap();
    chamar(
        &c,
        "pastas.adicionar",
        json!({ "caminho": livros.path().to_str().unwrap() }),
    )
    .unwrap();
    chamar(&c, "biblioteca.varrer", json!({})).unwrap();
    let obras = chamar(&c, "obras.listar", json!({})).unwrap();
    let ed = obras[0]["edicoes"][0]["id"].as_str().unwrap();
    assert!(obras[0]["edicoes"][0].get("capa").is_none());
    // "RIFF....WEBPxxxx" em base64
    let webp = b"RIFF\x04\x00\x00\x00WEBPVP8 ";
    let b64 = "UklGRgQAAABXRUJQVlA4IA==";
    assert_eq!(base64_decodificar(b64).unwrap(), webp);
    let r = chamar(&c, "capa.salvar", json!({ "edicaoId": ed, "imagem": b64 })).unwrap();
    assert!(r["capa"].as_str().unwrap().ends_with(&format!("/capa/{ed}")));
    let o = chamar(&c, "obras.listar", json!({})).unwrap();
    assert!(o[0]["edicoes"][0]["capa"]
        .as_str()
        .unwrap()
        .ends_with(&format!("/capa/{ed}")));
    assert!(c.arquivos.caminho_da_capa(ed).is_some());
    // lixo não vira capa
    let e = chamar(&c, "capa.salvar", json!({ "edicaoId": ed, "imagem": "bGl4bw==" })).unwrap_err();
    assert_eq!(e.codigo(), "ARGUMENTO_INVALIDO");
    let e = chamar(&c, "capa.salvar", json!({ "edicaoId": "x", "imagem": b64 })).unwrap_err();
    assert_eq!(e.codigo(), "NAO_ENCONTRADO");
}

#[test]
fn capa_do_catalogo_so_pra_id_conhecido_e_respeita_a_rede() {
    struct Capa;
    impl Baixador for Capa {
        fn baixar(&self, url: &str, destino: &Path) -> Result<u64, ErroFierium> {
            let corpo: Vec<u8> = if url.contains("pg_catalog.csv") {
                CSV.as_bytes().to_vec()
            } else if url.contains(".cover.") {
                [&[0xFF, 0xD8, 0xFF][..], &[1u8; 4000]].concat()
            } else {
                return Err(ErroFierium::Rede("fora do ar".into()));
            };
            std::fs::create_dir_all(destino.parent().unwrap()).unwrap();
            std::fs::write(destino, &corpo).unwrap();
            Ok(corpo.len() as u64)
        }
    }
    let d = tempfile::tempdir().unwrap();
    let mut c = Contexto::abrir(d.path()).unwrap();
    c.baixador = Box::new(Capa);
    c.pasta_de_capas_catalogo = d.path().join("capas-catalogo");
    chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap();
    let r = chamar(&c, "catalogo.buscar", json!({ "texto": "dom casmurro" })).unwrap();
    let capa = r["itens"][0]["capa"].as_str().unwrap();
    assert!(capa.ends_with("/capa/cat-gutenberg_2"), "{capa}");
    assert!(
        capa_do_catalogo(&c, "gutenberg_999").is_none(),
        "id que o catálogo não conhece"
    );
    assert!(capa_do_catalogo(&c, "..").is_none());
    chamar(&c, "rede.definir", json!({ "permitida": false })).unwrap();
    assert!(capa_do_catalogo(&c, "gutenberg_2").is_none(), "sem rede e sem cache");
    chamar(&c, "rede.definir", json!({ "permitida": true })).unwrap();
    let p = capa_do_catalogo(&c, "gutenberg_2").unwrap();
    assert!(p.starts_with(d.path().join("capas-catalogo")));
    chamar(&c, "rede.definir", json!({ "permitida": false })).unwrap();
    assert!(
        capa_do_catalogo(&c, "gutenberg_2").is_some(),
        "o cache vale mesmo sem rede"
    );
}

/// De ponta a ponta com a internet de verdade (não roda nos portões):
/// `cargo test --release -p fierium-app na_rede_de_verdade -- --ignored --nocapture`
#[test]
#[ignore = "usa a internet de verdade (Project Gutenberg)"]
fn na_rede_de_verdade() {
    let d = tempfile::tempdir().unwrap();
    let mut c = Contexto::abrir(d.path()).unwrap();
    c.pasta_de_livros = d.path().join("livros");
    let t = std::time::Instant::now();
    let f = chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap();
    println!("catálogo: {} itens em {:?}", f["itens"], t.elapsed());
    assert!(f["itens"].as_i64().unwrap() > 70_000);
    for (busca, idioma) in [
        (json!({ "autor": "Machado de Assis", "texto": "Dom Casmurro" }), "pt"),
        (json!({ "assunto": "Fantasy", "limite": 1 }), "en"),
        (json!({ "assunto": "Poetry", "idioma": "pt", "limite": 1 }), "pt"),
    ] {
        let r = chamar(&c, "catalogo.buscar", busca.clone()).unwrap();
        let item = &r["itens"][0];
        assert_eq!(item["idioma"], idioma, "{busca}");
        let t = std::time::Instant::now();
        let b = chamar(&c, "catalogo.baixar", json!({ "id": item["id"] })).unwrap();
        let obra = chamar(&c, "obra.obter", json!({ "id": b["obraId"] })).unwrap();
        println!("{} → obra \"{}\" em {:?}", item["id"], obra["titulo"], t.elapsed());
        let de_novo = chamar(&c, "catalogo.item", json!({ "id": item["id"] })).unwrap();
        assert_eq!(de_novo["obraId"], b["obraId"], "baixado, o item fica colorido");
        chamar(&c, "edicao.abrir", json!({ "edicaoId": b["edicaoId"] })).unwrap();
    }
    for a in std::fs::read_dir(&c.pasta_de_livros).unwrap() {
        let a = a.unwrap();
        println!(
            "  {} ({} bytes)",
            a.file_name().to_string_lossy(),
            a.metadata().unwrap().len()
        );
    }
}

#[test]
fn cada_comando_tem_uma_area_so_e_todos_sao_atendidos() {
    let lista = comandos_do_rust();
    let mut unicos = lista.clone();
    unicos.sort_unstable();
    unicos.dedup();
    assert_eq!(unicos.len(), lista.len(), "comando declarado em duas áreas");
    let (_d, c) = contexto();
    for cmd in lista {
        // com argumentos vazios, o comando pode falhar por argumento, mas nunca por "não sei o que é isso"
        let r = chamar(&c, cmd, json!({}));
        assert!(
            r.as_ref().err().is_none_or(|e| e.codigo() != "COMANDO_DESCONHECIDO"),
            "{cmd} não foi despachado"
        );
    }
}
