//! Metadados de dentro do arquivo (EPUB: container.xml → OPF; PDF: dicionário Info), do nome do arquivo e a mistura
//! dos dois (o de dentro vence; o nome só completa). Capa de EPUB extraída pra pasta de cache.
use fierium_core::ErroFierium;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::Path;

/// PDF maior que isto não é lido por dentro (a leitura carrega o arquivo): fica só o nome.
const PDF_MAX: u64 = 64 * 1024 * 1024;
const CAPA_MAX: u64 = 15 * 1024 * 1024;
const XML_MAX: u64 = 4 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Pessoa {
    pub nome: String,
    pub papel: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Serie {
    pub nome: String,
    pub volume: f64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Metadados {
    pub titulo: String,
    pub criadores: Vec<Pessoa>,
    pub ano: Option<i32>,
    pub idioma: String,
    pub assuntos: Vec<String>,
    pub serie: Option<Serie>,
    pub isbn: String,
    pub paginas: Option<u32>,
}

/// Uma capa achada dentro do arquivo.
pub struct Capa {
    pub bytes: Vec<u8>,
    pub ext: &'static str,
}

fn ilegivel(caminho: &Path, motivo: &str) -> ErroFierium {
    ErroFierium::Arquivo {
        caminho: format!("{} (ARQUIVO_ILEGIVEL)", caminho.display()),
        fonte: std::io::Error::new(std::io::ErrorKind::InvalidData, motivo.to_string()),
    }
}

// ---------- lixo ----------

/// Título que é claramente lixo de programa: "Untitled", "Microsoft Word - x", só números, nome de arquivo.
pub fn titulo_lixo(t: &str) -> bool {
    let t = t.trim();
    let n = super::normalizar(t);
    if n.is_empty() || !t.chars().any(char::is_alphabetic) {
        return true;
    }
    const FIXOS: &[&str] = &[
        "untitled",
        "unknown",
        "title",
        "document",
        "documento",
        "novo documento",
        "sem titulo",
        "null",
        "none",
    ];
    if FIXOS.contains(&n.as_str()) || n.starts_with("untitled") || n.starts_with("microsoft ") {
        return true;
    }
    [
        ".doc", ".docx", ".pdf", ".indd", ".tex", ".odt", ".qxd", ".epub", ".rtf", ".txt",
    ]
    .iter()
    .any(|e| n.ends_with(e))
}

fn autor_lixo(a: &str) -> bool {
    let n = super::normalizar(a);
    let n = n.trim();
    n.is_empty()
        || !n.chars().any(char::is_alphabetic)
        || [
            "unknown",
            "admin",
            "administrator",
            "user",
            "author",
            "autor",
            "desconhecido",
            "null",
        ]
        .contains(&n)
}

// ---------- nome do arquivo ----------

const PARTICULAS: &[&str] = &[
    "de", "da", "do", "dos", "das", "van", "von", "di", "del", "la", "le", "y", "e", "of", "bin",
];
const ARTIGOS_INICIAIS: &[&str] = &[
    "o", "a", "os", "as", "um", "uma", "the", "an", "el", "la", "los", "las", "guia", "livro", "manual",
];

fn sem_pontuacao(s: &str) -> bool {
    !s.chars().any(|c| c.is_ascii_digit() || "!?:;()[]#/\\@".contains(c))
}

fn com_virgula_de_pessoa(s: &str) -> bool {
    match s.split_once(',') {
        Some((a, b)) if !b.contains(',') => {
            let (na, nb) = (a.split_whitespace().count(), b.split_whitespace().count());
            (1..=3).contains(&na) && (1..=3).contains(&nb) && sem_pontuacao(s)
        }
        _ => false,
    }
}

fn parece_pessoa(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() || !sem_pontuacao(&s.replace(',', "")) {
        return false;
    }
    if s.contains(',') {
        return com_virgula_de_pessoa(s);
    }
    let palavras: Vec<&str> = s.split_whitespace().collect();
    if !(2..=4).contains(&palavras.len()) || ARTIGOS_INICIAIS.contains(&super::normalizar(palavras[0]).as_str()) {
        return false;
    }
    palavras.iter().all(|p| {
        let c = p.chars().next().unwrap_or('a');
        c.is_uppercase() || PARTICULAS.contains(&super::normalizar(p).as_str())
    })
}

/// "Pratchett, Terry" → "Terry Pratchett"; o resto fica como está.
pub fn nome_natural(s: &str) -> String {
    let s = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if com_virgula_de_pessoa(&s) {
        if let Some((a, b)) = s.split_once(',') {
            return format!("{} {}", b.trim(), a.trim());
        }
    }
    s
}

fn pessoas_de(s: &str) -> Vec<Pessoa> {
    s.replace(" & ", ";")
        .replace(" and ", ";")
        .split(';')
        .map(nome_natural)
        .filter(|n| !n.is_empty())
        .map(|nome| Pessoa {
            nome,
            papel: "autor".into(),
        })
        .collect()
}

/// "Guards!Guards!" → "Guards! Guards!"
fn espacar_pontuacao(s: &str) -> String {
    let mut o = String::with_capacity(s.len() + 2);
    let mut ant = ' ';
    for c in s.chars() {
        if (ant == '!' || ant == '?') && c.is_uppercase() {
            o.push(' ');
        }
        o.push(c);
        ant = c;
    }
    o
}

fn so_digitos(t: &str, max: usize) -> Option<u32> {
    if t.is_empty() || t.len() > max || !t.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    t.parse().ok()
}

fn eh_ano(t: &str) -> Option<i32> {
    if t.len() != 4 {
        return None;
    }
    so_digitos(t, 4).map(|n| n as i32).filter(|a| (1000..=2100).contains(a))
}

/// Tira "[...]" e "(1899)"; devolve o texto e o ano, se havia.
fn limpar_grupos(s: &str) -> (String, Option<i32>) {
    let mut ano = None;
    let mut saida = String::new();
    let cs: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < cs.len() {
        let fecha = match cs[i] {
            '[' => ']',
            '(' => ')',
            c => {
                saida.push(c);
                i += 1;
                continue;
            }
        };
        match cs[i..].iter().position(|&c| c == fecha).map(|p| p + i) {
            Some(f) => {
                let dentro: String = cs[i + 1..f].iter().collect();
                if let Some(a) = eh_ano(dentro.trim()) {
                    ano = ano.or(Some(a));
                } else if fecha == ')' {
                    saida.extend(&cs[i..=f]);
                }
                i = f + 1;
            }
            None => {
                saida.push(cs[i]);
                i += 1;
            }
        }
    }
    (saida, ano)
}

/// Acha "vol. 12", "v12", "tomo 3", "#05", "livro 2" nas palavras; devolve (antes, número, depois).
fn marcador_de_volume(palavras: &[String]) -> Option<(Vec<String>, u32, Vec<String>)> {
    const MARCAS: &[&str] = &["vol", "v", "tomo", "volume", "livro", "book"];
    for (i, p) in palavras.iter().enumerate() {
        let n = super::normalizar(p);
        let n = n.trim_end_matches('.');
        let junto = MARCAS
            .iter()
            .find_map(|m| n.strip_prefix(m).and_then(|r| so_digitos(r.trim_start_matches('.'), 3)))
            .or_else(|| n.strip_prefix('#').and_then(|r| so_digitos(r, 3)));
        if let Some(v) = junto {
            return Some((palavras[..i].to_vec(), v, palavras[i + 1..].to_vec()));
        }
        if n == "#" || MARCAS.contains(&n) {
            if let Some(v) = palavras.get(i + 1).and_then(|x| so_digitos(x, 3)) {
                return Some((palavras[..i].to_vec(), v, palavras[i + 2..].to_vec()));
            }
        }
    }
    None
}

struct Parte {
    titulo: String,
    serie: Option<Serie>,
    ano: Option<i32>,
}

/// Uma parte que pode ser título: trata "Série.08.Título.198", "Série vol. 2" e pontos como espaço.
fn parte_de_titulo(p: &str) -> Parte {
    let p = p.trim();
    if !p.contains(' ') && p.matches('.').count() >= 2 {
        let toks: Vec<&str> = p.split('.').filter(|t| !t.is_empty()).collect();
        if let Some(i) = toks.iter().position(|t| so_digitos(t, 3).is_some()) {
            if i > 0 && i + 1 < toks.len() {
                let mut ano = None;
                let mut resto: Vec<&str> = toks[i + 1..].to_vec();
                while resto.len() > 1 && resto.last().is_some_and(|u| so_digitos(u, 4).is_some()) {
                    ano = ano.or(resto.last().and_then(|u| eh_ano(u)));
                    resto.pop();
                }
                return Parte {
                    titulo: espacar_pontuacao(&resto.join(" ")),
                    serie: Some(Serie {
                        nome: toks[..i].join(" "),
                        volume: so_digitos(toks[i], 3).unwrap_or(0) as f64,
                    }),
                    ano,
                };
            }
        }
    }
    let ps: Vec<String> = p.replace('.', " ").split_whitespace().map(String::from).collect();
    if let Some((antes, v, depois)) = marcador_de_volume(&ps) {
        let serie_nome = antes.join(" ");
        if !serie_nome.is_empty() {
            let titulo = if depois.is_empty() {
                format!("{serie_nome} {v}")
            } else {
                depois.join(" ")
            };
            return Parte {
                titulo: espacar_pontuacao(&titulo),
                serie: Some(Serie {
                    nome: serie_nome,
                    volume: v as f64,
                }),
                ano: None,
            };
        }
    }
    Parte {
        titulo: espacar_pontuacao(&ps.join(" ")),
        serie: None,
        ano: None,
    }
}

/// O que dá pra deduzir do nome do arquivo.
pub fn pelo_nome(nome_arquivo: &str) -> Metadados {
    let sem_ext = match nome_arquivo.rsplit_once('.') {
        Some((a, e)) if !a.is_empty() && e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()) => a,
        _ => nome_arquivo,
    };
    let (limpo, ano_grupo) = limpar_grupos(&sem_ext.replace('_', " "));
    let mut limpo = limpo.split_whitespace().collect::<Vec<_>>().join(" ");
    if !limpo.contains(' ') && limpo.contains('-') {
        // "shelley-frankenstein": nome em fatias
        limpo = limpo.replace('-', " ");
    }
    let partes: Vec<String> = limpo
        .split(" - ")
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect();
    let (autor, titulo_partes): (Option<String>, Vec<String>) = match partes.len() {
        0 => (None, vec![]),
        1 => (None, partes),
        2 => {
            let (a, b) = (&partes[0], &partes[1]);
            let particula = |s: &str| {
                s.split_whitespace()
                    .any(|p| PARTICULAS.contains(&super::normalizar(p).as_str()))
            };
            if com_virgula_de_pessoa(a) || (parece_pessoa(a) && !(parece_pessoa(b) && particula(b) && !particula(a))) {
                (Some(a.clone()), vec![b.clone()])
            } else if parece_pessoa(b) && (!sem_pontuacao(a) || a.split_whitespace().count() != 1) {
                (Some(b.clone()), vec![a.clone()])
            } else if a.split_whitespace().count() <= 2 && sem_pontuacao(a) {
                (Some(a.clone()), vec![b.clone()])
            } else {
                (None, vec![partes.join(" - ")])
            }
        }
        _ => {
            if parece_pessoa(&partes[0]) {
                (Some(partes[0].clone()), partes[1..].to_vec())
            } else if parece_pessoa(&partes[partes.len() - 1]) {
                (
                    Some(partes[partes.len() - 1].clone()),
                    partes[..partes.len() - 1].to_vec(),
                )
            } else {
                (None, vec![partes.join(" - ")])
            }
        }
    };
    let mut partes_t: Vec<Parte> = titulo_partes.iter().map(|t| parte_de_titulo(t)).collect();
    let mut serie = None;
    let mut ano = ano_grupo;
    for p in &mut partes_t {
        serie = serie.or(p.serie.take());
        ano = ano.or(p.ano);
    }
    let titulo = partes_t
        .iter()
        .map(|p| p.titulo.clone())
        .collect::<Vec<_>>()
        .join(" - ");
    Metadados {
        titulo,
        criadores: autor.map(|a| pessoas_de(&a)).unwrap_or_default(),
        ano,
        serie,
        ..Default::default()
    }
}

/// O de dentro do arquivo vence; o do nome só completa (e troca título lixo).
pub fn completar(dentro: &Metadados, nome: &Metadados) -> Metadados {
    let mut m = dentro.clone();
    if titulo_lixo(&m.titulo) {
        m.titulo = nome.titulo.clone();
    }
    m.criadores.retain(|p| !autor_lixo(&p.nome));
    if m.criadores.is_empty() {
        m.criadores = nome.criadores.clone();
    }
    m.ano = m.ano.or(nome.ano);
    if m.serie.is_none() {
        m.serie = nome.serie.clone();
    }
    m
}

// ---------- EPUB ----------

#[derive(Debug)]
struct Tag {
    nome: String,
    attrs: Vec<(String, String)>,
    texto: String,
}

impl Tag {
    fn attr(&self, n: &str) -> Option<&str> {
        self.attrs.iter().find(|(k, _)| k == n).map(|(_, v)| v.as_str())
    }
}

fn entidades(s: &str) -> String {
    let mut o = String::with_capacity(s.len());
    let mut resto = s;
    while let Some(i) = resto.find('&') {
        o.push_str(&resto[..i]);
        let r = &resto[i + 1..];
        match r.find(';').filter(|&f| f <= 10) {
            Some(f) => {
                let e = &r[..f];
                let c = match e {
                    "amp" => Some('&'),
                    "lt" => Some('<'),
                    "gt" => Some('>'),
                    "quot" => Some('"'),
                    "apos" => Some('\''),
                    _ => e
                        .strip_prefix("#x")
                        .and_then(|h| u32::from_str_radix(h, 16).ok())
                        .or_else(|| e.strip_prefix('#').and_then(|d| d.parse().ok()))
                        .and_then(char::from_u32),
                };
                match c {
                    Some(c) => o.push(c),
                    None => o.push_str(&resto[i..i + f + 2]),
                }
                resto = &r[f + 1..];
            }
            None => {
                o.push('&');
                resto = r;
            }
        }
    }
    o.push_str(resto);
    o
}

/// Um leitor de XML mínimo: cada tag de abertura com atributos e o texto que vem logo depois.
fn tags_do_xml(xml: &str) -> Vec<Tag> {
    let mut v = Vec::new();
    let mut resto = xml;
    while let Some(i) = resto.find('<') {
        let r = &resto[i + 1..];
        if let Some(c) = r.strip_prefix("!--") {
            resto = c.find("-->").map_or("", |e| &c[e + 3..]);
            continue;
        }
        let Some(f) = r.find('>') else { break };
        let corpo = &r[..f];
        resto = &r[f + 1..];
        if corpo.starts_with(['/', '?', '!']) {
            continue;
        }
        let corpo = corpo.trim_end_matches('/');
        let mut it = corpo.splitn(2, char::is_whitespace);
        let nome = it.next().unwrap_or("");
        let nome = nome.rsplit(':').next().unwrap_or(nome).to_string();
        let mut attrs = Vec::new();
        let mut a = it.next().unwrap_or("");
        while let Some(eq) = a.find('=') {
            let chave = a[..eq].trim();
            let chave = chave.rsplit(':').next().unwrap_or(chave).to_string();
            let r = a[eq + 1..].trim_start();
            let Some(asp) = r.chars().next().filter(|c| *c == '"' || *c == '\'') else {
                break;
            };
            let Some(fim) = r[1..].find(asp) else { break };
            attrs.push((chave, entidades(&r[1..1 + fim])));
            a = &r[fim + 2..];
        }
        let texto_fim = resto.find('<').unwrap_or(resto.len());
        let texto = entidades(resto[..texto_fim].trim());
        v.push(Tag { nome, attrs, texto });
    }
    v
}

fn ler_texto_do_zip<R: Read + std::io::Seek>(z: &mut zip::ZipArchive<R>, nome: &str) -> Option<String> {
    let f = z.by_name(nome).ok()?;
    let mut s = String::new();
    f.take(XML_MAX).read_to_string(&mut s).ok()?;
    Some(s)
}

fn ler_bytes_do_zip<R: Read + std::io::Seek>(z: &mut zip::ZipArchive<R>, nome: &str) -> Option<Vec<u8>> {
    let f = z.by_name(nome).ok()?;
    let mut b = Vec::new();
    f.take(CAPA_MAX).read_to_end(&mut b).ok()?;
    Some(b)
}

fn descodificar_href(h: &str) -> String {
    let h = h.split('#').next().unwrap_or(h);
    let b = h.as_bytes();
    let mut o = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Some(x) = h.get(i + 1..i + 3).and_then(|x| u8::from_str_radix(x, 16).ok()) {
                o.push(x);
                i += 3;
                continue;
            }
        }
        o.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&o).into_owned()
}

