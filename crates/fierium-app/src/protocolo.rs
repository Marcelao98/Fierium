//! O protocolo `fierium://arquivo/<id>`: entrega um arquivo da biblioteca aos pedaços (cabeçalho Range), sem
//! carregar inteiro (D10). Só arquivos registrados pelo núcleo podem ser pedidos (pelo id), nunca um caminho solto.
//! No M3 a biblioteca registra os arquivos dela; o leitor de PDF (M4) lê por aqui.
use fierium_core::intervalo::{interpretar, ler};
use fierium_core::ErroContrato;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::RwLock;

#[derive(Default)]
pub struct Arquivos {
    mapa: RwLock<HashMap<String, PathBuf>>,
}

impl Arquivos {
    // a biblioteca (M3) registra os arquivos dela; até lá só os testes usam
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn registrar(&self, id: &str, caminho: PathBuf) {
        self.mapa
            .write()
            .expect("registro de arquivos")
            .insert(id.into(), caminho);
    }

    pub fn caminho(&self, id: &str) -> Option<PathBuf> {
        self.mapa.read().expect("registro de arquivos").get(id).cloned()
    }
}

/// A resposta (status, cabeçalhos, corpo), separada do Tauri pra dar pra testar.
pub struct Resposta {
    pub status: u16,
    pub cabecalhos: Vec<(&'static str, String)>,
    pub corpo: Vec<u8>,
}

fn erro(status: u16, e: ErroContrato) -> Resposta {
    Resposta {
        status,
        cabecalhos: vec![("Content-Type", "application/json".into())],
        corpo: serde_json::to_vec(&e).expect("erro vira json"),
    }
}

fn tipo(caminho: &std::path::Path) -> &'static str {
    match caminho
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_lowercase)
        .as_deref()
    {
        Some("pdf") => "application/pdf",
        Some("epub") => "application/epub+zip",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    }
}

/// `caminho_url` = a parte do endereço depois do esquema (ex.: "/arquivo/abc").
pub fn responder(arquivos: &Arquivos, caminho_url: &str, range: Option<&str>) -> Resposta {
    let Some(id) = caminho_url.trim_start_matches('/').strip_prefix("arquivo/") else {
        return erro(
            404,
            ErroContrato {
                codigo: "NAO_ENCONTRADO".into(),
                mensagem: format!("endereço desconhecido: {caminho_url}"),
            },
        );
    };
    let Some(caminho) = arquivos.caminho(id) else {
        return erro(
            404,
            ErroContrato {
                codigo: "NAO_ENCONTRADO".into(),
                mensagem: format!("arquivo não registrado: {id}"),
            },
        );
    };
    let total = match std::fs::metadata(&caminho) {
        Ok(m) => m.len(),
        Err(e) => return erro(404, fierium_core::ErroFierium::de_io(caminho.display(), e).into()),
    };
    let i = match interpretar(range, total) {
        Ok(i) => i,
        Err(e) => return erro(416, e.into()),
    };
    match ler(&caminho, i) {
        Ok(corpo) => Resposta {
            status: if range.is_some() { 206 } else { 200 },
            cabecalhos: vec![
                ("Content-Type", tipo(&caminho).into()),
                ("Accept-Ranges", "bytes".into()),
                ("Content-Range", format!("bytes {}-{}/{}", i.inicio, i.fim, total)),
                ("Content-Length", corpo.len().to_string()),
                ("Cache-Control", "no-store".into()),
                (
                    "Access-Control-Expose-Headers",
                    "Content-Range, Content-Length, Accept-Ranges".into(),
                ),
            ],
            corpo,
        },
        Err(e) => erro(500, e.into()),
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::io::Write;

    #[test]
    fn so_arquivo_registrado_e_aos_pedacos() {
        let mut f = tempfile::Builder::new().suffix(".pdf").tempfile().unwrap();
        f.write_all(b"%PDF-1.7 0123456789").unwrap();
        let a = Arquivos::default();
        a.registrar("x1", f.path().into());
        let r = responder(&a, "/arquivo/x1", Some("bytes=0-7"));
        assert_eq!((r.status, r.corpo.as_slice()), (206, &b"%PDF-1.7"[..]));
        assert!(r.cabecalhos.contains(&("Content-Range", "bytes 0-7/19".into())));
        assert!(r.cabecalhos.contains(&("Content-Type", "application/pdf".into())));
        assert_eq!(responder(&a, "/arquivo/x1", None).status, 200);
        assert_eq!(responder(&a, "/arquivo/x1", Some("bytes=50-")).status, 416);
        // nada de caminho solto: só pelo id registrado
        assert_eq!(responder(&a, "/arquivo/..%2F..%2Fetc%2Fpasswd", None).status, 404);
        assert_eq!(responder(&a, "/outra/x1", None).status, 404);
    }
}
