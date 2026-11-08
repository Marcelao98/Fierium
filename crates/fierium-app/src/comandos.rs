//! Os comandos do contrato (docs/CONTRATOS.md), com os MESMOS nomes da interface ("app.info", "log.escrever"…).
//! Uma porta só (`chamar`) que despacha por nome: nada de shell nem de caminho solto, e é testável sem Tauri.
//! A interface usa o adaptador combinado: o que já existe aqui vem do Rust, o resto ainda vem do exemplo em memória
//! (cada área troca quando fica pronta, M3 em diante).
use crate::protocolo::Arquivos;
use fierium_biblioteca::Biblioteca;
use fierium_core::{info, log, ErroFierium};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::Value;
use std::path::Path;
use std::sync::Mutex;

/// Os comandos que o Rust já atende (a interface pergunta isso pra montar o adaptador combinado).
pub const NO_RUST: &[&str] = &[
    "app.info",
    "app.comandos",
    "log.escrever",
    "biblioteca.limiar",
    "obras.listar",
    "obra.obter",
    "obra.atualizar",
    "edicao.abrir",
    "progresso.salvar",
    "pastas.listar",
    "pastas.adicionar",
    "pastas.remover",
    "biblioteca.varrer",
];

/// O estado do programa: a biblioteca (SQLite) e os arquivos que o protocolo `fierium://` pode entregar.
pub struct Contexto {
    pub biblioteca: Mutex<Biblioteca>,
    pub arquivos: Arquivos,
}

impl Contexto {
    pub fn abrir(pasta_de_dados: &Path) -> Result<Self, ErroFierium> {
        Ok(Self::com(Biblioteca::abrir(&pasta_de_dados.join("fierium.db"))?))
    }

    pub fn com(b: Biblioteca) -> Self {
        let c = Self {
            biblioteca: Mutex::new(b),
            arquivos: Arquivos::default(),
        };
        if let Err(e) = c.registrar_arquivos() {
            tracing::warn!("não registrei os arquivos da biblioteca: {e}");
        }
        c
    }

    fn registrar_arquivos(&self) -> Result<(), ErroFierium> {
        let lista = self.biblioteca.lock().expect("biblioteca").arquivos_existentes()?;
        self.arquivos.substituir(lista);
        Ok(())
    }
}

#[derive(Deserialize)]
struct PorId {
    id: String,
}

#[derive(Deserialize)]
struct PorCaminho {
    caminho: String,
}

#[derive(Deserialize)]
struct Atualizar {
    id: String,
    favorita: Option<bool>,
    estado: Option<String>,
}

#[derive(Deserialize)]
struct Edicao {
    #[serde(rename = "edicaoId")]
    edicao_id: String,
}

#[derive(Deserialize)]
struct Progresso {
    #[serde(rename = "edicaoId")]
    edicao_id: String,
    posicao: String,
    fracao: f64,
}

fn args<T: DeserializeOwned>(v: Value) -> Result<T, ErroFierium> {
    serde_json::from_value(v).map_err(|e| ErroFierium::argumento("args", e.to_string()))
}

