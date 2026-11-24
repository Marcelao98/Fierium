//! Capas: a que a pessoa escolhe pra uma edição (`capa.salvar`) e a dos itens do catálogo (servida pelo protocolo).
use super::leitura::Edicao;
use super::{args, travar, Contexto};
use fierium_core::ErroFierium;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;

pub(super) const COMANDOS: &[&str] = &["capa.salvar"];

#[derive(Deserialize)]
struct CapaSalvar {
    #[serde(flatten)]
    edicao: Edicao,
    /// a imagem em base64 (sem o prefixo `data:`)
    imagem: String,
}

pub(super) fn atender(ctx: &Contexto, cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    match cmd {
        "capa.salvar" => {
            let x: CapaSalvar = args(a)?;
            let bytes = base64_decodificar(&x.imagem).ok_or_else(|| ErroFierium::Argumento {
                campo: "imagem".into(),
                motivo: "não é base64 válido".into(),
            })?;
            ctx.escrever().capa_salvar(&x.edicao.edicao_id, &bytes)?;
            ctx.registrar_arquivos()?;
            // devolve a edição com o endereço novo da capa
            Ok(json!({ "capa": fierium_biblioteca::url_da_capa(&x.edicao.edicao_id) }))
        }
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}

/// Base64 padrão (com ou sem `=`), sem dependência nova. `None` se tiver caractere fora do alfabeto.
pub(super) fn base64_decodificar(s: &str) -> Option<Vec<u8>> {
    let mut saida = Vec::with_capacity(s.len() * 3 / 4);
    let (mut acc, mut bits) = (0u32, 0u32);
    for c in s.bytes().filter(|c| !c.is_ascii_whitespace() && *c != b'=') {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' | b'-' => 62,
            b'/' | b'_' => 63,
            _ => return None,
        };
        acc = (acc << 6) | u32::from(v);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            saida.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    Some(saida)
}

/// Entrega o arquivo da capa de um item do catálogo (chave `cat-<id>` do protocolo), buscando na rede se for a
/// primeira vez e a rede estiver ligada. `None` = não há capa (a interface desenha a gerada). Só ids que o catálogo
/// conhece; no máximo 3 buscas ao mesmo tempo. Usa só conexões de leitura: nunca segura a de escrita.
pub fn capa_do_catalogo(ctx: &Contexto, chave: &str) -> Option<PathBuf> {
    let id = fierium_catalogo::capas::id_da_chave(chave)?;
    let pasta = &ctx.pasta_de_capas_catalogo;
    if let Some(p) = fierium_catalogo::capas::capa_em_cache(pasta, &id) {
        return Some(p);
    }
    if fierium_catalogo::capas::sem_capa_lembrada(pasta, &id) {
        return None;
    }
    let (titulo, autor) = {
        let c = ctx.catalogo_ler().ok()?;
        if c.exigir_rede("buscar a capa").is_err() {
            return None;
        }
        let item = c.item(&id).ok()?; // id desconhecido: nada de baixar
        let autor = item["pessoas"]
            .as_array()
            .and_then(|p| p.iter().find(|x| x["papel"] == "autor").or_else(|| p.first()))
            .and_then(|p| p["nome"].as_str())
            .unwrap_or("")
            .to_string();
        (item["titulo"].as_str().unwrap_or("").to_string(), autor)
    };
    let (trava, aviso) = &ctx.vagas_de_capa;
    {
        let mut n = travar(trava);
        while *n >= 3 {
            n = aviso.wait(n).unwrap_or_else(std::sync::PoisonError::into_inner);
        }
        *n += 1;
    }
    let r = fierium_catalogo::capas::obter(ctx.baixador.as_ref(), pasta, &id, &titulo, &autor);
    *travar(trava) -= 1;
    aviso.notify_one();
    match r {
        Ok(p) => p,
        Err(e) => {
            tracing::debug!(id, "capa do catálogo: {e}");
            None
        }
    }
}