fn juntar_caminho(base_dir: &str, href: &str) -> String {
    let mut partes: Vec<&str> = base_dir.split('/').filter(|p| !p.is_empty()).collect();
    for p in href.split('/') {
        match p {
            "" | "." => {}
            ".." => {
                partes.pop();
            }
            x => partes.push(x),
        }
    }
    partes.join("/")
}

fn ext_da_imagem(tipo: &str, href: &str) -> Option<&'static str> {
    match tipo {
        "image/jpeg" | "image/jpg" => return Some("jpg"),
        "image/png" => return Some("png"),
        "image/gif" => return Some("gif"),
        "image/webp" => return Some("webp"),
        _ => {}
    }
    match href.rsplit_once('.')?.1.to_lowercase().as_str() {
        "jpg" | "jpeg" => Some("jpg"),
        "png" => Some("png"),
        "gif" => Some("gif"),
        "webp" => Some("webp"),
        _ => None,
    }
}

fn so_isbn(s: &str) -> Option<String> {
    let t: String = s
        .to_lowercase()
        .replace("urn:isbn:", "")
        .replace("isbn:", "")
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == 'x')
        .collect();
    (t.len() == 13 || t.len() == 10).then(|| t.to_uppercase())
}

fn papel_marc(p: &str) -> &'static str {
    match p.trim().to_lowercase().as_str() {
        "trl" | "translator" | "tradutor" => "tradutor",
        "ill" | "illustrator" | "ilustrador" => "ilustrador",
        "nrt" | "narrator" | "narrador" => "narrador",
        "edt" | "editor" | "organizador" | "com" => "organizador",
        _ => "autor",
    }
}

