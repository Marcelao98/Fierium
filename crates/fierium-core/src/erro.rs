//! Erros do núcleo. Cada variante tem um código estável (o mesmo que a interface usa) e uma mensagem em português.
//! Nada de erro genérico: um defeito novo ganha uma variante nova.
use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum ErroFierium {
    #[error("comando desconhecido: {0}")]
    ComandoDesconhecido(String),
    #[error("argumento inválido em {campo}: {motivo}")]
    Argumento { campo: String, motivo: String },
    #[error("não encontrado: {0}")]
    NaoEncontrado(String),
    #[error("sem permissão: {0}")]
    SemPermissao(String),
    #[error("disco cheio ao gravar {0}")]
    DiscoCheio(String),
    #[error("pedaço pedido fora do arquivo: {0}")]
    ForaDoArquivo(String),
    #[error("não consegui ligar o log: {0}")]
    Log(String),
    #[error("erro de arquivo em {caminho}: {fonte}")]
    Arquivo {
        caminho: String,
        #[source]
        fonte: std::io::Error,
    },
}

impl ErroFierium {
    pub fn codigo(&self) -> &'static str {
        match self {
            Self::ComandoDesconhecido(_) => "COMANDO_DESCONHECIDO",
            Self::Argumento { .. } => "ARGUMENTO_INVALIDO",
            Self::NaoEncontrado(_) => "NAO_ENCONTRADO",
            Self::SemPermissao(_) => "SEM_PERMISSAO",
            Self::DiscoCheio(_) => "DISCO_CHEIO",
            Self::ForaDoArquivo(_) => "FORA_DO_ARQUIVO",
            Self::Log(_) => "LOG_INDISPONIVEL",
            Self::Arquivo { .. } => "ERRO_DE_ARQUIVO",
        }
    }

    pub fn argumento(campo: &str, motivo: impl Into<String>) -> Self {
        Self::Argumento {
            campo: campo.into(),
            motivo: motivo.into(),
        }
    }

    /// Erro de E/S com o código certo (não achou, sem permissão, disco cheio, o resto).
    pub fn de_io(caminho: impl std::fmt::Display, fonte: std::io::Error) -> Self {
        let c = caminho.to_string();
        match fonte.kind() {
            std::io::ErrorKind::NotFound => Self::NaoEncontrado(c),
            std::io::ErrorKind::PermissionDenied => Self::SemPermissao(c),
            std::io::ErrorKind::StorageFull => Self::DiscoCheio(c),
            _ => Self::Arquivo { caminho: c, fonte },
        }
    }
}

/// O erro como a interface recebe (`ErroFierium { codigo, mensagem }` no TypeScript).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ErroContrato {
    pub codigo: String,
    pub mensagem: String,
}

impl From<&ErroFierium> for ErroContrato {
    fn from(e: &ErroFierium) -> Self {
        Self {
            codigo: e.codigo().into(),
            mensagem: e.to_string(),
        }
    }
}

impl From<ErroFierium> for ErroContrato {
    fn from(e: ErroFierium) -> Self {
        (&e).into()
    }
}
