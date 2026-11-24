//! O banco da biblioteca: abrir (escrita ou só-leitura), migrações numeradas e o pool de conexões de leitura.
//!
//! Conexões: UMA de escrita (`Biblioteca::abrir`, que migra) e várias só-leitura (`Biblioteca::abrir_leitura`,
//! emprestadas por `Leitores`). O SQLite em modo WAL deixa quem lê andar enquanto outra conexão escreve, então uma
//! varredura, um download ou a importação do catálogo nunca travam a tela que está lendo a estante.
//! O mesmo tipo `Biblioteca` serve às duas: numa conexão só-leitura qualquer escrita falha com erro de banco
//! (o SQLite recusa), o que protege contra um comando de leitura que escreva sem querer.
use crate::{bd, metadados};
use fierium_core::ErroFierium;
use rusqlite::{Connection, OpenFlags};
use std::path::{Path, PathBuf};

mod migracao_003;
/// O pool de conexões de leitura (ver `fierium_core::pool`).
pub type Leitores = fierium_core::pool::Pool<Biblioteca>;
pub type Leitor<'a> = fierium_core::pool::Emprestado<'a, Biblioteca>;

/// Uma migração: SQL puro (arquivo numerado em `migracoes/`) ou código Rust quando precisa juntar dados.
enum Migracao {
    Sql(&'static str),
    Codigo(fn(&mut Connection) -> Result<(), ErroFierium>),
}

/// A lista, na ordem. O número da migração é a posição (1, 2, 3…) e vira o `user_version` do banco.
/// Migração nova: um arquivo `NNN_nome.sql` em `migracoes/` e uma linha aqui. Nunca editar uma já publicada.
const MIGRACOES: &[Migracao] = &[
    Migracao::Sql(include_str!("migracoes/001_base.sql")),
    Migracao::Sql(include_str!("migracoes/002_marcacoes.sql")),
    Migracao::Codigo(migracao_003::migrar),
    Migracao::Sql(include_str!("migracoes/004_metadados.sql")),
    Migracao::Sql(include_str!("migracoes/005_indices.sql")),
];

pub(crate) const VERSAO_BANCO: i64 = MIGRACOES.len() as i64;

pub struct Biblioteca {
    pub(crate) bd: Connection,
    /// onde ficam as capas extraídas (`<impressao>.<ext>`)
    pub(crate) capas: PathBuf,
    /// o arquivo do banco (pra abrir conexões de leitura irmãs)
    pub(crate) caminho_db: PathBuf,
}

impl Biblioteca {
    /// A conexão de escrita: cria a pasta, liga o WAL e migra o banco.
    pub fn abrir(caminho_db: &Path) -> Result<Self, ErroFierium> {
        Self::abrir_com_capas(caminho_db, metadados::pasta_de_capas())
    }

    pub fn abrir_com_capas(caminho_db: &Path, capas: PathBuf) -> Result<Self, ErroFierium> {
        if let Some(pai) = caminho_db.parent() {
            std::fs::create_dir_all(pai).map_err(|e| ErroFierium::de_io(pai.display(), e))?;
        }
        let conexao = Connection::open(caminho_db).map_err(bd)?;
        conexao
            .execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
            .map_err(bd)?;
        let mut b = Self {
            bd: conexao,
            capas,
            caminho_db: caminho_db.to_path_buf(),
        };
        b.migrar()?;
        Ok(b)
    }

    /// Uma conexão só-leitura de um banco que já foi aberto (e migrado) pela de escrita.
    pub fn abrir_leitura(caminho_db: &Path, capas: PathBuf) -> Result<Self, ErroFierium> {
        let conexao = Connection::open_with_flags(
            caminho_db,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(bd)?;
        conexao
            .execute_batch("PRAGMA busy_timeout = 5000; PRAGMA cache_size = -16000; PRAGMA temp_store = MEMORY;")
            .map_err(bd)?;
        Ok(Self {
            bd: conexao,
            capas,
            caminho_db: caminho_db.to_path_buf(),
        })
    }

    /// O pool de conexões de leitura deste banco (guarda até `max` abertas; picos abrem conexões passageiras).
    pub fn leitores(&self, max: usize) -> Leitores {
        let (caminho, capas) = (self.caminho_db.clone(), self.capas.clone());
        Leitores::novo(max, move || Self::abrir_leitura(&caminho, capas.clone()))
    }

    fn versao(&self) -> Result<i64, ErroFierium> {
        self.bd.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(bd)
    }

    fn migrar(&mut self) -> Result<(), ErroFierium> {
        let v = self.versao()?;
        if (1..VERSAO_BANCO).contains(&v) {
            // antes de mexer num banco que já tem coisa: uma cópia inteira ao lado (fierium.db.v2.bak)
            let copia = PathBuf::from(format!("{}.v{v}.bak", self.caminho_db.display()));
            if !copia.exists() {
                self.bd
                    .execute("VACUUM INTO ?1", [copia.to_string_lossy()])
                    .map_err(bd)?;
                tracing::info!(de = v, para = VERSAO_BANCO, copia = %copia.display(), "banco: migrando (cópia guardada)");
            }
        }
        for (i, m) in MIGRACOES.iter().enumerate() {
            let numero = i as i64 + 1;
            if v >= numero {
                continue;
            }
            match m {
                Migracao::Sql(sql) => {
                    let tx = self.bd.transaction().map_err(bd)?;
                    tx.execute_batch(sql).map_err(bd)?;
                    tx.execute_batch(&format!("PRAGMA user_version = {numero};"))
                        .map_err(bd)?;
                    tx.commit().map_err(bd)?;
                }
                Migracao::Codigo(f) => f(&mut self.bd)?,
            }
        }
        debug_assert_eq!(self.versao().ok(), Some(VERSAO_BANCO));
        Ok(())
    }
}