fn ano_de(s: &str) -> Option<i32> {
    s.trim().get(..4).and_then(eh_ano)
}

/// Lê o EPUB (zip, só as partes necessárias): metadados e a capa, se houver.
pub fn ler_epub(caminho: &Path, com_capa: bool) -> Result<(Metadados, Option<Capa>), ErroFierium> {
    let f = std::fs::File::open(caminho).map_err(|e| ErroFierium::de_io(caminho.display(), e))?;
    let mut z = zip::ZipArchive::new(f).map_err(|e| ilegivel(caminho, &format!("zip inválido: {e}")))?;
    let container = ler_texto_do_zip(&mut z, "META-INF/container.xml")
        .ok_or_else(|| ilegivel(caminho, "sem META-INF/container.xml"))?;
    let opf_caminho = tags_do_xml(&container)
        .iter()
        .find(|t| t.nome == "rootfile")
        .and_then(|t| t.attr("full-path").map(descodificar_href))
        .ok_or_else(|| ilegivel(caminho, "container.xml sem rootfile"))?;
    let opf = ler_texto_do_zip(&mut z, &opf_caminho).ok_or_else(|| ilegivel(caminho, "OPF não encontrado"))?;
    let tags = tags_do_xml(&opf);
    let mut m = Metadados::default();
    let mut criadores: Vec<(Option<String>, Pessoa)> = Vec::new();
    let (mut serie_nome, mut serie_idx) = (None::<String>, None::<f64>);
    let mut colecao: Option<(Option<String>, String)> = None;
    for t in &tags {
        match t.nome.as_str() {
            "title" if m.titulo.is_empty() && !t.texto.is_empty() => m.titulo = t.texto.clone(),
            "creator" | "contributor" if !t.texto.is_empty() => {
                let papel = if t.nome == "contributor" && t.attr("role").is_none() {
                    "organizador"
                } else {
                    papel_marc(t.attr("role").unwrap_or("aut"))
                };
                criadores.push((
                    t.attr("id").map(String::from),
                    Pessoa {
                        nome: nome_natural(&t.texto),
                        papel: papel.into(),
                    },
                ));
            }
            "date" if m.ano.is_none() => m.ano = ano_de(&t.texto),
            "language" if m.idioma.is_empty() => m.idioma = t.texto.clone(),
            "subject" if !t.texto.is_empty() => m.assuntos.push(t.texto.clone()),
            "identifier" if m.isbn.is_empty() => m.isbn = so_isbn(&t.texto).unwrap_or_default(),
            "meta" => {
                match (t.attr("name"), t.attr("content")) {
                    (Some("calibre:series"), Some(c)) => serie_nome = Some(c.to_string()),
                    (Some("calibre:series_index"), Some(c)) => serie_idx = c.trim().parse().ok(),
                    _ => {}
                }
                if t.attr("property") == Some("belongs-to-collection") && colecao.is_none() {
                    colecao = Some((t.attr("id").map(String::from), t.texto.clone()));
                }
            }
            _ => {}
        }
    }
    // refinamentos (EPUB 3): <meta refines="#id" property="role">trl</meta>
    for t in tags.iter().filter(|t| t.nome == "meta") {
        let Some(alvo) = t.attr("refines").and_then(|r| r.strip_prefix('#')) else {
            continue;
        };
        match t.attr("property") {
            Some("role") => {
                for (id, p) in criadores.iter_mut() {
                    if id.as_deref() == Some(alvo) {
                        p.papel = papel_marc(&t.texto).into();
                    }
                }
            }
            Some("group-position") if colecao.as_ref().and_then(|c| c.0.as_deref()) == Some(alvo) => {
                serie_idx = serie_idx.or(t.texto.trim().parse().ok());
            }
            _ => {}
        }
    }
    if serie_nome.is_none() {
        serie_nome = colecao.map(|c| c.1);
    }
    if let Some(n) = serie_nome.filter(|n| !n.trim().is_empty()) {
        m.serie = Some(Serie {
            nome: n.trim().into(),
            volume: serie_idx.unwrap_or(0.0),
        });
    }
    m.criadores = criadores.into_iter().map(|(_, p)| p).collect();
    let capa = if com_capa {
        capa_do_epub(&mut z, &tags, &opf_caminho)
    } else {
        None
    };
    Ok((m, capa))
}

