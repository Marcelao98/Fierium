//! A busca de tudo (Ctrl+K): obras, autores e marcações.
use super::{args, Contexto};
use fierium_core::ErroFierium;
use serde::Deserialize;
use serde_json::Value;

pub(super) const COMANDOS: &[&str] = &["busca.tudo"];

#[derive(Deserialize)]
struct Busca {
    texto: String,
}

pub(super) fn atender(ctx: &Contexto, cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    match cmd {
        "busca.tudo" => ctx.ler()?.busca_tudo(&args::<Busca>(a)?.texto),
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}
