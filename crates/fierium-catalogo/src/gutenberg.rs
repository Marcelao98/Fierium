//! Conector do Project Gutenberg: o catálogo oficial em CSV (`pg_catalog.csv`, um arquivo só, atualizado por eles toda
//! semana). Nada de varrer o site: baixa o CSV (com cache de um dia), importa e pronto.
use crate::{Baixador, Fonte, ItemNovo, Oferta, Pessoa};
use fierium_core::ErroFierium;
use std::path::Path;
use std::time::{Duration, SystemTime};

pub const URL_CATALOGO: &str = "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv";
pub const LICENCA: &str = "Domínio público (EUA) — Project Gutenberg";
const CACHE_VALE: Duration = Duration::from_secs(24 * 3600);

pub struct Gutenberg {
    pub url_catalogo: String,
}

impl Default for Gutenberg {
    fn default() -> Self {
        Self {
            url_catalogo: URL_CATALOGO.into(),
        }
    }
}

/// O endereço de download automático recomendado pelo Gutenberg pros robôs: o arquivo gerado em `cache/epub`
/// (as páginas `/ebooks/<n>.epub…` são pra gente e redirecionam; robô não deve usá-las).
pub fn url_do_epub(n: &str) -> String {
    format!("https://www.gutenberg.org/cache/epub/{n}/pg{n}-images-3.epub")
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
    // tira as datas e outros pedaços com número ("1839-1908", "d. 1900", "ca. 1700")
    let partes: Vec<&str> = s
        .split(',')
        .map(str::trim)
        .filter(|p| !p.is_empty() && !p.chars().any(|c| c.is_ascii_digit()) && !p.starts_with('?'))
        .collect();
    let nome = match partes.as_slice() {
        [] => return None,
        [so] => so.to_string(),
        [sobrenome, resto @ ..] => format!("{} {}", resto.join(" "), sobrenome),
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
    fn carregar(&self, baixador: &dyn Baixador, cache: &Path) -> Result<Vec<ItemNovo>, ErroFierium> {
        std::fs::create_dir_all(cache).map_err(|e| ErroFierium::de_io(cache.display(), e))?;
        let arq = cache.join("pg_catalog.csv");
        let fresco = std::fs::metadata(&arq)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| SystemTime::now().duration_since(t).ok())
            .is_some_and(|idade| idade < CACHE_VALE);
        if !fresco {
            baixador.baixar(&self.url_catalogo, &arq)?;
        }
        let f = std::fs::File::open(&arq).map_err(|e| ErroFierium::de_io(arq.display(), e))?;
        ler_csv(std::io::BufReader::new(f))
    }
}
