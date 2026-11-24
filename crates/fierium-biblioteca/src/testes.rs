use super::*;
use serde_json::{json, Value};
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

#[test]
fn conexao_de_leitura_le_durante_uma_escrita_aberta_e_recusa_escrever() {
    let (_d, l, mut b) = montar();
    livro(&l.path().join("Autor - Um.pdf"), "um");
    b.pastas_adicionar(l.path().to_str().unwrap()).unwrap();
    b.varrer().unwrap();
    let pool = b.leitores(2);
    // uma transação de escrita aberta e não commitada na conexão de escrita: a leitura segue (WAL)
    let tx = b.bd.unchecked_transaction().unwrap();
    tx.execute("UPDATE obras SET titulo = 'Mudado'", []).unwrap();
    let leitor = pool.emprestar().unwrap();
    let v = leitor.obras_listar(&json!({})).unwrap();
    assert_eq!(
        v[0]["titulo"], "Um",
        "a leitura vê o último estado commitado, não a escrita em andamento"
    );
    // e uma conexão só-leitura nunca escreve
    assert!(leitor.bd.execute("UPDATE obras SET titulo = 'X'", []).is_err());
    assert!(leitor.progresso_salvar("qualquer", "1", 0.5).is_err());
    drop(leitor);
    tx.commit().unwrap();
    assert_eq!(
        pool.emprestar().unwrap().obras_listar(&json!({})).unwrap()[0]["titulo"],
        "Mudado"
    );
    assert_eq!(pool.livres(), 1, "a conexão voltou pro pool");
}

#[test]
fn estante_em_paginas_mantem_a_ordem() {
    let (_d, l, mut b) = montar();
    for nome in ["E", "C", "A", "D", "B"] {
        livro(&l.path().join(format!("Autor - {nome}.pdf")), nome);
    }
    b.pastas_adicionar(l.path().to_str().unwrap()).unwrap();
    b.varrer().unwrap();
    let titulos = |f: Value| -> Vec<String> {
        b.obras_listar(&f)
            .unwrap()
            .as_array()
            .unwrap()
            .iter()
            .map(|o| o["titulo"].as_str().unwrap().to_string())
            .collect()
    };
    assert_eq!(titulos(json!({ "ordem": "titulo" })), ["A", "B", "C", "D", "E"]);
    assert_eq!(titulos(json!({ "ordem": "titulo", "limite": 2 })), ["A", "B"]);
    assert_eq!(
        titulos(json!({ "ordem": "titulo", "limite": 2, "deslocamento": 2 })),
        ["C", "D"]
    );
    assert_eq!(titulos(json!({ "ordem": "titulo", "deslocamento": 4 })), ["E"]);
    assert!(titulos(json!({ "ordem": "titulo", "deslocamento": 9 })).is_empty());
}
