//! Fierium (Tauri 2): abre a janela com a interface, atende os comandos por `chamar` e entrega arquivos aos pedaços
//! pelo protocolo `fierium://`. Log em arquivo desde o primeiro instante.
#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]

mod comandos;
mod protocolo;

use fierium_core::ErroContrato;
use serde_json::Value;

/// A porta única dos comandos (nomes iguais aos do contrato da interface).
#[tauri::command]
fn chamar(cmd: String, args: Option<Value>) -> Result<Value, ErroContrato> {
    comandos::chamar(&cmd, args.unwrap_or(Value::Null)).map_err(|e| {
        if e.codigo() != "NAO_ENCONTRADO" {
            tracing::warn!(cmd, codigo = e.codigo(), "{e}");
        }
        e.into()
    })
}

fn main() {
    let pasta = fierium_core::info::pasta_de_dados(|k| std::env::var(k).ok())
        .unwrap_or_else(|| std::env::temp_dir().join("fierium"));
    let _log = match fierium_core::log::ligar(&pasta) {
        Ok(g) => Some(g),
        Err(e) => {
            eprintln!("Fierium: sem log em arquivo ({e})");
            None
        }
    };
    tracing::info!(versao = env!("CARGO_PKG_VERSION"), pasta = %pasta.display(), "Fierium aberto");

    let resultado = tauri::Builder::default()
        .manage(protocolo::Arquivos::default())
        .register_asynchronous_uri_scheme_protocol("fierium", |ctx, pedido, responder| {
            use tauri::Manager;
            let arquivos = ctx.app_handle().state::<protocolo::Arquivos>();
            let range = pedido
                .headers()
                .get("range")
                .and_then(|v| v.to_str().ok())
                .map(str::to_owned);
            let r = protocolo::responder(&arquivos, pedido.uri().path(), range.as_deref());
            let mut b = tauri::http::Response::builder().status(r.status);
            for (k, v) in r.cabecalhos {
                b = b.header(k, v);
            }
            responder.respond(b.body(r.corpo).expect("resposta do protocolo"));
        })
        .invoke_handler(tauri::generate_handler![chamar])
        .run(tauri::generate_context!());
    if let Err(e) = resultado {
        tracing::error!("o Fierium não abriu: {e}");
        eprintln!("Fierium: não consegui abrir a janela: {e}");
        std::process::exit(1);
    }
}
