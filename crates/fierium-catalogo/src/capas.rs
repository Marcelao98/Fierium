//! Capas do catálogo (cinza): Gutenberg pelo espelho (`pg<n>.cover.medium.jpg`) e, se não houver, a Open Library.
//! Cache permanente em disco; "sem capa" também é lembrado (arquivo `.nenhuma`) pra não perguntar de novo.
//! Nada de varrer: uma capa por item que apareceu na tela.
use crate::{Baixador, ErroFierium};
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Menor que isto não é capa de verdade (página de erro, imagem vazia, capa automática minúscula).
pub const CAPA_MINIMA: usize = 3 * 1024;

/// O nome seguro de um id de item ("gutenberg:55752" vira "gutenberg_55752"); `None` se vier algo estranho.
pub fn chave_do_item(id: &str) -> Option<String> {
    let ok = !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || ":_-".contains(c));
    ok.then(|| id.replace(':', "_"))
}

/// O caminho inverso: "gutenberg_55752" volta a "gutenberg:55752".
pub fn id_da_chave(chave: &str) -> Option<String> {
    let id = chave.replacen('_', ":", 1);
    (chave_do_item(&id).as_deref() == Some(chave)).then_some(id)
}

pub fn capa_em_cache(pasta: &Path, id: &str) -> Option<PathBuf> {
    let p = pasta.join(format!("{}.jpg", chave_do_item(id)?));
    p.is_file().then_some(p)
}

pub fn sem_capa_lembrada(pasta: &Path, id: &str) -> bool {
    chave_do_item(id).is_some_and(|c| pasta.join(format!("{c}.nenhuma")).is_file())
}

/// Parece um JPEG inteiro o bastante pra valer como capa?
pub fn jpeg_valido(b: &[u8]) -> bool {
    b.len() >= CAPA_MINIMA && b.starts_with(&[0xFF, 0xD8, 0xFF])
}

