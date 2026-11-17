//! Metadados de dentro dos arquivos, na biblioteca de ponta a ponta. Todos os arquivos são GERADOS aqui.
use super::*;
use std::fs;
use std::io::Write;

fn epub(caminho: &Path, metadados_opf: &str, capa: Option<&[u8]>) {
    fs::create_dir_all(caminho.parent().unwrap()).unwrap();
    let f = fs::File::create(caminho).unwrap();
    let mut z = zip::ZipWriter::new(f);
    let o = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    z.start_file("mimetype", o).unwrap();
    z.write_all(b"application/epub+zip").unwrap();
    z.start_file("META-INF/container.xml", o).unwrap();
    z.write_all(
        br#"<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>"#,
    )
    .unwrap();
    let manifest = if capa.is_some() {
        r#"<manifest><item id="c" href="img/capa%201.png" media-type="image/png" properties="cover-image"/></manifest>"#
    } else {
        "<manifest/>"
    };
    z.start_file("OEBPS/content.opf", o).unwrap();
    z.write_all(
        format!(
            r#"<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0">
            <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">{metadados_opf}</metadata>
            {manifest}</package>"#
        )
        .as_bytes(),
    )
    .unwrap();
    if let Some(b) = capa {
        z.start_file("OEBPS/img/capa 1.png", o).unwrap();
        z.write_all(b).unwrap();
    }
    z.finish().unwrap();
}

/// PDF mínimo, escrito à mão, com dicionário Info opcional.
fn pdf(caminho: &Path, info: Option<&str>) {
    fs::create_dir_all(caminho.parent().unwrap()).unwrap();
    let mut o = String::from("%PDF-1.4\n");
    let mut pos = Vec::new();
    let mut objs = vec![
        "<</Type/Catalog/Pages 2 0 R>>".to_string(),
        "<</Type/Pages/Kids[3 0 R]/Count 1>>".to_string(),
        "<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>".to_string(),
    ];
    if let Some(i) = info {
        objs.push(format!("<<{i}>>"));
    }
    for (n, c) in objs.iter().enumerate() {
        pos.push(o.len());
        o.push_str(&format!("{} 0 obj\n{c}\nendobj\n", n + 1));
    }
    let xref = o.len();
    o.push_str(&format!("xref\n0 {}\n0000000000 65535 f \n", objs.len() + 1));
    for p in &pos {
        o.push_str(&format!("{p:010} 00000 n \n"));
    }
    let info_ref = if info.is_some() { "/Info 4 0 R" } else { "" };
    o.push_str(&format!(
        "trailer\n<</Size {}/Root 1 0 R{info_ref}>>\nstartxref\n{xref}\n%%EOF\n",
        objs.len() + 1
    ));
    fs::write(caminho, o).unwrap();
}