fn capa_do_epub<R: Read + std::io::Seek>(z: &mut zip::ZipArchive<R>, tags: &[Tag], opf: &str) -> Option<Capa> {
    let dir = opf.rsplit_once('/').map_or("", |(d, _)| d);
    let itens: Vec<&Tag> = tags.iter().filter(|t| t.nome == "item").collect();
    let por_prop = itens.iter().find(|t| {
        t.attr("properties")
            .is_some_and(|p| p.split_whitespace().any(|x| x == "cover-image"))
    });
    let por_meta = tags
        .iter()
        .find(|t| t.nome == "meta" && t.attr("name") == Some("cover"))
        .and_then(|m| m.attr("content"))
        .and_then(|id| itens.iter().find(|t| t.attr("id") == Some(id)));
    let primeira = itens
        .iter()
        .find(|t| t.attr("media-type").is_some_and(|m| m.starts_with("image/")));
    let candidatos = [por_prop, por_meta, primeira];
    for t in candidatos.into_iter().flatten() {
        let href = descodificar_href(t.attr("href")?);
        let Some(ext) = ext_da_imagem(t.attr("media-type").unwrap_or(""), &href) else {
            continue;
        };
        if let Some(bytes) = ler_bytes_do_zip(z, &juntar_caminho(dir, &href)) {
            if !bytes.is_empty() {
                return Some(Capa { bytes, ext });
            }
        }
    }
    None
}

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