/// Codifica um texto pra ir na URL (só ASCII seguro passa).
pub fn codificar(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            b' ' => "+".into(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

pub fn url_openlibrary_busca(titulo: &str, autor: &str) -> String {
    let mut u = format!(
        "https://openlibrary.org/search.json?title={}&limit=3&fields=cover_i,title",
        codificar(titulo)
    );
    if !autor.is_empty() {
        u.push_str(&format!("&author={}", codificar(autor)));
    }
    u
}

pub fn url_openlibrary_capa(cover_i: i64) -> String {
    format!("https://covers.openlibrary.org/b/id/{cover_i}-M.jpg?default=false")
}

/// O primeiro `cover_i` da resposta de `search.json` (`None` se nenhum resultado tem capa).
pub fn cover_i_da_busca(json: &[u8]) -> Option<i64> {
    let v: Value = serde_json::from_slice(json).ok()?;
    v["docs"]
        .as_array()?
        .iter()
        .find_map(|d| d["cover_i"].as_i64().filter(|n| *n > 0))
}

fn baixar_jpeg(baixador: &dyn Baixador, url: &str, destino: &Path) -> Option<()> {
    if let Err(e) = baixador.baixar(url, destino) {
        tracing::debug!(url, "capa não veio: {e}");
        return None;
    }
    let ok = std::fs::read(destino).is_ok_and(|b| jpeg_valido(&b));
    if !ok {
        let _ = std::fs::remove_file(destino); // sobra de uma resposta que não era capa
    }
    ok.then_some(())
}

/// Acha e guarda a capa do item. `Ok(None)` = não existe em lugar nenhum (e isso fica lembrado). Erro = a rede falhou
/// (nada é lembrado: tenta de novo quando o item aparecer outra vez).
pub fn obter(
    baixador: &dyn Baixador,
    pasta: &Path,
    id: &str,
    titulo: &str,
    autor: &str,
) -> Result<Option<PathBuf>, ErroFierium> {
    let chave = chave_do_item(id).ok_or_else(|| ErroFierium::NaoEncontrado(format!("item do catálogo {id}")))?;
    if let Some(p) = capa_em_cache(pasta, id) {
        return Ok(Some(p));
    }
    if sem_capa_lembrada(pasta, id) {
        return Ok(None);
    }
    std::fs::create_dir_all(pasta).map_err(|e| ErroFierium::de_io(pasta.display(), e))?;
    let final_ = pasta.join(format!("{chave}.jpg"));
    // (a) Gutenberg, pelo espelho
    if let Some(n) = id.strip_prefix("gutenberg:") {
        if baixar_jpeg(baixador, &crate::gutenberg::url_da_capa(n), &final_).is_some() {
            return Ok(Some(final_));
        }
    }
    // (b) Open Library: busca por título + autor e depois a imagem
    let json = pasta.join(format!("{chave}.busca"));
    baixador.baixar(&url_openlibrary_busca(titulo, autor), &json)?;
    let corpo = std::fs::read(&json).unwrap_or_default();
    let _ = std::fs::remove_file(&json); // a resposta já foi lida; sobra temporária
    if let Some(c) = cover_i_da_busca(&corpo) {
        if baixar_jpeg(baixador, &url_openlibrary_capa(c), &final_).is_some() {
            return Ok(Some(final_));
        }
    }
    // (c) nenhuma: lembra, e a interface desenha a capa gerada
    std::fs::write(pasta.join(format!("{chave}.nenhuma")), b"").map_err(|e| ErroFierium::de_io(pasta.display(), e))?;
    Ok(None)
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::sync::Mutex;

    struct Roteiro {
        pedidos: Mutex<Vec<String>>,
        gutenberg: bool,
        busca: &'static str,
    }
    impl Baixador for Roteiro {
        fn baixar(&self, url: &str, destino: &Path) -> Result<u64, ErroFierium> {
            self.pedidos.lock().unwrap().push(url.to_string());
            let corpo: Vec<u8> = if url.contains("gutenberg") {
                if !self.gutenberg {
                    return Err(ErroFierium::Rede("404".into()));
                }
                [&[0xFF, 0xD8, 0xFF][..], &[7u8; 5000]].concat()
            } else if url.contains("search.json") {
                self.busca.as_bytes().to_vec()
            } else {
                [&[0xFF, 0xD8, 0xFF][..], &[9u8; 4000]].concat()
            };
            std::fs::write(destino, &corpo).unwrap();
            Ok(corpo.len() as u64)
        }
    }
    fn roteiro(gutenberg: bool, busca: &'static str) -> Roteiro {
        Roteiro {
            pedidos: Mutex::default(),
            gutenberg,
            busca,
        }
    }

    #[test]
    fn chaves_so_aceitam_id_conhecido() {
        assert_eq!(chave_do_item("gutenberg:12").as_deref(), Some("gutenberg_12"));
        assert_eq!(id_da_chave("gutenberg_12").as_deref(), Some("gutenberg:12"));
        assert!(chave_do_item("../x").is_none() && chave_do_item("").is_none());
        assert!(id_da_chave("a/b").is_none());
    }

    #[test]
    fn gutenberg_primeiro_e_cache_permanente() {
        let d = tempfile::tempdir().unwrap();
        let r = roteiro(true, "{}");
        let p = obter(&r, d.path(), "gutenberg:7", "Dom Casmurro", "Machado de Assis")
            .unwrap()
            .unwrap();
        assert!(p.is_file());
        assert_eq!(r.pedidos.lock().unwrap().len(), 1);
        assert!(r.pedidos.lock().unwrap()[0].contains("gutenberg.pglaf.org/cache/epub/7/pg7.cover.medium.jpg"));
        obter(&r, d.path(), "gutenberg:7", "x", "").unwrap();
        assert_eq!(r.pedidos.lock().unwrap().len(), 1, "da segunda vez vem do cache");
    }

    #[test]
    fn sem_gutenberg_vai_pra_open_library_e_sem_nada_lembra() {
        let d = tempfile::tempdir().unwrap();
        let r = roteiro(false, r#"{"docs":[{"title":"a"},{"cover_i":321}]}"#);
        let p = obter(&r, d.path(), "gutenberg:8", "Iracema", "José de Alencar").unwrap();
        assert!(p.is_some());
        let pedidos = r.pedidos.lock().unwrap().clone();
        assert!(pedidos[1].contains("title=Iracema") && pedidos[1].contains("author=Jos%C3%A9+de+Alencar"));
        assert!(pedidos[2].ends_with("/b/id/321-M.jpg?default=false"));
        let vazio = roteiro(false, r#"{"docs":[]}"#);
        assert!(obter(&vazio, d.path(), "gutenberg:9", "Nada", "").unwrap().is_none());
        let n = vazio.pedidos.lock().unwrap().len();
        assert!(obter(&vazio, d.path(), "gutenberg:9", "Nada", "").unwrap().is_none());
        assert_eq!(vazio.pedidos.lock().unwrap().len(), n, "o 'sem capa' fica lembrado");
    }

    #[test]
    fn imagem_pequena_ou_nao_jpeg_nao_vale() {
        assert!(!jpeg_valido(b"<html>erro</html>"));
        assert!(!jpeg_valido(&[0xFF, 0xD8, 0xFF, 1, 2]));
        assert!(jpeg_valido(&[&[0xFF, 0xD8, 0xFF][..], &[0u8; 4000]].concat()));
    }
}
