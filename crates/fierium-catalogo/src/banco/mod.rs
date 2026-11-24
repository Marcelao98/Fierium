//! O banco do catálogo: abrir (escrita ou só-leitura), migrações numeradas e o pool de conexões de leitura.
//! Mesma ideia da biblioteca: UMA conexão de escrita (importar, rede_definir) e várias só-leitura (buscar, item,
//! fontes). A importação de dezenas de milhares de itens roda numa transação da conexão de escrita e não faz a
//! busca da tela esperar (WAL).
use crate::bd;
use fierium_core::ErroFierium;
use rusqlite::{Connection, OpenFlags};
use std::path::{Path, PathBuf};

/// O pool de conexões de leitura (ver `fierium_core::pool`).
pub type Leitores = fierium_core::pool::Pool<Catalogo>;
pub type Leitor<'a> = fierium_core::pool::Emprestado<'a, Catalogo>;

/// A lista de migrações, na ordem; o número é a posição (1, 2…) e vira o `user_version`. Migração nova: um
/// arquivo `NNN_nome.sql` em `migracoes/` e uma linha aqui. Nunca editar uma já publicada.
const MIGRACOES: &[&str] = &[
    include_str!("migracoes/001_base.sql"),
    include_str!("migracoes/002_indices.sql"),
    include_str!("migracoes/003_busca_prefixo.sql"),
];

pub struct Catalogo {
    pub(crate) bd: Connection,
    caminho_db: PathBuf,
}

impl Catalogo {
    /// A conexão de escrita: cria a pasta, liga o WAL e migra.
    pub fn abrir(caminho_db: &Path) -> Result<Self, ErroFierium> {
        if let Some(pai) = caminho_db.parent() {
            std::fs::create_dir_all(pai).map_err(|e| ErroFierium::de_io(pai.display(), e))?;
        }
        let conexao = Connection::open(caminho_db).map_err(bd)?;
        conexao
            .execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
            .map_err(bd)?;
        let mut c = Self {
            bd: conexao,
            caminho_db: caminho_db.to_path_buf(),
        };
        c.migrar()?;
        Ok(c)
    }

    /// Uma conexão só-leitura de um catálogo já aberto (e migrado) pela de escrita.
    pub fn abrir_leitura(caminho_db: &Path) -> Result<Self, ErroFierium> {
        let conexao = Connection::open_with_flags(
            caminho_db,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(bd)?;
        conexao
            .execute_batch("PRAGMA busy_timeout = 5000; PRAGMA cache_size = -32000; PRAGMA temp_store = MEMORY;")
            .map_err(bd)?;
        Ok(Self {
            bd: conexao,
            caminho_db: caminho_db.to_path_buf(),
        })
    }

    /// O pool de conexões de leitura deste catálogo.
    pub fn leitores(&self, max: usize) -> Leitores {
        let caminho = self.caminho_db.clone();
        Leitores::novo(max, move || Self::abrir_leitura(&caminho))
    }

    fn migrar(&mut self) -> Result<(), ErroFierium> {
        let v: i64 = self.bd.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(bd)?;
        for (i, sql) in MIGRACOES.iter().enumerate() {
            let numero = i as i64 + 1;
            if v >= numero {
                continue;
            }
            let tx = self.bd.transaction().map_err(bd)?;
            tx.execute_batch(sql).map_err(bd)?;
            tx.execute_batch(&format!("PRAGMA user_version = {numero};"))
                .map_err(bd)?;
            tx.commit().map_err(bd)?;
        }
        // as fontes que o Fierium conhece existem desde o começo (com 0 itens), pra dar pra atualizar à mão nos Ajustes
        self.bd
            .execute(
                "INSERT OR IGNORE INTO fontes (id, nome, ligada) VALUES ('gutenberg', 'Project Gutenberg', 1)",
                [],
            )
            .map_err(bd)?;
        Ok(())
    }
}
