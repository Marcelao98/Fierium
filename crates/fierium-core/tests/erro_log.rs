use fierium_core::{info::pasta_de_dados, log, ErroContrato, ErroFierium};

#[test]
fn erro_vira_contrato_com_codigo_e_mensagem() {
    let e = ErroFierium::de_io("livro.pdf", std::io::Error::from(std::io::ErrorKind::NotFound));
    assert_eq!(
        ErroContrato::from(e),
        ErroContrato {
            codigo: "NAO_ENCONTRADO".into(),
            mensagem: "não encontrado: livro.pdf".into()
        }
    );
}

#[test]
fn pasta_de_dados_no_linux() {
    if cfg!(windows) {
        return;
    }
    let v = |k: &str| match k {
        "HOME" => Some("/home/marcelo".to_string()),
        _ => None,
    };
    assert_eq!(
        pasta_de_dados(v).unwrap().to_str(),
        Some("/home/marcelo/.local/share/fierium")
    );
}

#[test]
fn log_da_tela_corta_e_recusa_nivel_errado() {
    assert!(log::cortar(&"á".repeat(10_000)).len() <= 8 * 1024);
    let l = log::LinhaDaTela {
        nivel: "grito".into(),
        origem: "t".into(),
        mensagem: "m".into(),
        dados: None,
    };
    assert_eq!(log::escrever(&l).unwrap_err().codigo(), "ARGUMENTO_INVALIDO");
}