/// Lê por dentro conforme o formato; erro de leitura não derruba nada: vira metadados vazios (e um aviso no log).
pub fn ler_do_arquivo(caminho: &Path, formato: &str, com_capa: bool) -> (Metadados, Option<Capa>) {
    let r = match formato {
        "epub" => ler_epub(caminho, com_capa),
        "pdf" => ler_pdf(caminho).map(|m| (m, None)),
        _ => return (Metadados::default(), None),
    };
    match r {
        Ok(x) => x,
        Err(e) => {
            tracing::warn!("metadados: não li {}: {e}", caminho.display());
            (Metadados::default(), None)
        }
    }
}

/// Grava a capa em `<pasta>/<impressao>.<ext>` e devolve o caminho.
pub fn gravar_capa(pasta: &Path, impressao: &str, capa: &Capa) -> Option<std::path::PathBuf> {
    std::fs::create_dir_all(pasta).ok()?;
    let p = pasta.join(format!("{impressao}.{}", capa.ext));
    std::fs::write(&p, &capa.bytes).ok()?;
    Some(p)
}

/// `~/.cache/fierium/capas` (Linux), `%LOCALAPPDATA%\Fierium\capas` (Windows).
pub fn pasta_de_capas() -> std::path::PathBuf {
    let var = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
    let base = if cfg!(windows) {
        var("LOCALAPPDATA").map(|l| std::path::PathBuf::from(l).join("Fierium"))
    } else {
        var("XDG_CACHE_HOME")
            .map(|x| std::path::PathBuf::from(x).join("fierium"))
            .or_else(|| var("HOME").map(|h| std::path::PathBuf::from(h).join(".cache/fierium")))
    };
    base.unwrap_or_else(|| std::env::temp_dir().join("fierium"))
        .join("capas")
}

