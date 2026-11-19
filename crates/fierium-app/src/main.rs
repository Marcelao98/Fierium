//! Fierium (Tauri 2): abre a janela com a interface, atende os comandos por `chamar` e entrega arquivos aos pedaços
//! pelo protocolo `fierium://`. Log em arquivo desde o primeiro instante.
#![cfg_attr(all(not(debug_assertions), windows), windows_subsystem = "windows")]

mod comandos;
mod protocolo;

use fierium_core::ErroContrato;
use serde_json::Value;

/// A porta única dos comandos (nomes iguais aos do contrato da interface). Roda fora da linha da janela (`async`):
/// uma varredura grande não trava a interface.
#[tauri::command(async)]
fn chamar(
    ctx: tauri::State<std::sync::Arc<comandos::Contexto>>,
    cmd: String,
    args: Option<Value>,
) -> Result<Value, ErroContrato> {
    comandos::chamar(&ctx, &cmd, args.unwrap_or(Value::Null)).map_err(|e| {
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

    let ctx = match comandos::Contexto::abrir(&pasta) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("a biblioteca não abriu: {e}");
            eprintln!("Fierium: não consegui abrir a biblioteca: {e}");
            std::process::exit(1);
        }
    };

    let ctx = std::sync::Arc::new(ctx);
    // primeira abertura com rede ligada e catálogo vazio: baixa o do Gutenberg em segundo plano
    comandos::atualizar_se_vazio(ctx.clone());

    let resultado = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ctx)
        .register_asynchronous_uri_scheme_protocol("fierium", |ctx, pedido, responder| {
            use tauri::Manager;
            if pedido.method() == tauri::http::Method::OPTIONS {
                let r = protocolo::preflight();
                let mut b = tauri::http::Response::builder().status(r.status);
                for (k, v) in r.cabecalhos {
                    b = b.header(k, v);
                }
                responder.respond(b.body(r.corpo).expect("preflight do protocolo"));
                return;
            }
            let ctx = ctx.app_handle().state::<std::sync::Arc<comandos::Contexto>>();
            let resposta = move |r: protocolo::Resposta| {
                let mut b = tauri::http::Response::builder().status(r.status);
                for (k, v) in r.cabecalhos {
                    b = b.header(k, v);
                }
                responder.respond(b.body(r.corpo).expect("resposta do protocolo"));
            };
            // capa de item do catálogo: pode precisar da rede, então roda numa linha à parte (a janela não espera)
            if let Some(chave) = pedido.uri().path().trim_start_matches('/').strip_prefix("capa/cat-") {
                let (ctx, chave) = (ctx.inner().clone(), chave.to_owned());
                std::thread::spawn(move || {
                    let achada = comandos::capa_do_catalogo(&ctx, &chave);
                    resposta(protocolo::responder_arquivo(achada.as_deref()));
                });
                return;
            }
            let range = pedido
                .headers()
                .get("range")
                .and_then(|v| v.to_str().ok())
                .map(str::to_owned);
            resposta(protocolo::responder(
                &ctx.arquivos,
                pedido.uri().path(),
                range.as_deref(),
            ));
        })
        .invoke_handler(tauri::generate_handler![chamar])
        .run(tauri::generate_context!());
    if let Err(e) = resultado {
        tracing::error!("o Fierium não abriu: {e}");
        eprintln!("Fierium: não consegui abrir a janela: {e}");
        std::process::exit(1);
    }
}
