use super::*;
use crate::banco::Biblioteca;
use rusqlite::Connection;
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