#[cfg(test)]
mod testes {
    use super::*;

    type Nome = (String, String, Option<(String, f64)>, Option<i32>);

    fn nome(n: &str) -> Nome {
        let m = pelo_nome(n);
        (
            m.criadores.first().map(|p| p.nome.clone()).unwrap_or_default(),
            m.titulo,
            m.serie.map(|s| (s.nome, s.volume)),
            m.ano,
        )
    }

    #[test]
    fn discworld() {
        let (a, t, s, _) = nome("Discworld.08.Guards!Guards!.198 - Pratchett, Terry.pdf");
        assert_eq!((a.as_str(), t.as_str()), ("Terry Pratchett", "Guards! Guards!"));
        assert_eq!(s, Some(("Discworld".into(), 8.0)));
    }

    #[test]
    fn tabela_de_nomes() {
        #[allow(clippy::type_complexity)]
        let casos: &[(&str, &str, &str, Option<(&str, f64)>, Option<i32>)] = &[
            (
                "Machado de Assis - Dom_Casmurro (1899).PDF",
                "Machado de Assis",
                "Dom Casmurro",
                None,
                Some(1899),
            ),
            ("o.alienista.epub", "", "o alienista", None, None),
            ("Livro (Edição 2).pdf", "", "Livro (Edição 2)", None, None),
            (
                "Dom Casmurro - Machado de Assis.epub",
                "Machado de Assis",
                "Dom Casmurro",
                None,
                None,
            ),
            (
                "Guards! Guards! - Terry Pratchett.pdf",
                "Terry Pratchett",
                "Guards! Guards!",
                None,
                None,
            ),
            (
                "Pratchett, Terry - Guards! Guards!.pdf",
                "Terry Pratchett",
                "Guards! Guards!",
                None,
                None,
            ),
            (
                "Guards! Guards! - Pratchett, Terry.pdf",
                "Terry Pratchett",
                "Guards! Guards!",
                None,
                None,
            ),
            ("Ana - Um Livro.pdf", "Ana", "Um Livro", None, None),
            ("shelley-frankenstein.epub", "", "shelley frankenstein", None, None),
            ("Frankenstein.pdf", "", "Frankenstein", None, None),
            ("Naruto vol. 12.pdf", "", "Naruto 12", Some(("Naruto", 12.0)), None),
            (
                "Naruto v12 - Masashi Kishimoto.pdf",
                "Masashi Kishimoto",
                "Naruto 12",
                Some(("Naruto", 12.0)),
                None,
            ),
            ("One Piece #05.pdf", "", "One Piece 5", Some(("One Piece", 5.0)), None),
            ("Akira tomo 3.pdf", "", "Akira 3", Some(("Akira", 3.0)), None),
            (
                "Fundação Volume 2 - Isaac Asimov.epub",
                "Isaac Asimov",
                "Fundação 2",
                Some(("Fundação", 2.0)),
                None,
            ),
            (
                "[Z-Library] O Hobbit - J. R. R. Tolkien.epub",
                "J. R. R. Tolkien",
                "O Hobbit",
                None,
                None,
            ),
            ("1984 - George Orwell.pdf", "George Orwell", "1984", None, None),
            (
                "George Orwell - 1984 (1949).pdf",
                "George Orwell",
                "1984",
                None,
                Some(1949),
            ),
            ("A Revolução dos Bichos.pdf", "", "A Revolução dos Bichos", None, None),
            (
                "Neil Gaiman - Sandman - Prelúdios e Noturnos.pdf",
                "Neil Gaiman",
                "Sandman - Prelúdios e Noturnos",
                None,
                None,
            ),
            (
                "Sandman - Prelúdios e Noturnos - Neil Gaiman.pdf",
                "Neil Gaiman",
                "Sandman - Prelúdios e Noturnos",
                None,
                None,
            ),
            (
                "Mary_Shelley_-_Frankenstein.epub",
                "Mary Shelley",
                "Frankenstein",
                None,
                None,
            ),
            (
                "Harry.Potter.01.A.Pedra.Filosofal.pdf",
                "",
                "A Pedra Filosofal",
                Some(("Harry Potter", 1.0)),
                None,
            ),
            ("   Espaços   demais .pdf", "", "Espaços demais", None, None),
            ("sem extensão", "", "sem extensão", None, None),
            (
                "Clarice Lispector - A Hora da Estrela.EPUB",
                "Clarice Lispector",
                "A Hora da Estrela",
                None,
                None,
            ),
            ("Isaac Asimov - Eu, Robô.pdf", "Isaac Asimov", "Eu, Robô", None, None),
            ("Berserk 03.pdf", "", "Berserk 03", None, None),
        ];
        for (arq, a, t, s, y) in casos {
            let (ra, rt, rs, ry) = nome(arq);
            assert_eq!((ra.as_str(), rt.as_str()), (*a, *t), "{arq}");
            assert_eq!(rs, s.map(|(n, v)| (n.to_string(), v)), "{arq} série");
            assert_eq!(ry, *y, "{arq} ano");
        }
    }

