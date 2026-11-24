//! O catálogo público e a rede (D30): buscar, ver item, fontes, atualizar, baixar e o interruptor de rede.
use super::{args, biblioteca, travar, Contexto, PorId};
use fierium_catalogo::{Fonte, Gutenberg};
use fierium_core::ErroFierium;
use serde::Deserialize;
use serde_json::Value;
use std::path::Path;
use std::sync::atomic::Ordering;

pub(super) const COMANDOS: &[&str] = &[
    "catalogo.buscar",
    "catalogo.item",
    "catalogo.fontes",
    "catalogo.atualizar",
    "catalogo.estado",
    "catalogo.baixar",
    "rede.ler",
    "rede.definir",
];

/// O que a atualização do catálogo está fazendo agora (ou como terminou a última).
#[derive(Default, Clone)]
pub(super) struct Andamento {
    /// "" (nada rodou ainda), "baixando", "importando" ou "erro"
    fase: &'static str,
    bytes: u64,
    total: Option<u64>,
    itens: u64,
    mensagem: Option<String>,
}

#[derive(Deserialize)]
struct PorFonte {
    fonte: String,
}

#[derive(Deserialize)]
struct Baixar {
    id: String,
    oferta: Option<usize>,
}

#[derive(Deserialize)]
struct Rede {
    permitida: bool,
}

