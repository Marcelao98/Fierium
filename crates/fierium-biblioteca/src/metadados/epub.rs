//! Metadados de dentro do EPUB (OPF dentro do zip) e a capa.
use super::nome::*;
use super::*;
use std::io::Read;

// ---------- EPUB ----------

#[derive(Debug)]
pub(super) struct Tag {
    nome: String,
    attrs: Vec<(String, String)>,
    texto: String,
}

impl Tag {
    fn attr(&self, n: &str) -> Option<&str> {
        self.attrs.iter().find(|(k, _)| k == n).map(|(_, v)| v.as_str())
    }
}

pub(super) fn entidades(s: &str) -> String {
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
pub(super) fn tags_do_xml(xml: &str) -> Vec<Tag> {
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

pub(super) fn ler_texto_do_zip<R: Read + std::io::Seek>(z: &mut zip::ZipArchive<R>, nome: &str) -> Option<String> {
    let f = z.by_name(nome).ok()?;
    let mut s = String::new();
    f.take(XML_MAX).read_to_string(&mut s).ok()?;
    Some(s)
}

pub(super) fn ler_bytes_do_zip<R: Read + std::io::Seek>(z: &mut zip::ZipArchive<R>, nome: &str) -> Option<Vec<u8>> {
    let f = z.by_name(nome).ok()?;
    let mut b = Vec::new();
    f.take(CAPA_MAX).read_to_end(&mut b).ok()?;
    Some(b)
}

pub(super) fn descodificar_href(h: &str) -> String {
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

pub(super) fn juntar_caminho(base_dir: &str, href: &str) -> String {
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

pub(super) fn ext_da_imagem(tipo: &str, href: &str) -> Option<&'static str> {
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

pub(super) fn so_isbn(s: &str) -> Option<String> {
    let t: String = s
        .to_lowercase()
        .replace("urn:isbn:", "")
        .replace("isbn:", "")
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == 'x')
        .collect();
    (t.len() == 13 || t.len() == 10).then(|| t.to_uppercase())
}

pub(super) fn papel_marc(p: &str) -> &'static str {
    match p.trim().to_lowercase().as_str() {
        "trl" | "translator" | "tradutor" => "tradutor",
        "ill" | "illustrator" | "ilustrador" => "ilustrador",
        "nrt" | "narrator" | "narrador" => "narrador",
        "edt" | "editor" | "organizador" | "com" => "organizador",
        _ => "autor",
    }
}

pub(super) fn ano_de(s: &str) -> Option<i32> {
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

pub(super) fn capa_do_epub<R: Read + std::io::Seek>(
    z: &mut zip::ZipArchive<R>,
    tags: &[Tag],
    opf: &str,
) -> Option<Capa> {
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
