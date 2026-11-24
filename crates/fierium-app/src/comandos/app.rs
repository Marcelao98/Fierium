//! Comandos do próprio programa: informações, a lista de comandos e o log da interface.
use super::{args, comandos_do_rust, Contexto};
use fierium_core::{info, log, ErroFierium};
use serde_json::Value;

pub(super) const COMANDOS: &[&str] = &["app.info", "app.comandos", "log.escrever"];

pub(super) fn atender(_: &Contexto, cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    match cmd {
        "app.info" => Ok(serde_json::to_value(info::info_app(env!("CARGO_PKG_VERSION"))).expect("info vira json")),
        "app.comandos" => Ok(serde_json::json!(comandos_do_rust())),
        "log.escrever" => {
            log::escrever(&args(a)?)?;
            Ok(Value::Null)
        }
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}
