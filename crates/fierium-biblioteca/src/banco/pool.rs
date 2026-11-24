//! O pool de conexões de leitura.
//!
//! Escolha: um pool pequeno (guarda até `max` conexões abertas); se chegarem mais pedidos ao mesmo tempo do que
//! conexões livres, o excesso abre uma conexão passageira (abrir uma só-leitura em WAL custa décimos de
//! milissegundo) que é fechada ao devolver. Assim ninguém espera na fila de outra consulta lenta (uma busca grande
//! não segura a estante) e o banco não fica com dezenas de conexões abertas depois de um pico.
use super::Biblioteca;
use fierium_core::ErroFierium;
use std::ops::Deref;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Leitores {
    caminho_db: PathBuf,
    capas: PathBuf,
    max: usize,
    livres: Mutex<Vec<Biblioteca>>,
}

impl Leitores {
    pub(super) fn novo(caminho_db: PathBuf, capas: PathBuf, max: usize) -> Self {
        Self {
            caminho_db,
            capas,
            max: max.max(1),
            livres: Mutex::new(Vec::new()),
        }
    }

    /// Empresta uma conexão só-leitura (a guardada, ou uma nova). Volta ao pool quando o `Leitor` sai de escopo.
    pub fn emprestar(&self) -> Result<Leitor<'_>, ErroFierium> {
        let guardada = self.livres.lock().expect("pool de leitura").pop();
        let b = match guardada {
            Some(b) => b,
            None => Biblioteca::abrir_leitura(&self.caminho_db, self.capas.clone())?,
        };
        Ok(Leitor { pool: self, b: Some(b) })
    }
}

/// Uma conexão de leitura emprestada; derefere pra `Biblioteca`.
pub struct Leitor<'a> {
    pool: &'a Leitores,
    b: Option<Biblioteca>,
}

impl Deref for Leitor<'_> {
    type Target = Biblioteca;
    fn deref(&self) -> &Biblioteca {
        self.b.as_ref().expect("leitor emprestado")
    }
}

impl Drop for Leitor<'_> {
    fn drop(&mut self) {
        if let Some(b) = self.b.take() {
            let mut livres = self.pool.livres.lock().expect("pool de leitura");
            if livres.len() < self.pool.max {
                livres.push(b);
            }
        }
    }
}
