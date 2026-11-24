//! Metadados de dentro do PDF (só o dicionário Info, sem carregar o arquivo todo).
use super::epub::ano_de;
use super::nome::pessoas_de;
use super::*;

// ---------- PDF ----------

pub fn ler_pdf(caminho: &Path) -> Result<Metadados, ErroFierium> {
    let tam = std::fs::metadata(caminho)
        .map_err(|e| ErroFierium::de_io(caminho.display(), e))?
        .len();
    if tam > PDF_MAX {
        return Ok(Metadados::default());
    }
    let p = lopdf::Document::load_metadata(caminho).map_err(|e| ilegivel(caminho, &format!("PDF ilegível: {e}")))?;
    let mut m = Metadados {
        titulo: p.title.unwrap_or_default().trim().to_string(),
        paginas: (p.page_count > 0).then_some(p.page_count),
        ano: p
            .creation_date
            .as_deref()
            .and_then(|d| ano_de(d.trim_start_matches("D:"))),
        ..Default::default()
    };
    if let Some(a) = p.author.filter(|a| !a.trim().is_empty()) {
        m.criadores = pessoas_de(&a);
    }
    if let Some(s) = p.keywords.filter(|s| !s.trim().is_empty()) {
        m.assuntos = s
            .split([',', ';'])
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .collect();
    }
    Ok(m)
}
