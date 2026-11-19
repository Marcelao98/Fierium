//! Conector do Project Gutenberg: o catálogo oficial em CSV (`pg_catalog.csv`, um arquivo só, atualizado por eles toda
//! semana). Nada de varrer o site: baixa o CSV (com cache de um dia), importa e pronto.
use crate::{normalizar, Baixador, Fonte, ItemNovo, Oferta, Pessoa};
use fierium_core::ErroFierium;
use std::path::Path;
use std::time::{Duration, SystemTime};

/// O catálogo oficial, compactado (5 MB em vez de 21). O site é o primeiro; o espelho oficial (PGLAF, a fundação do
/// próprio Gutenberg) é o segundo: quando o site entra em manutenção (erro 503), o espelho continua no ar.
pub const URLS_CATALOGO: [&str; 2] = [
    "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz",
    "https://gutenberg.pglaf.org/cache/epub/feeds/pg_catalog.csv.gz",
];
const SITE: &str = "https://www.gutenberg.org/";
const ESPELHO: &str = "https://gutenberg.pglaf.org/";
pub const LICENCA: &str = "Domínio público (EUA) — Project Gutenberg";
const CACHE_VALE: Duration = Duration::from_secs(24 * 3600);

pub struct Gutenberg {
    /// onde buscar o catálogo, na ordem (o primeiro que responder vale)
    pub urls_catalogo: Vec<String>,
}

impl Default for Gutenberg {
    fn default() -> Self {
        Self {
            urls_catalogo: URLS_CATALOGO.iter().map(|u| u.to_string()).collect(),
        }
    }
}

/// O endereço de download do EPUB. A política de robôs do Gutenberg diz que o site é só pra gente e que programa
/// usa os espelhos; por isso a oferta aponta pro espelho oficial, no arquivo gerado em `cache/epub`.
pub fn url_do_epub(n: &str) -> String {
    format!("{ESPELHO}cache/epub/{n}/pg{n}-images-3.epub")
}

/// A capa média do livro no espelho oficial (nem todo livro tem; a Open Library cobre o resto).
pub fn url_da_capa(n: &str) -> String {
    format!("{ESPELHO}cache/epub/{n}/pg{n}.cover.medium.jpg")
}

/// Os endereços a tentar pra um EPUB do Gutenberg, na ordem: o da oferta, o mesmo arquivo no outro servidor e os
/// formatos mais antigos (nem todo livro tem EPUB 3). Pra endereço de outra fonte, só ele mesmo.
pub fn alternativas_do_epub(url: &str) -> Vec<String> {
    let caminho = url.strip_prefix(ESPELHO).or_else(|| url.strip_prefix(SITE));
    let Some(base) = caminho.and_then(|c| c.strip_suffix("-images-3.epub")) else {
        return vec![url.to_string()];
    };
    let mut v = Vec::new();
    for fim in ["-images-3.epub", "-images.epub", ".epub"] {
        for servidor in [ESPELHO, SITE] {
            v.push(format!("{servidor}{base}{fim}"));
        }
    }
    v
}

/// "Assis, Machado de, 1839-1908" vira "Machado de Assis"; "Machado de Assis, 1839-1908" fica como está.
/// Devolve (nome, papel). Aceita o papel entre colchetes ("[Translator]").
pub fn autor_legivel(bruto: &str) -> Option<Pessoa> {
    let mut s = bruto.trim().to_string();
    let mut papel = "autor";
    if let Some(i) = s.find('[') {
        let rotulo = s[i..].to_lowercase();
        papel = if rotulo.contains("translator") {
            "tradutor"
        } else if rotulo.contains("illustrator") {
            "ilustrador"
        } else if rotulo.contains("editor") || rotulo.contains("compiler") {
            "organizador"
        } else {
            "autor"
        };
        s.truncate(i);
    }
    // "Wells, H. G. (Herbert George)" → "Wells, H. G."
    while let (Some(a), Some(f)) = (s.find('('), s.find(')')) {
        if f < a {
            break;
        }
        s.replace_range(a..=f, "");
    }
    // tira as datas e outros pedaços com número ("1839-1908", "d. 1900", "ca. 1700")
    let partes: Vec<&str> = s
        .split(',')
        .map(str::trim)
        .filter(|p| !p.is_empty() && !p.chars().any(|c| c.is_ascii_digit()) && !p.starts_with('?'))
        .collect();
    let nome = match partes.as_slice() {
        [] => return None,
        [so] => so.to_string(),
        [sobrenome, nome, resto @ ..] => {
            // "Taunay, Alfredo d'Escragnolle Taunay, Visconde de": o nome já traz o sobrenome; o título fica de fora
            let base = if normalizar(nome).contains(&normalizar(sobrenome)) {
                nome.to_string()
            } else {
                format!("{nome} {sobrenome}")
            };
            match resto.iter().find(|r| matches!(**r, "Jr." | "Sr." | "Jr" | "Sr")) {
                Some(sufixo) => format!("{base} {sufixo}"),
                None => base,
            }
        }
    };
    Some(Pessoa {
        nome: nome.split_whitespace().collect::<Vec<_>>().join(" "),
        papel: papel.into(),
    })
}

