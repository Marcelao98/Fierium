//! Marcações: destaques, notas e marcadores de página.
use super::{args, Contexto, PorId};
use fierium_core::ErroFierium;
use serde_json::Value;

pub(super) const COMANDOS: &[&str] = &[
    "marcacoes.listar",
    "marcacao.criar",
    "marcacao.atualizar",
    "marcacao.apagar",
];

pub(super) fn atender(ctx: &Contexto, cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    match cmd {
        "marcacoes.listar" => ctx.ler()?.marcacoes_listar(&a),
        "marcacao.criar" => ctx.escrever().marcacao_criar(&a),
        "marcacao.atualizar" => ctx.escrever().marcacao_atualizar(&a),
        "marcacao.apagar" => {
            ctx.escrever().marcacao_apagar(&args::<PorId>(a)?.id)?;
            Ok(Value::Null)
        }
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}
