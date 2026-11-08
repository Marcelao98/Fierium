//! Arquivo aos pedaços (D10): o leitor pede "bytes=início-fim" e recebe só aquele trecho. Um PDF de 500 MB nunca
//! entra inteiro na memória. Segue o cabeçalho HTTP Range (RFC 9110), um intervalo por pedido.
use crate::erro::ErroFierium;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// Maior pedaço entregue de uma vez (o leitor pede de novo o resto).
pub const MAX_PEDACO: u64 = 4 << 20;

/// Intervalo `[inicio, fim]` (fim incluído), já ajustado ao tamanho do arquivo e ao pedaço máximo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Intervalo {
    pub inicio: u64,
    pub fim: u64,
}

impl Intervalo {
    pub fn tamanho(&self) -> u64 {
        self.fim - self.inicio + 1
    }
}

/// Lê o cabeçalho Range. `None` = sem cabeçalho (arquivo do começo, até o pedaço máximo).
/// `bytes=10-19`, `bytes=10-` (do 10 ao fim) e `bytes=-500` (os últimos 500).
pub fn interpretar(range: Option<&str>, total: u64) -> Result<Intervalo, ErroFierium> {
    let fora = || ErroFierium::ForaDoArquivo(format!("{} (o arquivo tem {total} bytes)", range.unwrap_or("")));
    if total == 0 {
        return Err(fora());
    }
    let (ini, fim) = match range.map(str::trim) {
        None | Some("") => (0, total - 1),
        Some(r) => {
            let r = r
                .strip_prefix("bytes=")
                .ok_or_else(|| ErroFierium::argumento("range", r))?;
            if r.contains(',') {
                return Err(ErroFierium::argumento("range", "só um intervalo por pedido"));
            }
            let (a, b) = r.split_once('-').ok_or_else(|| ErroFierium::argumento("range", r))?;
            let num = |s: &str| s.trim().parse::<u64>().map_err(|_| ErroFierium::argumento("range", r));
            match (a.trim().is_empty(), b.trim().is_empty()) {
                (true, false) => {
                    let n = num(b)?.min(total);
                    if n == 0 {
                        return Err(fora());
                    }
                    (total - n, total - 1)
                }
                (false, true) => (num(a)?, total - 1),
                (false, false) => (num(a)?, num(b)?.min(total - 1)),
                (true, true) => return Err(ErroFierium::argumento("range", r)),
            }
        }
    };
    if ini > fim || ini >= total {
        return Err(fora());
    }
    Ok(Intervalo {
        inicio: ini,
        fim: fim.min(ini + MAX_PEDACO - 1),
    })
}

/// Lê só o trecho pedido do arquivo.
pub fn ler(caminho: &Path, i: Intervalo) -> Result<Vec<u8>, ErroFierium> {
    let nome = caminho.display().to_string();
    let mut f = std::fs::File::open(caminho).map_err(|e| ErroFierium::de_io(&nome, e))?;
    f.seek(SeekFrom::Start(i.inicio))
        .map_err(|e| ErroFierium::de_io(&nome, e))?;
    let mut v = Vec::with_capacity(i.tamanho() as usize);
    f.take(i.tamanho())
        .read_to_end(&mut v)
        .map_err(|e| ErroFierium::de_io(&nome, e))?;
    Ok(v)
}