/// Lê o CSV do catálogo (só linhas do tipo Text).
pub fn ler_csv(leitor: impl std::io::Read) -> Result<Vec<ItemNovo>, ErroFierium> {
    let mut csv = csv::ReaderBuilder::new().flexible(true).from_reader(leitor);
    let erro = |e: csv::Error| ErroFierium::Rede(format!("o catálogo do Gutenberg veio ilegível: {e}"));
    let cab = csv.headers().map_err(erro)?.clone();
    let col = |nome: &str| cab.iter().position(|c| c.trim_start_matches('\u{feff}') == nome);
    let (Some(c_id), Some(c_tipo), Some(c_tit)) = (col("Text#"), col("Type"), col("Title")) else {
        return Err(ErroFierium::Rede(
            "o catálogo do Gutenberg veio num formato que o Fierium não conhece (faltam colunas)".into(),
        ));
    };
    let (c_idi, c_aut, c_ass, c_loc) = (col("Language"), col("Authors"), col("Subjects"), col("LoCC"));
    let c_est = col("Bookshelves");
    let mut itens = Vec::new();
    for linha in csv.records() {
        let l = linha.map_err(erro)?;
        let pega = |c: Option<usize>| c.and_then(|i| l.get(i)).unwrap_or("").trim();
        if pega(Some(c_tipo)) != "Text" {
            continue;
        }
        let id = pega(Some(c_id));
        let titulo = pega(Some(c_tit)).replace("\r\n", ": ").replace(['\n', '\r'], ": ");
        if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit()) || titulo.is_empty() {
            continue;
        }
        let idioma = pega(c_idi).split(';').next().unwrap_or("").trim().to_lowercase();
        let pessoas = pega(c_aut).split(';').filter_map(autor_legivel).collect();
        let mut assuntos: Vec<String> = pega(c_ass)
            .split(';')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        // as estantes do Gutenberg ("Category: Poetry", "Fantasy"): é por elas que o Descobrir monta as coleções
        for est in pega(c_est).split(';').map(str::trim).filter(|s| !s.is_empty()) {
            let est = est.strip_prefix("Category:").map(str::trim).unwrap_or(est);
            if !assuntos.iter().any(|a| a.eq_ignore_ascii_case(est)) {
                assuntos.push(est.to_string());
            }
        }
        for loc in pega(c_loc).split(';').map(str::trim).filter(|s| !s.is_empty()) {
            assuntos.push(format!("LoCC: {loc}"));
        }
        itens.push(ItemNovo {
            id: id.into(),
            tipo: "livro".into(),
            titulo,
            idioma: if idioma.is_empty() { "en".into() } else { idioma },
            ano: None,
            sinopse: None,
            serie: None,
            capa: None,
            pessoas,
            assuntos,
            identificadores: vec![("gutenberg".into(), id.into())],
            ofertas: vec![Oferta {
                fonte: "gutenberg".into(),
                formato: "epub".into(),
                url: url_do_epub(id),
                licenca: LICENCA.into(),
                tamanho: None,
            }],
        });
    }
    Ok(itens)
}

impl Fonte for Gutenberg {
    fn id(&self) -> &'static str {
        "gutenberg"
    }
    fn nome(&self) -> &'static str {
        "Project Gutenberg"
    }
    fn carregar(
        &self,
        baixador: &dyn Baixador,
        cache: &Path,
        aviso: &mut dyn FnMut(u64, Option<u64>),
    ) -> Result<Vec<ItemNovo>, ErroFierium> {
        std::fs::create_dir_all(cache).map_err(|e| ErroFierium::de_io(cache.display(), e))?;
        let arq = cache.join("pg_catalog.csv.gz");
        let fresco = std::fs::metadata(&arq)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| SystemTime::now().duration_since(t).ok())
            .is_some_and(|idade| idade < CACHE_VALE);
        if !fresco {
            let mut falhas: Vec<String> = Vec::new();
            for url in &self.urls_catalogo {
                match baixador.baixar_avisando(url, &arq, aviso) {
                    Ok(bytes) => {
                        tracing::info!(url, bytes, "catálogo do Gutenberg baixado");
                        falhas.clear();
                        break;
                    }
                    Err(e) => {
                        tracing::warn!(url, "catálogo do Gutenberg: {e}");
                        falhas.push(e.to_string());
                    }
                }
            }
            // nenhum servidor respondeu: a cópia velha (se existe) ainda serve; sem ela, o erro sobe
            if !falhas.is_empty() && !arq.exists() {
                return Err(ErroFierium::Rede(format!(
                    "O catálogo do Project Gutenberg não baixou, nem do site nem do espelho. {}",
                    falhas.join(" · ")
                )));
            }
        }
        let r = abrir_csv(&arq).and_then(ler_csv);
        if r.is_err() {
            // arquivo estragado não fica no cache: a próxima tentativa baixa de novo
            if let Err(e) = std::fs::remove_file(&arq) {
                tracing::warn!("não apaguei o catálogo estragado do cache: {e}");
            }
        }
        r
    }
}

/// Abre o catálogo do cache, compactado (gzip) ou não.
fn abrir_csv(arq: &Path) -> Result<Box<dyn std::io::Read>, ErroFierium> {
    use std::io::{Read, Seek};
    let mut f = std::fs::File::open(arq).map_err(|e| ErroFierium::de_io(arq.display(), e))?;
    let mut magica = [0u8; 2];
    let n = f.read(&mut magica).map_err(|e| ErroFierium::de_io(arq.display(), e))?;
    f.rewind().map_err(|e| ErroFierium::de_io(arq.display(), e))?;
    let f = std::io::BufReader::new(f);
    Ok(if n == 2 && magica == [0x1f, 0x8b] {
        Box::new(flate2::read::GzDecoder::new(f))
    } else {
        Box::new(f)
    })
}
