//! Ler de verdade: abrir uma edição (devolve o endereço do arquivo no protocolo) e salvar o progresso.
use super::{args, Contexto};
use fierium_core::ErroFierium;
use serde::Deserialize;
use serde_json::Value;

pub(super) const COMANDOS: &[&str] = &["edicao.abrir", "progresso.salvar"];

#[derive(Deserialize)]
pub(super) struct Edicao {
    #[serde(rename = "edicaoId")]
    pub edicao_id: String,
}

#[derive(Deserialize)]
struct Progresso {
    #[serde(rename = "edicaoId")]
    edicao_id: String,
    posicao: String,
    fracao: f64,
}

pub(super) fn atender(ctx: &Contexto, cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    match cmd {
        "edicao.abrir" => ctx.ler()?.edicao_abrir(&args::<Edicao>(a)?.edicao_id),
        "progresso.salvar" => {
            let x: Progresso = args(a)?;
            ctx.escrever().progresso_salvar(&x.edicao_id, &x.posicao, x.fracao)?;
            Ok(Value::Null)
        }
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}
