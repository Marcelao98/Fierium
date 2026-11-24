//! Os comandos do contrato (docs/CONTRATOS.md), com os MESMOS nomes da interface ("app.info", "log.escrever"…).
//! Uma porta só (`chamar`) que despacha por nome: nada de shell nem de caminho solto, e é testável sem Tauri.
//!
//! Cada área mora no seu arquivo e declara os comandos que atende (`COMANDOS`) e quem os atende (`atender`):
//! `app`, `biblioteca` (obras, pastas, varredura), `leitura` (abrir edição, progresso), `marcacoes`, `busca`,
//! `catalogo` (catálogo público e rede) e `capas`. A lista que `app.comandos` devolve é montada dessas declarações
//! (`AREAS`), então comando novo = uma linha na sua área; não existe mais lista à mão pra esquecer de atualizar.
//!
//! Conexões: escrita numa só (`Mutex`, trava curta) e leitura em pool de conexões só-leitura (WAL). Uma varredura,
//! um download ou a importação do catálogo escrevem sem fazer a estante esperar.
use crate::protocolo::Arquivos;
use fierium_biblioteca::{Biblioteca, Leitor, Leitores};
use fierium_catalogo::{Baixador, BaixadorHttp, Catalogo};
use fierium_core::ErroFierium;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::{Condvar, Mutex, MutexGuard, PoisonError};

mod app;
mod biblioteca;
mod busca;
mod capas;
mod catalogo;
mod leitura;
mod marcacoes;
#[cfg(test)]
mod testes;

pub use capas::capa_do_catalogo;
pub use catalogo::atualizar_se_vazio;

/// Quantas conexões de leitura ficam abertas esperando pedido (picos abrem conexões passageiras).
const LEITORES_GUARDADOS: usize = 4;

type Atender = fn(&Contexto, &str, Value) -> Result<Value, ErroFierium>;

/// Uma área de comandos: os nomes que atende e a função que os executa.
struct Area {
    comandos: &'static [&'static str],
    atender: Atender,
}

/// Todas as áreas. O despacho e a lista de `app.comandos` saem daqui.
const AREAS: &[Area] = &[
    Area {
        comandos: app::COMANDOS,
        atender: app::atender,
    },
    Area {
        comandos: biblioteca::COMANDOS,
        atender: biblioteca::atender,
    },
    Area {
        comandos: leitura::COMANDOS,
        atender: leitura::atender,
    },
    Area {
        comandos: marcacoes::COMANDOS,
        atender: marcacoes::atender,
    },
    Area {
        comandos: busca::COMANDOS,
        atender: busca::atender,
    },
    Area {
        comandos: catalogo::COMANDOS,
        atender: catalogo::atender,
    },
    Area {
        comandos: capas::COMANDOS,
        atender: capas::atender,
    },
];

/// Os comandos que o Rust atende (a interface pergunta isso pra montar o adaptador combinado).
pub fn comandos_do_rust() -> Vec<&'static str> {
    AREAS.iter().flat_map(|a| a.comandos.iter().copied()).collect()
}

/// O estado do programa: a biblioteca (SQLite) e os arquivos que o protocolo `fierium://` pode entregar.
pub struct Contexto {
    /// a conexão de escrita da biblioteca (trava curta: nunca fica segurada durante disco lento ou rede)
    escrita: Mutex<Biblioteca>,
    /// conexões só-leitura da biblioteca (as telas leem por aqui)
    leitura: Leitores,
    pub arquivos: Arquivos,
    /// o catálogo público (D30): outro SQLite, descartável; escrita e leitura separadas como na biblioteca
    catalogo_escrita: Mutex<Catalogo>,
    catalogo_leitura: fierium_catalogo::Leitores,
    pub baixador: Box<dyn Baixador>,
    /// onde `catalogo.baixar` grava os livros
    pub pasta_de_livros: PathBuf,
    /// onde ficam os arquivos baixados de catálogo (cache)
    pub pasta_de_cache: PathBuf,
    /// `~/.cache/fierium/capas-catalogo/`: as capas dos itens cinzas (cache permanente)
    pub pasta_de_capas_catalogo: PathBuf,
    /// quantas capas do catálogo estão sendo buscadas agora (poucas ao mesmo tempo, pra ser educado com os servidores)
    vagas_de_capa: (Mutex<usize>, Condvar),
    atualizando: AtomicBool,
    /// o andamento da atualização do catálogo, pra tela mostrar (nunca segura o banco)
    andamento: Mutex<catalogo::Andamento>,
}

