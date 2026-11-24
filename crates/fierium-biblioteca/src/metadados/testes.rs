use super::epub::*;
use super::nome::*;
use super::*;

type Nome = (String, String, Option<(String, f64)>, Option<i32>);

fn nome(n: &str) -> Nome {
    let m = pelo_nome(n);
    (
        m.criadores.first().map(|p| p.nome.clone()).unwrap_or_default(),
        m.titulo,
        m.serie.map(|s| (s.nome, s.volume)),
        m.ano,
    )
}

#[test]
fn discworld() {
    let (a, t, s, _) = nome("Discworld.08.Guards!Guards!.198 - Pratchett, Terry.pdf");
    assert_eq!((a.as_str(), t.as_str()), ("Terry Pratchett", "Guards! Guards!"));
    assert_eq!(s, Some(("Discworld".into(), 8.0)));
}

#[test]
fn tabela_de_nomes() {
    #[allow(clippy::type_complexity)]
    let casos: &[(&str, &str, &str, Option<(&str, f64)>, Option<i32>)] = &[
        (
            "Machado de Assis - Dom_Casmurro (1899).PDF",
            "Machado de Assis",
            "Dom Casmurro",
            None,
            Some(1899),
        ),
        ("o.alienista.epub", "", "o alienista", None, None),
        ("Livro (Edição 2).pdf", "", "Livro (Edição 2)", None, None),
        (
            "Dom Casmurro - Machado de Assis.epub",
            "Machado de Assis",
            "Dom Casmurro",
            None,
            None,
        ),
        (
            "Guards! Guards! - Terry Pratchett.pdf",
            "Terry Pratchett",
            "Guards! Guards!",
            None,
            None,
        ),
        (
            "Pratchett, Terry - Guards! Guards!.pdf",
            "Terry Pratchett",
            "Guards! Guards!",
            None,
            None,
        ),
        (
            "Guards! Guards! - Pratchett, Terry.pdf",
            "Terry Pratchett",
            "Guards! Guards!",
            None,
            None,
        ),
        ("Ana - Um Livro.pdf", "Ana", "Um Livro", None, None),
        ("shelley-frankenstein.epub", "", "shelley frankenstein", None, None),
        ("Frankenstein.pdf", "", "Frankenstein", None, None),
        ("Naruto vol. 12.pdf", "", "Naruto 12", Some(("Naruto", 12.0)), None),
        (
            "Naruto v12 - Masashi Kishimoto.pdf",
            "Masashi Kishimoto",
            "Naruto 12",
            Some(("Naruto", 12.0)),
            None,
        ),
        ("One Piece #05.pdf", "", "One Piece 5", Some(("One Piece", 5.0)), None),
        ("Akira tomo 3.pdf", "", "Akira 3", Some(("Akira", 3.0)), None),
        (
            "Fundação Volume 2 - Isaac Asimov.epub",
            "Isaac Asimov",
            "Fundação 2",
            Some(("Fundação", 2.0)),
            None,
        ),
        (
            "[Z-Library] O Hobbit - J. R. R. Tolkien.epub",
            "J. R. R. Tolkien",
            "O Hobbit",
            None,
            None,
        ),
        ("1984 - George Orwell.pdf", "George Orwell", "1984", None, None),
        (
            "George Orwell - 1984 (1949).pdf",
            "George Orwell",
            "1984",
            None,
            Some(1949),
        ),
        ("A Revolução dos Bichos.pdf", "", "A Revolução dos Bichos", None, None),
        (
            "Neil Gaiman - Sandman - Prelúdios e Noturnos.pdf",
            "Neil Gaiman",
            "Sandman - Prelúdios e Noturnos",
            None,
            None,
        ),
        (
            "Sandman - Prelúdios e Noturnos - Neil Gaiman.pdf",
            "Neil Gaiman",
            "Sandman - Prelúdios e Noturnos",
            None,
            None,
        ),
        (
            "Mary_Shelley_-_Frankenstein.epub",
            "Mary Shelley",
            "Frankenstein",
            None,
            None,
        ),
        (
            "Harry.Potter.01.A.Pedra.Filosofal.pdf",
            "",
            "A Pedra Filosofal",
            Some(("Harry Potter", 1.0)),
            None,
        ),
        ("   Espaços   demais .pdf", "", "Espaços demais", None, None),
        ("sem extensão", "", "sem extensão", None, None),
        (
            "Clarice Lispector - A Hora da Estrela.EPUB",
            "Clarice Lispector",
            "A Hora da Estrela",
            None,
            None,
        ),
        ("Isaac Asimov - Eu, Robô.pdf", "Isaac Asimov", "Eu, Robô", None, None),
        ("Berserk 03.pdf", "", "Berserk 03", None, None),
    ];
    for (arq, a, t, s, y) in casos {
        let (ra, rt, rs, ry) = nome(arq);
        assert_eq!((ra.as_str(), rt.as_str()), (*a, *t), "{arq}");
        assert_eq!(rs, s.map(|(n, v)| (n.to_string(), v)), "{arq} série");
        assert_eq!(ry, *y, "{arq} ano");
    }
}

#[test]
fn lixo_e_completar() {
    for l in [
        "Untitled",
        "untitled document",
        "Microsoft Word - cap1.doc",
        "12345",
        "",
        "relatorio.docx",
        "  ",
        "2020-03",
    ] {
        assert!(titulo_lixo(l), "{l}");
    }
    assert!(!titulo_lixo("Frankenstein"));
    let dentro = Metadados {
        titulo: "Untitled".into(),
        criadores: vec![Pessoa {
            nome: "Unknown".into(),
            papel: "autor".into(),
        }],
        ..Default::default()
    };
    let m = completar(&dentro, &pelo_nome("Mary Shelley - Frankenstein.pdf"));
    assert_eq!(m.titulo, "Frankenstein");
    assert_eq!(m.criadores[0].nome, "Mary Shelley");
    let dentro = Metadados {
        titulo: "Frankenstein; ou, o Prometeu Moderno".into(),
        ..Default::default()
    };
    let m = completar(&dentro, &pelo_nome("Mary Shelley - Frankenstein (1818).pdf"));
    assert_eq!(m.titulo, "Frankenstein; ou, o Prometeu Moderno");
    assert_eq!((m.criadores[0].nome.as_str(), m.ano), ("Mary Shelley", Some(1818)));
}

#[test]
fn entidades_e_href() {
    assert_eq!(entidades("A &amp; B &#233; &#xE9; &zzz; &"), "A & B é é &zzz; &");
    assert_eq!(descodificar_href("img/c%20over.jpg#x"), "img/c over.jpg");
    assert_eq!(juntar_caminho("OEBPS", "../img/a.png"), "img/a.png");
    assert_eq!(juntar_caminho("", "a/b.png"), "a/b.png");
}