pub fn chamar(ctx: &Contexto, cmd: &str, a: Value) -> Result<Value, ErroFierium> {
    let json = |v: Value| Ok(v);
    let b = || ctx.biblioteca.lock().expect("biblioteca");
    match cmd {
        "app.info" => json(serde_json::to_value(info::info_app(env!("CARGO_PKG_VERSION"))).expect("info vira json")),
        "app.comandos" => json(serde_json::json!(NO_RUST)),
        "log.escrever" => {
            log::escrever(&args(a)?)?;
            json(Value::Null)
        }
        "biblioteca.limiar" => b().limiar(),
        "obras.listar" => b().obras_listar(&a),
        "obra.obter" => b().obra_obter(&args::<PorId>(a)?.id),
        "obra.atualizar" => {
            let x: Atualizar = args(a)?;
            b().obra_atualizar(&x.id, x.favorita, x.estado.as_deref())
        }
        "edicao.abrir" => b().edicao_abrir(&args::<Edicao>(a)?.edicao_id),
        "progresso.salvar" => {
            let x: Progresso = args(a)?;
            b().progresso_salvar(&x.edicao_id, &x.posicao, x.fracao)?;
            json(Value::Null)
        }
        "pastas.listar" => b().pastas_listar(),
        "pastas.adicionar" => {
            let r = b().pastas_adicionar(&args::<PorCaminho>(a)?.caminho)?;
            ctx.registrar_arquivos()?;
            Ok(r)
        }
        "pastas.remover" => {
            let r = b().pastas_remover(&args::<PorCaminho>(a)?.caminho)?;
            ctx.registrar_arquivos()?;
            Ok(r)
        }
        "biblioteca.varrer" => {
            let r = b().varrer()?;
            ctx.registrar_arquivos()?;
            Ok(r)
        }
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use serde_json::json;

    fn contexto() -> (tempfile::TempDir, Contexto) {
        let d = tempfile::tempdir().unwrap();
        let c = Contexto::abrir(d.path()).unwrap();
        (d, c)
    }

    #[test]
    fn nomes_iguais_aos_da_interface_e_erro_com_codigo() {
        let (_d, c) = contexto();
        let i = chamar(&c, "app.info", Value::Null).unwrap();
        assert_eq!(i["adaptador"], "tauri");
        assert_eq!(
            chamar(&c, "shell.rodar", Value::Null).unwrap_err().codigo(),
            "COMANDO_DESCONHECIDO"
        );
        let ruim = json!({ "nivel": "info" });
        assert_eq!(
            chamar(&c, "log.escrever", ruim).unwrap_err().codigo(),
            "ARGUMENTO_INVALIDO"
        );
        let ok = json!({ "nivel": "info", "origem": "teste", "mensagem": "oi" });
        assert_eq!(chamar(&c, "log.escrever", ok).unwrap(), Value::Null);
        assert_eq!(
            chamar(&c, "app.comandos", Value::Null)
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            NO_RUST.len()
        );
    }

    #[test]
    fn biblioteca_de_ponta_a_ponta_e_arquivo_registrado() {
        let (_d, c) = contexto();
        let livros = tempfile::tempdir().unwrap();
        std::fs::write(livros.path().join("Ana - Um Livro.pdf"), b"%PDF-falso").unwrap();
        let caminho = livros.path().to_str().unwrap();
        chamar(&c, "pastas.adicionar", json!({ "caminho": caminho })).unwrap();
        let v = chamar(&c, "biblioteca.varrer", json!({})).unwrap();
        assert_eq!(v["novos"], 1);
        let obras = chamar(&c, "obras.listar", json!({ "texto": "livro" })).unwrap();
        let id = obras[0]["id"].as_str().unwrap();
        let ed = obras[0]["edicoes"][0]["id"].as_str().unwrap();
        assert!(c.arquivos.caminho(ed).is_some());
        let f = chamar(&c, "edicao.abrir", json!({ "edicaoId": ed })).unwrap();
        assert_eq!(f["tipo"], "arquivo");
        chamar(
            &c,
            "progresso.salvar",
            json!({ "edicaoId": ed, "posicao": "3", "fracao": 0.5 }),
        )
        .unwrap();
        let o = chamar(&c, "obra.atualizar", json!({ "id": id, "favorita": true })).unwrap();
        assert_eq!(o["relacao"]["estado"], "lendo");
        assert_eq!(chamar(&c, "biblioteca.limiar", json!({})).unwrap()["ultimo"]["id"], id);
        assert_eq!(
            chamar(&c, "obra.obter", json!({ "id": "x" })).unwrap_err().codigo(),
            "NAO_ENCONTRADO"
        );
        chamar(&c, "pastas.remover", json!({ "caminho": caminho })).unwrap();
        assert!(c.arquivos.caminho(ed).is_none());
    }
}
