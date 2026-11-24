//! Metadados a partir do nome do arquivo ("Autor - Título (ano).pdf").
use super::{autor_lixo, titulo_lixo, Metadados, Pessoa, Serie};

// ---------- nome do arquivo ----------

const PARTICULAS: &[&str] = &[
    "de", "da", "do", "dos", "das", "van", "von", "di", "del", "la", "le", "y", "e", "of", "bin",
];
const ARTIGOS_INICIAIS: &[&str] = &[
    "o", "a", "os", "as", "um", "uma", "the", "an", "el", "la", "los", "las", "guia", "livro", "manual",
];

pub(super) fn sem_pontuacao(s: &str) -> bool {
    !s.chars().any(|c| c.is_ascii_digit() || "!?:;()[]#/\\@".contains(c))
}

pub(super) fn com_virgula_de_pessoa(s: &str) -> bool {
    match s.split_once(',') {
        Some((a, b)) if !b.contains(',') => {
            let (na, nb) = (a.split_whitespace().count(), b.split_whitespace().count());
            (1..=3).contains(&na) && (1..=3).contains(&nb) && sem_pontuacao(s)
        }
        _ => false,
    }
}

pub(super) fn parece_pessoa(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() || !sem_pontuacao(&s.replace(',', "")) {
        return false;
    }
    if s.contains(',') {
        return com_virgula_de_pessoa(s);
    }
    let palavras: Vec<&str> = s.split_whitespace().collect();
    if !(2..=4).contains(&palavras.len()) || ARTIGOS_INICIAIS.contains(&crate::normalizar(palavras[0]).as_str()) {
        return false;
    }
    palavras.iter().all(|p| {
        let c = p.chars().next().unwrap_or('a');
        c.is_uppercase() || PARTICULAS.contains(&crate::normalizar(p).as_str())
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

pub(super) fn pessoas_de(s: &str) -> Vec<Pessoa> {
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
pub(super) fn espacar_pontuacao(s: &str) -> String {
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

pub(super) fn so_digitos(t: &str, max: usize) -> Option<u32> {
    if t.is_empty() || t.len() > max || !t.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    t.parse().ok()
}

pub(super) fn eh_ano(t: &str) -> Option<i32> {
    if t.len() != 4 {
        return None;
    }
    so_digitos(t, 4).map(|n| n as i32).filter(|a| (1000..=2100).contains(a))
}

/// Tira "[...]" e "(1899)"; devolve o texto e o ano, se havia.
pub(super) fn limpar_grupos(s: &str) -> (String, Option<i32>) {
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
pub(super) fn marcador_de_volume(palavras: &[String]) -> Option<(Vec<String>, u32, Vec<String>)> {
    const MARCAS: &[&str] = &["vol", "v", "tomo", "volume", "livro", "book"];
    for (i, p) in palavras.iter().enumerate() {
        let n = crate::normalizar(p);
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

pub(super) struct Parte {
    titulo: String,
    serie: Option<Serie>,
    ano: Option<i32>,
}

/// Uma parte que pode ser título: trata "Série.08.Título.198", "Série vol. 2" e pontos como espaço.
pub(super) fn parte_de_titulo(p: &str) -> Parte {
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
                    .any(|p| PARTICULAS.contains(&crate::normalizar(p).as_str()))
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