pub(super) fn atender(ctx: &Contexto, cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    match cmd {
        "catalogo.buscar" => catalogo_buscar(ctx, &a),
        "catalogo.item" => {
            let mut i = ctx.catalogo_ler()?.item(&args::<PorId>(a)?.id)?;
            marcar_obra(ctx, &mut i);
            marcar_capa(&mut i);
            Ok(i)
        }
        "catalogo.fontes" => ctx.catalogo_ler()?.fontes(),
        "catalogo.atualizar" => catalogo_atualizar(ctx, &args::<PorFonte>(a)?.fonte),
        "catalogo.estado" => catalogo_estado(ctx),
        "catalogo.baixar" => catalogo_baixar(ctx, &args::<Baixar>(a)?),
        "rede.ler" => Ok(serde_json::json!({ "permitida": ctx.catalogo_ler()?.rede_permitida()? })),
        "rede.definir" => {
            let p = args::<Rede>(a)?.permitida;
            ctx.catalogo_escrever().rede_definir(p)?;
            Ok(serde_json::json!({ "permitida": p }))
        }
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}

/// Preenche `obraId` quando a pessoa já tem a obra (mesma chave da biblioteca: título + 1º autor normalizados).
fn marcar_obra(ctx: &Contexto, item: &mut Value) {
    let titulo = item["titulo"].as_str().unwrap_or("").to_string();
    let autor = item["pessoas"]
        .as_array()
        .and_then(|p| p.iter().find(|x| x["papel"] == "autor").or_else(|| p.first()))
        .and_then(|p| p["nome"].as_str())
        .unwrap_or("")
        .to_string();
    let achada = ctx.ler().and_then(|l| l.obra_por_chave(&titulo, &autor));
    match achada {
        Ok(Some(o)) => item["obraId"] = Value::String(o),
        Ok(None) => {}
        Err(e) => tracing::warn!("não consegui ver se a obra já existe: {e}"),
    }
}

/// A capa de um item cinza: o endereço no protocolo (`/capa/cat-<id>`), que busca a imagem na hora em que a tela a
/// pede. Itens que já trazem capa ficam como estão; só o Gutenberg tem esse caminho por enquanto.
fn marcar_capa(item: &mut Value) {
    if item.get("capa").is_some() {
        return;
    }
    let chave = item["id"].as_str().and_then(fierium_catalogo::capas::chave_do_item);
    if let (Some(chave), true) = (chave, item["id"].as_str().is_some_and(|i| i.starts_with("gutenberg:"))) {
        item["capa"] = Value::String(fierium_biblioteca::url_da_capa(&format!("cat-{chave}")));
    }
}

fn catalogo_buscar(ctx: &Contexto, filtro: &Value) -> Result<Value, ErroFierium> {
    let mut r = ctx.catalogo_ler()?.buscar(filtro)?;
    if let Some(itens) = r["itens"].as_array_mut() {
        for i in itens {
            marcar_obra(ctx, i);
            marcar_capa(i);
        }
    }
    Ok(r)
}

/// Baixa o catálogo da fonte (sem segurar nenhum banco durante o download) e importa numa transação. Durante a
/// importação a conexão de escrita fica ocupada, mas a busca da tela segue lendo (WAL).
/// Quem chama já está fora da linha da janela (`spawn_blocking` em `main.rs`).
fn catalogo_atualizar(ctx: &Contexto, fonte: &str) -> Result<Value, ErroFierium> {
    let f: Box<dyn Fonte> = match fonte {
        "gutenberg" => Box::<Gutenberg>::default(),
        outra => return Err(ErroFierium::NaoEncontrado(format!("fonte de catálogo \"{outra}\""))),
    };
    ctx.catalogo_ler()?.exigir_rede("atualizar o catálogo")?;
    if ctx.atualizando.swap(true, Ordering::SeqCst) {
        return Err(ErroFierium::argumento(
            "fonte",
            "o catálogo já está sendo atualizado, espere terminar",
        ));
    }
    let marcar = |m: &dyn Fn(&mut Andamento)| m(&mut travar(&ctx.andamento));
    marcar(&|a| {
        *a = Andamento {
            fase: "baixando",
            ..Andamento::default()
        }
    });
    let comeco = std::time::Instant::now();
    let r: Result<Value, ErroFierium> = (|| {
        let itens = f.carregar(ctx.baixador.as_ref(), &ctx.pasta_de_cache, &mut |bytes, total| {
            marcar(&|a| (a.bytes, a.total) = (bytes, total));
        })?;
        let baixou = comeco.elapsed();
        marcar(&|a| (a.fase, a.itens) = ("importando", 0));
        let r = ctx
            .catalogo_escrever()
            .importar_avisando(f.as_ref(), &itens, &mut |n| marcar(&|a| a.itens = n as u64))?;
        tracing::info!(
            fonte,
            itens = itens.len(),
            baixar_ms = baixou.as_millis() as u64,
            total_ms = comeco.elapsed().as_millis() as u64,
            "catálogo atualizado"
        );
        Ok(r)
    })();
    match &r {
        Ok(_) => marcar(&|a| *a = Andamento::default()),
        Err(e) => marcar(&|a| {
            *a = Andamento {
                fase: "erro",
                mensagem: Some(e.to_string()),
                ..Andamento::default()
            }
        }),
    }
    ctx.atualizando.store(false, Ordering::SeqCst);
    r
}

/// Como está o catálogo: `pronto` (tem livros), `baixando`, `importando`, `erro` (com a mensagem), `sem-rede`
/// (vazio e com a internet desligada nos Ajustes) ou `vazio`. Durante a atualização não toca no banco.
fn catalogo_estado(ctx: &Contexto) -> Result<Value, ErroFierium> {
    let a = travar(&ctx.andamento).clone();
    if a.fase == "baixando" || a.fase == "importando" {
        let mut o = serde_json::json!({ "fase": a.fase, "itens": a.itens, "bytes": a.bytes });
        if let Some(t) = a.total {
            o["total"] = serde_json::json!(t);
        }
        return Ok(o);
    }
    let c = ctx.catalogo_ler()?;
    let itens = c.total_de_itens()?;
    let mut o = serde_json::json!({ "itens": itens });
    o["fase"] = serde_json::json!(if itens > 0 {
        "pronto"
    } else if !c.rede_permitida()? {
        "sem-rede"
    } else if a.fase == "erro" {
        "erro"
    } else {
        "vazio"
    });
    // o erro da última tentativa aparece mesmo com o catálogo antigo no lugar (a tela decide se mostra)
    if let Some(m) = a.mensagem {
        o["mensagem"] = serde_json::json!(m);
    }
    Ok(o)
}

/// Na primeira abertura com rede ligada e catálogo vazio: atualiza o Gutenberg sozinho (em segundo plano).
pub fn atualizar_se_vazio(ctx: std::sync::Arc<Contexto>) {
    let precisa = ctx
        .catalogo_ler()
        .map(|c| c.rede_permitida().unwrap_or(false) && c.total_de_itens().unwrap_or(1) == 0)
        .unwrap_or(false);
    if !precisa {
        return;
    }
    let r = std::thread::Builder::new()
        .name("catalogo-inicial".into())
        .spawn(move || match catalogo_atualizar(&ctx, "gutenberg") {
            Ok(f) => tracing::info!(itens = %f["itens"], "catálogo do Gutenberg baixado na primeira abertura"),
            Err(e) => tracing::warn!(codigo = e.codigo(), "catálogo inicial não veio: {e}"),
        });
    if let Err(e) = r {
        tracing::warn!("não consegui iniciar a atualização do catálogo: {e}");
    }
}

fn catalogo_baixar(ctx: &Contexto, x: &Baixar) -> Result<Value, ErroFierium> {
    let item = {
        let c = ctx.catalogo_ler()?;
        c.exigir_rede("baixar o livro")?;
        c.item(&x.id)?
    };
    let ofertas = item["ofertas"].as_array().cloned().unwrap_or_default();
    let oferta = ofertas.get(x.oferta.unwrap_or(0)).ok_or_else(|| {
        ErroFierium::NaoEncontrado(format!(
            "oferta de download pra {} (esse item não tem onde baixar)",
            x.id
        ))
    })?;
    let url = oferta["url"].as_str().unwrap_or_default();
    let formato = oferta["formato"].as_str().unwrap_or("epub");
    let autor = item["pessoas"]
        .as_array()
        .and_then(|p| p.iter().find(|x| x["papel"] == "autor"))
        .and_then(|p| p["nome"].as_str())
        .unwrap_or("");
    let nome = fierium_catalogo::nome_do_arquivo(autor, item["titulo"].as_str().unwrap_or(""), formato);
    let destino = ctx.pasta_de_livros.join(nome);
    if !destino.exists() {
        // download sem segurar nenhum banco; se um servidor falha, tenta o próximo (espelho, formato mais antigo)
        let mut falha = None;
        for u in fierium_catalogo::gutenberg::alternativas_do_epub(url) {
            match ctx
                .baixador
                .baixar(&u, &destino)
                .and_then(|_| conferir_baixado(&destino, formato))
            {
                Ok(()) => {
                    tracing::info!(url = u, "livro baixado");
                    falha = None;
                    break;
                }
                Err(e) => {
                    tracing::warn!(url = u, "download do livro: {e}");
                    falha.get_or_insert(e);
                }
            }
        }
        if let Some(e) = falha {
            return Err(e);
        }
    }
    std::fs::create_dir_all(&ctx.pasta_de_livros).map_err(|e| ErroFierium::de_io(ctx.pasta_de_livros.display(), e))?;
    ctx.escrever()
        .pastas_adicionar(&ctx.pasta_de_livros.to_string_lossy())?;
    biblioteca::varrer(ctx)?;
    let achado = ctx.ler()?.edicao_do_caminho(&destino)?;
    let (obra, edicao) = achado.ok_or_else(|| {
        ErroFierium::NaoEncontrado(format!(
            "o livro baixado não entrou na biblioteca ({})",
            destino.display()
        ))
    })?;
    Ok(serde_json::json!({ "obraId": obra, "edicaoId": edicao }))
}

/// Um EPUB é um zip: se o servidor mandou outra coisa (uma página de "em manutenção"), o arquivo não fica.
fn conferir_baixado(destino: &Path, formato: &str) -> Result<(), ErroFierium> {
    if formato != "epub" {
        return Ok(());
    }
    use std::io::Read;
    let mut magica = [0u8; 2];
    let ok = std::fs::File::open(destino)
        .and_then(|mut f| f.read_exact(&mut magica))
        .is_ok()
        && &magica == b"PK";
    if ok {
        return Ok(());
    }
    if let Err(e) = std::fs::remove_file(destino) {
        tracing::warn!("não apaguei o download estragado: {e}");
    }
    Err(ErroFierium::Rede(
        "o servidor não mandou um EPUB de verdade (pode estar em manutenção); tente de novo mais tarde".into(),
    ))
}