    #[test]
    fn lixo_e_completar() {
        for l in [
            "Untitled",
            "untitled document",
            "Microsoft Word - cap1.doc",
            "12345",
            "",
            "relatorio.docx",
            "  ",
            "2020-03",
        ] {
            assert!(titulo_lixo(l), "{l}");
        }
        assert!(!titulo_lixo("Frankenstein"));
        let dentro = Metadados {
            titulo: "Untitled".into(),
            criadores: vec![Pessoa {
                nome: "Unknown".into(),
                papel: "autor".into(),
            }],
            ..Default::default()
        };
        let m = completar(&dentro, &pelo_nome("Mary Shelley - Frankenstein.pdf"));
        assert_eq!(m.titulo, "Frankenstein");
        assert_eq!(m.criadores[0].nome, "Mary Shelley");
        let dentro = Metadados {
            titulo: "Frankenstein; ou, o Prometeu Moderno".into(),
            ..Default::default()
        };
        let m = completar(&dentro, &pelo_nome("Mary Shelley - Frankenstein (1818).pdf"));
        assert_eq!(m.titulo, "Frankenstein; ou, o Prometeu Moderno");
        assert_eq!((m.criadores[0].nome.as_str(), m.ano), ("Mary Shelley", Some(1818)));
    }

    #[test]
    fn entidades_e_href() {
        assert_eq!(entidades("A &amp; B &#233; &#xE9; &zzz; &"), "A & B é é &zzz; &");
        assert_eq!(descodificar_href("img/c%20over.jpg#x"), "img/c over.jpg");
        assert_eq!(juntar_caminho("OEBPS", "../img/a.png"), "img/a.png");
        assert_eq!(juntar_caminho("", "a/b.png"), "a/b.png");
    }
}
