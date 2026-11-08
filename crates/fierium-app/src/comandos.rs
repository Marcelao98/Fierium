//! Os comandos do contrato (docs/CONTRATOS.md), com os MESMOS nomes da interface ("app.info", "log.escrever"…).
//! Uma porta só (`chamar`) que despacha por nome: nada de shell nem de caminho solto, e é testável sem Tauri.
//! A interface usa o adaptador combinado: o que já existe aqui vem do Rust, o resto ainda vem do exemplo em memória
//! (cada área troca quando fica pronta, M3 em diante).
use fierium_core::{info, log, ErroFierium};
use serde::de::DeserializeOwned;
use serde_json::Value;

/// Os comandos que o Rust já atende (a interface pergunta isso pra montar o adaptador combinado).
pub const NO_RUST: &[&str] = &["app.info", "app.comandos", "log.escrever"];

fn args<T: DeserializeOwned>(v: Value) -> Result<T, ErroFierium> {
    serde_json::from_value(v).map_err(|e| ErroFierium::argumento("args", e.to_string()))
}

pub fn chamar(cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    let json = |v: Value| Ok(v);
    match cmd {
        "app.info" => json(serde_json::to_value(info::info_app(env!("CARGO_PKG_VERSION"))).expect("info vira json")),
        "app.comandos" => json(serde_json::json!(NO_RUST)),
        "log.escrever" => {
            log::escrever(&args(a)?)?;
            json(Value::Null)
        }
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn nomes_iguais_aos_da_interface_e_erro_com_codigo() {
        let i = chamar("app.info", Value::Null).unwrap();
        assert_eq!(i["adaptador"], "tauri");
        assert_eq!(
            chamar("shell.rodar", Value::Null).unwrap_err().codigo(),
            "COMANDO_DESCONHECIDO"
        );
        let ruim = serde_json::json!({ "nivel": "info" });
        assert_eq!(chamar("log.escrever", ruim).unwrap_err().codigo(), "ARGUMENTO_INVALIDO");
        let ok = serde_json::json!({ "nivel": "info", "origem": "teste", "mensagem": "oi" });
        assert_eq!(chamar("log.escrever", ok).unwrap(), Value::Null);
        assert_eq!(
            chamar("app.comandos", Value::Null).unwrap().as_array().unwrap().len(),
            NO_RUST.len()
        );
    }
}