/// Trava ignorando envenenamento: se um comando entrou em pânico segurando a trava, a conexão do SQLite continua
/// boa (a transação aberta é desfeita ao soltar), e travar tudo daí em diante seria pior que o defeito.
fn travar<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

impl Contexto {
    pub fn abrir(pasta_de_dados: &Path) -> Result<Self, ErroFierium> {
        let catalogo = Catalogo::abrir(&pasta_de_dados.join("catalogo.db"))?;
        let mut c = Self::com(Biblioteca::abrir(&pasta_de_dados.join("fierium.db"))?, catalogo);
        c.pasta_de_cache = pasta_de_dados.join("cache");
        Ok(c)
    }

    pub fn com(b: Biblioteca, catalogo: Catalogo) -> Self {
        let c = Self {
            leitura: b.leitores(LEITORES_GUARDADOS),
            escrita: Mutex::new(b),
            arquivos: Arquivos::default(),
            catalogo_leitura: catalogo.leitores(LEITORES_GUARDADOS),
            catalogo_escrita: Mutex::new(catalogo),
            baixador: Box::new(BaixadorHttp::default()),
            pasta_de_livros: biblioteca::pasta_de_livros_padrao(),
            pasta_de_cache: std::env::temp_dir().join("fierium-cache"),
            pasta_de_capas_catalogo: fierium_biblioteca::metadados::pasta_de_capas().with_file_name("capas-catalogo"),
            vagas_de_capa: (Mutex::new(0), Condvar::new()),
            atualizando: AtomicBool::new(false),
            andamento: Mutex::new(catalogo::Andamento::default()),
        };
        if let Err(e) = c.registrar_arquivos() {
            tracing::warn!("não registrei os arquivos da biblioteca: {e}");
        }
        c
    }

    /// Uma conexão de leitura da biblioteca (do pool).
    fn ler(&self) -> Result<Leitor<'_>, ErroFierium> {
        self.leitura.emprestar()
    }

    /// A conexão de escrita da biblioteca. Segure por pouco tempo.
    fn escrever(&self) -> MutexGuard<'_, Biblioteca> {
        travar(&self.escrita)
    }

    /// Uma conexão de leitura do catálogo (do pool).
    fn catalogo_ler(&self) -> Result<fierium_catalogo::Leitor<'_>, ErroFierium> {
        self.catalogo_leitura.emprestar()
    }

    /// A conexão de escrita do catálogo. Segure por pouco tempo.
    fn catalogo_escrever(&self) -> MutexGuard<'_, Catalogo> {
        travar(&self.catalogo_escrita)
    }

    /// Refaz a lista de arquivos e capas que o protocolo `fierium://` entrega (depois de pastas, varredura, capas).
    fn registrar_arquivos(&self) -> Result<(), ErroFierium> {
        let l = self.ler()?;
        self.arquivos.substituir(l.arquivos_existentes()?);
        self.arquivos.substituir_capas(l.capas_existentes()?);
        Ok(())
    }
}

#[derive(Deserialize)]
struct PorId {
    id: String,
}

fn args<T: DeserializeOwned>(v: Value) -> Result<T, ErroFierium> {
    serde_json::from_value(v).map_err(|e| ErroFierium::argumento("args", e.to_string()))
}

/// Despacha o comando pra área que o declara.
pub fn chamar(ctx: &Contexto, cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    match AREAS.iter().find(|area| area.comandos.contains(&cmd)) {
        Some(area) => (area.atender)(ctx, cmd, a),
        None => Err(ErroFierium::ComandoDesconhecido(cmd.into())),
    }
}
