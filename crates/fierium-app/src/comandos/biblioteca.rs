//! A biblioteca: obras, edições (juntar/separar/editar), sugestões de metadados, pastas e varredura.
use super::leitura::Edicao;
use super::{args, Contexto, PorId};
use fierium_core::ErroFierium;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub(super) const COMANDOS: &[&str] = &[
    "biblioteca.limiar",
    "biblioteca.varrer",
    "obras.listar",
    "obra.obter",
    "obra.atualizar",
    "obra.juntar",
    "obra.editar",
    "obra.sugestoes",
    "obra.aplicarSugestao",
    "edicao.separar",
    "pastas.listar",
    "pastas.adicionar",
    "pastas.remover",
    "pastas.sugestoes",
];

#[derive(Deserialize)]
struct PorCaminho {
    caminho: String,
}

#[derive(Deserialize)]
struct Atualizar {
    id: String,
    favorita: Option<bool>,
    estado: Option<String>,
}

#[derive(Deserialize)]
struct AplicarSugestao {
    id: String,
    #[serde(rename = "sugestaoId")]
    sugestao_id: String,
}

#[derive(Deserialize)]
struct Juntar {
    ids: Vec<String>,
}

pub(super) fn atender(ctx: &Contexto, cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    match cmd {
        "biblioteca.limiar" => ctx.ler()?.limiar(),
        "obras.listar" => ctx.ler()?.obras_listar(&a),
        "obra.obter" => ctx.ler()?.obra_obter(&args::<PorId>(a)?.id),
        "obra.atualizar" => {
            let x: Atualizar = args(a)?;
            ctx.escrever().obra_atualizar(&x.id, x.favorita, x.estado.as_deref())
        }
        "obra.editar" => {
            let r = ctx.escrever().obra_editar(&a)?;
            ctx.registrar_arquivos()?;
            Ok(r)
        }
        "obra.sugestoes" => {
            // o interruptor de rede dos Ajustes (D30): desligado, nada sai do computador
            let permitida = ctx.catalogo_ler()?.rede_permitida()?;
            // a busca na rede leva segundos: roda numa conexão só dela, sem segurar a de escrita das outras telas
            let aux = ctx.escrever().abrir_auxiliar()?;
            aux.obra_sugestoes(&args::<PorId>(a)?.id, permitida)
        }
        "obra.aplicarSugestao" => {
            let x: AplicarSugestao = args(a)?;
            ctx.escrever().obra_aplicar_sugestao(&x.id, &x.sugestao_id)
        }
        "obra.juntar" => ctx.escrever().obra_juntar(&args::<Juntar>(a)?.ids),
        "edicao.separar" => ctx.escrever().edicao_separar(&args::<Edicao>(a)?.edicao_id),
        "pastas.listar" => ctx.ler()?.pastas_listar(),
        "pastas.adicionar" => {
            let r = ctx.escrever().pastas_adicionar(&args::<PorCaminho>(a)?.caminho)?;
            ctx.registrar_arquivos()?;
            Ok(r)
        }
        "pastas.sugestoes" => Ok(json!(sugestoes_de_pastas())),
        "pastas.remover" => {
            let r = ctx.escrever().pastas_remover(&args::<PorCaminho>(a)?.caminho)?;
            ctx.registrar_arquivos()?;
            Ok(r)
        }
        "biblioteca.varrer" => varrer(ctx),
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}

/// A varredura em duas fases: andar nas pastas e ler os arquivos novos numa conexão de LEITURA (pode levar
/// minutos num disco lento) e só então escrever, numa transação curta, na conexão de escrita.
pub(super) fn varrer(ctx: &Contexto) -> Result<Value, ErroFierium> {
    if let Err(e) = ctx.escrever().reprocessar_metadados() {
        tracing::warn!("metadados: reprocesso falhou: {e}");
    }
    let plano = ctx.ler()?.planejar_varredura()?;
    let r = ctx.escrever().aplicar_varredura(plano)?;
    ctx.registrar_arquivos()?;
    Ok(r)
}

/// A pasta Documentos do usuário (Windows: a "known folder" Documentos, mesmo redirecionada pro OneDrive; Linux: a do
/// XDG, que já vem como "Documentos" em português), ou `~/Documentos`/`~/Documents` se o sistema não souber.
pub(super) fn pasta_documentos() -> Option<PathBuf> {
    dirs::document_dir().or_else(|| dirs::home_dir().map(|c| escolher_documentos(&c, Path::is_dir)))
}

/// Sem o sistema dizer, usa `Documentos` se existir, senão `Documents`.
pub(super) fn escolher_documentos(casa: &Path, existe: impl Fn(&Path) -> bool) -> PathBuf {
    let pt = casa.join("Documentos");
    if existe(&pt) {
        pt
    } else {
        casa.join("Documents")
    }
}

/// `<Documentos>/Livros/Fierium`.
pub fn pasta_de_livros_padrao() -> PathBuf {
    livros_em(pasta_documentos().unwrap_or_else(std::env::temp_dir))
}

pub(super) fn livros_em(documentos: PathBuf) -> PathBuf {
    documentos.join("Livros").join("Fierium")
}

/// Pastas comuns de livros que existem no computador (só caminhos que são pastas).
fn sugestoes_de_pastas() -> Vec<String> {
    let mut candidatas: Vec<PathBuf> = vec![];
    if let Some(casa) = dirs::home_dir() {
        for n in ["Livros", "Books", "Calibre Library"] {
            candidatas.push(casa.join(n));
        }
    }
    candidatas.extend(pasta_documentos());
    candidatas.extend(dirs::download_dir());
    let mut vistas = std::collections::HashSet::new();
    candidatas
        .into_iter()
        .filter(|p| p.is_dir() && vistas.insert(p.clone()))
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}