fn montar() -> (tempfile::TempDir, tempfile::TempDir, Biblioteca) {
    let dados = tempfile::tempdir().unwrap();
    let livros = tempfile::tempdir().unwrap();
    let b = Biblioteca::abrir_com_capas(&dados.path().join("fierium.db"), dados.path().join("capas")).unwrap();
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

fn autores(o: &Value) -> Vec<String> {
    o["criadores"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["nome"].as_str().unwrap().to_string())
        .collect()
}

#[test]
fn discworld_pelo_nome_com_arquivo_ilegivel() {
    let (_d, l, mut b) = montar();
    fs::write(
        l.path().join("Discworld.08.Guards!Guards!.198 - Pratchett, Terry.pdf"),
        b"%PDF-falso",
    )
    .unwrap();
    b.varrer().unwrap();
    let o = &todas(&b)[0];
    assert_eq!(o["titulo"], "Guards! Guards!");
    assert_eq!(autores(o), ["Terry Pratchett"]);
    assert_eq!(o["serie"], json!({ "nome": "Discworld", "volume": 8.0 }));
}

#[test]
fn epub_com_serie_papeis_e_capa_extraida() {
    let (d, l, mut b) = montar();
    let opf = r##"<dc:title>Guardas! Guardas!</dc:title>
        <dc:creator id="a1">Pratchett, Terry</dc:creator><dc:creator id="a2">Ana Tradutora</dc:creator>
        <meta refines="#a2" property="role" scheme="marc:relators">trl</meta>
        <dc:date>1989-11-01</dc:date><dc:language>pt-BR</dc:language><dc:subject>Fantasia</dc:subject>
        <dc:identifier>urn:isbn:978-85-359-1234-5</dc:identifier>
        <meta name="calibre:series" content="Discworld &amp; Cia"/><meta name="calibre:series_index" content="8.0"/>"##;
    epub(&l.path().join("qualquer-coisa.epub"), opf, Some(b"\x89PNG-falso"));
    b.varrer().unwrap();
    let o = &todas(&b)[0];
    assert_eq!(o["titulo"], "Guardas! Guardas!");
    assert_eq!(
        o["criadores"][0],
        json!({ "nome": "Terry Pratchett", "papel": "autor" })
    );
    assert_eq!(
        o["criadores"][1],
        json!({ "nome": "Ana Tradutora", "papel": "tradutor" })
    );
    assert_eq!(
        (o["ano"].as_i64(), o["assuntos"][0].as_str()),
        (Some(1989), Some("Fantasia"))
    );
    assert_eq!(o["serie"], json!({ "nome": "Discworld & Cia", "volume": 8.0 }));
    assert_eq!(o["edicoes"][0]["idioma"], "pt-BR");
    // capa: gravada no cache, registrada e com endereço no protocolo
    let ed = o["edicoes"][0]["id"].as_str().unwrap();
    let capa = o["edicoes"][0]["capa"].as_str().unwrap();
    assert!(capa.ends_with(&format!("/capa/{ed}")), "{capa}");
    let reg = b.capas_existentes().unwrap();
    assert_eq!(reg.len(), 1);
    assert_eq!(reg[0].0, ed);
    assert!(reg[0].1.starts_with(d.path().join("capas")) && reg[0].1.extension().unwrap() == "png");
    assert_eq!(fs::read(&reg[0].1).unwrap(), b"\x89PNG-falso");
}

#[test]
fn pdf_com_info_e_pdf_quebrado() {
    let (_d, l, mut b) = montar();
    pdf(
        &l.path().join("x1.pdf"),
        Some("/Title(Frankenstein)/Author(Shelley, Mary)/CreationDate(D:20010203)"),
    );
    fs::write(l.path().join("quebrado.pdf"), b"isto nao e pdf").unwrap();
    b.varrer().unwrap();
    let obras = todas(&b);
    assert_eq!(obras.len(), 2);
    let f = obras.iter().find(|o| o["titulo"] == "Frankenstein").unwrap();
    assert_eq!(autores(f), ["Mary Shelley"]);
    assert_eq!(f["ano"], 2001);
    assert_eq!(f["edicoes"][0]["paginas"], 1);
    // sem capa: a interface desenha a 1ª página
    assert!(f["edicoes"][0].get("capa").is_none());
    // quebrado não derruba nada: fica o nome
    assert!(obras.iter().any(|o| o["titulo"] == "quebrado"));
}

#[test]
fn lixo_no_pdf_e_ignorado_e_o_nome_completa() {
    let (_d, l, mut b) = montar();
    pdf(
        &l.path().join("Mary Shelley - Frankenstein (1818).pdf"),
        Some("/Title(Microsoft Word - cap1.doc)/Author(Unknown)"),
    );
    pdf(&l.path().join("Outro - Livro.pdf"), Some("/Title(12345)"));
    b.varrer().unwrap();
    let obras = todas(&b);
    let f = obras.iter().find(|o| o["titulo"] == "Frankenstein").unwrap();
    assert_eq!(
        (autores(f), f["ano"].as_i64()),
        (vec!["Mary Shelley".to_string()], Some(1818))
    );
    assert!(obras.iter().any(|o| o["titulo"] == "Livro"));
}

fn frankenstein_epub(p: &Path) {
    epub(
        p,
        "<dc:title>Frankenstein</dc:title><dc:creator>Shelley, Mary</dc:creator>",
        None,
    );
}

#[test]
fn frankenstein_pdf_e_epub_juntam_nas_duas_ordens() {
    // o PDF primeiro, o EPUB depois
    let (_d, l, mut b) = montar();
    pdf(&l.path().join("Frankenstein.pdf"), None);
    b.varrer().unwrap();
    frankenstein_epub(&l.path().join("shelley-frankenstein.epub"));
    b.varrer().unwrap();
    let obras = todas(&b);
    assert_eq!(obras.len(), 1);
    assert_eq!(obras[0]["edicoes"].as_array().unwrap().len(), 2);
    assert_eq!(autores(&obras[0]), ["Mary Shelley"]);
    // o EPUB primeiro, o PDF depois
    let (_d, l, mut b) = montar();
    frankenstein_epub(&l.path().join("shelley-frankenstein.epub"));
    b.varrer().unwrap();
    pdf(&l.path().join("Frankenstein.pdf"), None);
    b.varrer().unwrap();
    let obras = todas(&b);
    assert_eq!(obras.len(), 1);
    assert_eq!(obras[0]["edicoes"].as_array().unwrap().len(), 2);
}

#[test]
fn editar_a_mao_sobrevive_a_varredura_e_ao_reprocesso() {
    let (_d, l, mut b) = montar();
    pdf(
        &l.path().join("Frankenstein.pdf"),
        Some("/Title(Frankenstein)/Author(Mary Shelley)"),
    );
    b.varrer().unwrap();
    let id = todas(&b)[0]["id"].as_str().unwrap().to_string();
    let o = b
        .obra_editar(&json!({
            "id": id, "titulo": "Frankenstein, ou o Prometeu Moderno", "autores": ["Shelley, Mary", "Outra Pessoa"],
            "serie": { "nome": "Clássicos", "volume": 3 }, "ano": 1818
        }))
        .unwrap();
    assert_eq!(o["titulo"], "Frankenstein, ou o Prometeu Moderno");
    assert_eq!(autores(&o), ["Mary Shelley", "Outra Pessoa"]);
    assert_eq!(
        (o["ano"].as_i64(), o["serie"]["nome"].as_str()),
        (Some(1818), Some("Clássicos"))
    );
    // varredura nova (arquivo novo de outro livro) e reprocesso forçado: nada é sobrescrito
    pdf(&l.path().join("Outro Livro.pdf"), None);
    b.bd.execute("UPDATE edicoes SET meta_v = 0", []).unwrap();
    b.varrer().unwrap();
    let o = b.obra_obter(&id).unwrap();
    assert_eq!(o["titulo"], "Frankenstein, ou o Prometeu Moderno");
    assert_eq!(autores(&o), ["Mary Shelley", "Outra Pessoa"]);
    assert_eq!(o["serie"]["volume"], 3.0);
    // apagar série e ano com null; título vazio é erro com código
    let o = b.obra_editar(&json!({ "id": id, "serie": null, "ano": null })).unwrap();
    assert!(o.get("serie").is_none() && o.get("ano").is_none());
    assert_eq!(
        b.obra_editar(&json!({ "id": id, "titulo": " " })).unwrap_err().codigo(),
        "ARGUMENTO_INVALIDO"
    );
}

#[test]
fn reprocesso_corrige_e_junta_sem_perder_progresso_e_respeita_separar() {
    let (_d, l, mut b) = montar();
    pdf(&l.path().join("Frankenstein.pdf"), None);
    pdf(
        &l.path().join("scan-0042.pdf"),
        Some("/Title(Frankenstein)/Author(Shelley, Mary)"),
    );
    b.varrer().unwrap();
    assert_eq!(todas(&b).len(), 1);
    // simula a biblioteca de antes: duas obras com os nomes de arquivo e nada lido por dentro
    let obras = b.carregar_obras(None).unwrap();
    let ed_b = obras[0]
        .edicoes
        .iter()
        .find(|e| e.arquivos[0].nome == "scan-0042.pdf")
        .unwrap()
        .id
        .clone();
    let nova = novo_id();
    b.bd.execute(
        "INSERT INTO obras (id, titulo, autor, matiz, adicionada_em) VALUES (?1,'scan 0042','',1,1)",
        params![nova],
    )
    .unwrap();
    b.bd.execute(
        "UPDATE edicoes SET obra_id = ?2, chave_titulo = 'scan 0042', chave_autor = '', meta = NULL, meta_v = 0
             WHERE id = ?1",
        params![ed_b, nova],
    )
    .unwrap();
    b.progresso_salvar(&ed_b, "7", 0.4).unwrap();
    let r = b.reprocessar_metadados().unwrap();
    assert_eq!(r, 1);
    let obras = todas(&b);
    assert_eq!(obras.len(), 1, "as duas viraram uma");
    let e = obras[0]["edicoes"].as_array().unwrap();
    assert_eq!(e.len(), 2);
    let com = e.iter().find(|x| x["id"] == ed_b).unwrap();
    assert_eq!(com["progresso"]["posicao"], "7");
    // roda só uma vez
    assert_eq!(b.reprocessar_metadados().unwrap(), 0);

    // separada à mão: nenhum reprocesso junta de novo
    b.edicao_separar(&ed_b).unwrap();
    b.bd.execute("UPDATE edicoes SET meta_v = 0", []).unwrap();
    b.varrer().unwrap();
    assert_eq!(todas(&b).len(), 2);
}

#[test]
fn sugestoes_de_dentro_do_nome_e_da_open_library_com_cache() {
    let (_d, l, mut b) = montar();
    pdf(
        &l.path().join("Terry Pratchett - Guards Guards.pdf"),
        Some("/Title(Guards! Guards!)/Author(Terry Pratchett)"),
    );
    b.varrer().unwrap();
    let id = todas(&b)[0]["id"].as_str().unwrap().to_string();
    // sem rede: só o que está no computador
    let s = b
        .obra_sugestoes_com(&id, false, &|_| panic!("rede não permitida"))
        .unwrap();
    let origens: Vec<&str> = s
        .as_array()
        .unwrap()
        .iter()
        .map(|x| x["origem"].as_str().unwrap())
        .collect();
    assert_eq!(origens, ["Dentro do arquivo (PDF)", "Nome do arquivo"]);
    // com rede: busca uma vez e depois vem do cache
    let chamadas = std::cell::Cell::new(0);
    let busca = |url: &str| -> Result<String, String> {
        chamadas.set(chamadas.get() + 1);
        assert!(
            url.starts_with("https://openlibrary.org/search.json?title=Guards%21%20Guards%21&"),
            "{url}"
        );
        Ok(
            r#"{"docs":[{"title":"Guards! Guards!","author_name":["Terry Pratchett"],"first_publish_year":1989}]}"#
                .into(),
        )
    };
    let s = b.obra_sugestoes_com(&id, true, &busca).unwrap();
    let ol = s
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["origem"] == "Open Library")
        .unwrap()
        .clone();
    assert_eq!(
        (ol["ano"].as_i64(), ol["pessoas"][0]["nome"].as_str()),
        (Some(1989), Some("Terry Pratchett"))
    );
    b.obra_sugestoes_com(&id, true, &busca).unwrap();
    assert_eq!(chamadas.get(), 1);
    // rede fora do ar não quebra
    b.bd.execute("DELETE FROM cache_rede", []).unwrap();
    assert!(b.obra_sugestoes_com(&id, true, &|_| Err("sem rede".into())).is_ok());
    // aplicar vale como edição à mão
    let _ = b.obra_sugestoes_com(&id, true, &busca).unwrap();
    let o = b.obra_aplicar_sugestao(&id, ol["id"].as_str().unwrap()).unwrap();
    assert_eq!(o["ano"], 1989);
    assert_eq!(
        b.obra_aplicar_sugestao(&id, "nada:0").unwrap_err().codigo(),
        "NAO_ENCONTRADO"
    );
}
