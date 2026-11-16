//! Os comandos do contrato (docs/CONTRATOS.md), com os MESMOS nomes da interface ("app.info", "log.escrever"…).
//! Uma porta só (`chamar`) que despacha por nome: nada de shell nem de caminho solto, e é testável sem Tauri.
//! A interface usa o adaptador combinado: o que já existe aqui vem do Rust, o resto ainda vem do exemplo em memória
//! (cada área troca quando fica pronta, M3 em diante).
use crate::protocolo::Arquivos;
use fierium_biblioteca::Biblioteca;
use fierium_catalogo::{Baixador, BaixadorHttp, Catalogo, Fonte, Gutenberg};
use fierium_core::{info, log, ErroFierium};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
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
    "obra.juntar",
    "edicao.abrir",
    "edicao.separar",
    "progresso.salvar",
    "pastas.listar",
    "pastas.adicionar",
    "pastas.remover",
    "pastas.sugestoes",
    "biblioteca.varrer",
    "marcacoes.listar",
    "marcacao.criar",
    "marcacao.atualizar",
    "marcacao.apagar",
    "busca.tudo",
    "catalogo.buscar",
    "catalogo.item",
    "catalogo.fontes",
    "catalogo.atualizar",
    "catalogo.baixar",
    "rede.ler",
    "rede.definir",
];

/// O estado do programa: a biblioteca (SQLite) e os arquivos que o protocolo `fierium://` pode entregar.
pub struct Contexto {
    pub biblioteca: Mutex<Biblioteca>,
    pub arquivos: Arquivos,
    /// o catálogo público (D30): outro SQLite, descartável
    pub catalogo: Mutex<Catalogo>,
    pub baixador: Box<dyn Baixador>,
    /// onde `catalogo.baixar` grava os livros
    pub pasta_de_livros: PathBuf,
    /// onde ficam os arquivos baixados de catálogo (cache)
    pub pasta_de_cache: PathBuf,
    atualizando: AtomicBool,
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
            biblioteca: Mutex::new(b),
            arquivos: Arquivos::default(),
            catalogo: Mutex::new(catalogo),
            baixador: Box::new(BaixadorHttp::default()),
            pasta_de_livros: pasta_de_livros_padrao(),
            pasta_de_cache: std::env::temp_dir().join("fierium-cache"),
            atualizando: AtomicBool::new(false),
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
struct Juntar {
    ids: Vec<String>,
}

#[derive(Deserialize)]
struct Busca {
    texto: String,
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
        "obra.juntar" => b().obra_juntar(&args::<Juntar>(a)?.ids),
        "edicao.abrir" => b().edicao_abrir(&args::<Edicao>(a)?.edicao_id),
        "edicao.separar" => b().edicao_separar(&args::<Edicao>(a)?.edicao_id),
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
        "pastas.sugestoes" => json(serde_json::json!(sugestoes_de_pastas())),
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
        "marcacoes.listar" => b().marcacoes_listar(&a),
        "marcacao.criar" => b().marcacao_criar(&a),
        "marcacao.atualizar" => b().marcacao_atualizar(&a),
        "marcacao.apagar" => {
            b().marcacao_apagar(&args::<PorId>(a)?.id)?;
            json(Value::Null)
        }
        "busca.tudo" => b().busca_tudo(&args::<Busca>(a)?.texto),
        // ----- catálogo público e rede (D30) -----
        "catalogo.buscar" => catalogo_buscar(ctx, &a),
        "catalogo.item" => {
            let mut i = ctx.catalogo.lock().expect("catálogo").item(&args::<PorId>(a)?.id)?;
            marcar_obra(ctx, &mut i);
            Ok(i)
        }
        "catalogo.fontes" => ctx.catalogo.lock().expect("catálogo").fontes(),
        "catalogo.atualizar" => catalogo_atualizar(ctx, &args::<PorFonte>(a)?.fonte),
        "catalogo.baixar" => catalogo_baixar(ctx, &args::<Baixar>(a)?),
        "rede.ler" => {
            json(serde_json::json!({ "permitida": ctx.catalogo.lock().expect("catálogo").rede_permitida()? }))
        }
        "rede.definir" => {
            let p = args::<Rede>(a)?.permitida;
            ctx.catalogo.lock().expect("catálogo").rede_definir(p)?;
            json(serde_json::json!({ "permitida": p }))
        }
        outro => Err(ErroFierium::ComandoDesconhecido(outro.into())),
    }
}

#[derive(Deserialize)]
struct PorFonte {
    fonte: String,
}

#[derive(Deserialize)]
struct Baixar {
    id: String,
    oferta: Option<usize>,
}

#[derive(Deserialize)]
struct Rede {
    permitida: bool,
}

/// `~/Documentos/Livros/Fierium` (ou `~/Documents/Livros/Fierium` se não houver "Documentos").
pub fn pasta_de_livros_padrao() -> PathBuf {
    let casa = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    let docs = if casa.join("Documentos").is_dir() {
        "Documentos"
    } else {
        "Documents"
    };
    casa.join(docs).join("Livros").join("Fierium")
}

/// Preenche `obraId` quando a pessoa já tem a obra (mesma chave da biblioteca: título + 1º autor normalizados).
fn marcar_obra(ctx: &Contexto, item: &mut Value) {
    let titulo = item["titulo"].as_str().unwrap_or("").to_string();
    let autor = item["pessoas"]
        .as_array()
        .and_then(|p| p.iter().find(|x| x["papel"] == "autor").or_else(|| p.first()))
        .and_then(|p| p["nome"].as_str())
        .unwrap_or("")
        .to_string();
    match ctx
        .biblioteca
        .lock()
        .expect("biblioteca")
        .obra_por_chave(&titulo, &autor)
    {
        Ok(Some(o)) => item["obraId"] = Value::String(o),
        Ok(None) => {}
        Err(e) => tracing::warn!("não consegui ver se a obra já existe: {e}"),
    }
}

fn catalogo_buscar(ctx: &Contexto, filtro: &Value) -> Result<Value, ErroFierium> {
    let mut r = ctx.catalogo.lock().expect("catálogo").buscar(filtro)?;
    if let Some(itens) = r["itens"].as_array_mut() {
        for i in itens {
            marcar_obra(ctx, i);
        }
    }
    Ok(r)
}

/// Baixa o catálogo da fonte (sem segurar o banco durante o download) e importa numa transação.
/// Quem chama já está fora da linha da janela (`#[tauri::command(async)]`).
fn catalogo_atualizar(ctx: &Contexto, fonte: &str) -> Result<Value, ErroFierium> {
    let f: Box<dyn Fonte> = match fonte {
        "gutenberg" => Box::<Gutenberg>::default(),
        outra => return Err(ErroFierium::NaoEncontrado(format!("fonte de catálogo \"{outra}\""))),
    };
    ctx.catalogo
        .lock()
        .expect("catálogo")
        .exigir_rede("atualizar o catálogo")?;
    if ctx.atualizando.swap(true, Ordering::SeqCst) {
        return Err(ErroFierium::argumento(
            "fonte",
            "o catálogo já está sendo atualizado, espere terminar",
        ));
    }
    let r = (|| {
        let itens = f.carregar(ctx.baixador.as_ref(), &ctx.pasta_de_cache)?;
        ctx.catalogo.lock().expect("catálogo").importar(f.as_ref(), &itens)
    })();
    ctx.atualizando.store(false, Ordering::SeqCst);
    r
}

/// Na primeira abertura com rede ligada e catálogo vazio: atualiza o Gutenberg sozinho (em segundo plano).
pub fn atualizar_se_vazio(ctx: std::sync::Arc<Contexto>) {
    let precisa = {
        let c = ctx.catalogo.lock().expect("catálogo");
        c.rede_permitida().unwrap_or(false) && c.total_de_itens().unwrap_or(1) == 0
    };
    if !precisa {
        return;
    }
    let r = std::thread::Builder::new()
        .name("catalogo-inicial".into())
        .spawn(move || match catalogo_atualizar(&ctx, "gutenberg") {
            Ok(f) => tracing::info!(itens = %f["itens"], "catálogo do Gutenberg baixado na primeira abertura"),
            Err(e) => tracing::warn!(codigo = e.codigo(), "catálogo inicial não veio: {e}"),
        });
    if let Err(e) = r {
        tracing::warn!("não consegui iniciar a atualização do catálogo: {e}");
    }
}

fn catalogo_baixar(ctx: &Contexto, x: &Baixar) -> Result<Value, ErroFierium> {
    let item = {
        let c = ctx.catalogo.lock().expect("catálogo");
        c.exigir_rede("baixar o livro")?;
        c.item(&x.id)?
    };
    let ofertas = item["ofertas"].as_array().cloned().unwrap_or_default();
    let oferta = ofertas.get(x.oferta.unwrap_or(0)).ok_or_else(|| {
        ErroFierium::NaoEncontrado(format!(
            "oferta de download pra {} (esse item não tem onde baixar)",
            x.id
        ))
    })?;
    let url = oferta["url"].as_str().unwrap_or_default();
    let formato = oferta["formato"].as_str().unwrap_or("epub");
    let autor = item["pessoas"]
        .as_array()
        .and_then(|p| p.iter().find(|x| x["papel"] == "autor"))
        .and_then(|p| p["nome"].as_str())
        .unwrap_or("");
    let nome = fierium_catalogo::nome_do_arquivo(autor, item["titulo"].as_str().unwrap_or(""), formato);
    let destino = ctx.pasta_de_livros.join(nome);
    if !destino.exists() {
        // download sem segurar nenhum banco
        ctx.baixador.baixar(url, &destino)?;
    }
    std::fs::create_dir_all(&ctx.pasta_de_livros).map_err(|e| ErroFierium::de_io(ctx.pasta_de_livros.display(), e))?;
    {
        let mut b = ctx.biblioteca.lock().expect("biblioteca");
        b.pastas_adicionar(&ctx.pasta_de_livros.to_string_lossy())?;
        b.varrer()?;
    }
    ctx.registrar_arquivos()?;
    let achado = ctx.biblioteca.lock().expect("biblioteca").edicao_do_caminho(&destino)?;
    let (obra, edicao) = achado.ok_or_else(|| {
        ErroFierium::NaoEncontrado(format!(
            "o livro baixado não entrou na biblioteca ({})",
            destino.display()
        ))
    })?;
    Ok(serde_json::json!({ "obraId": obra, "edicaoId": edicao }))
}

/// Pastas comuns de livros que existem no computador (só caminhos que são pastas).
fn sugestoes_de_pastas() -> Vec<String> {
    let Some(casa) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) else {
        return vec![];
    };
    let casa = std::path::PathBuf::from(casa);
    ["Livros", "Documentos", "Downloads", "Books", "Calibre Library"]
        .iter()
        .map(|n| casa.join(n))
        .filter(|p| p.is_dir())
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
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
        // o protocolo entrega pelo id do ARQUIVO (a edição pode ter mais de uma cópia)
        let arq = obras[0]["edicoes"][0]["arquivos"][0]["id"].as_str().unwrap();
        assert!(c.arquivos.caminho(arq).is_some());
        let f = chamar(&c, "edicao.abrir", json!({ "edicaoId": ed })).unwrap();
        assert_eq!(f["tipo"], "arquivo");
        assert!(f["url"].as_str().unwrap().ends_with(arq));
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
        assert!(c.arquivos.caminho(arq).is_none());
    }

    const CSV: &str = "Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves\n\
1,Text,2000-01-01,Memórias Póstumas de Brás Cubas,pt,\"Machado de Assis, 1839-1908\",Satire,PQ,\n\
2,Text,2000-01-01,Dom Casmurro,pt,\"Assis, Machado de, 1839-1908\",Fiction,PQ,\n\
3,Sound,2000-01-01,Um áudio,en,\"Fulano, Beltrano\",,,\n\
4,Text,2000-01-01,Frankenstein,en,\"Shelley, Mary, 1797-1851\",Science fiction,PR,\n";

    /// Baixador de mentira: serve o CSV de exemplo e um "EPUB" de poucos bytes, sem rede.
    struct Falso;
    impl Baixador for Falso {
        fn baixar(&self, url: &str, destino: &Path) -> Result<u64, ErroFierium> {
            let corpo: &[u8] = if url.ends_with("pg_catalog.csv") {
                CSV.as_bytes()
            } else {
                b"PK-epub-falso"
            };
            std::fs::create_dir_all(destino.parent().unwrap()).unwrap();
            std::fs::write(destino, corpo).unwrap();
            Ok(corpo.len() as u64)
        }
    }

    fn contexto_falso() -> (tempfile::TempDir, Contexto) {
        let d = tempfile::tempdir().unwrap();
        let mut c = Contexto::abrir(d.path()).unwrap();
        c.baixador = Box::new(Falso);
        c.pasta_de_livros = d.path().join("livros");
        c.pasta_de_cache = d.path().join("cache");
        (d, c)
    }

    #[test]
    fn catalogo_atualizar_buscar_e_obra_id() {
        let (_d, c) = contexto_falso();
        let f = chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap();
        assert_eq!(f["itens"], 3);
        assert_eq!(chamar(&c, "catalogo.fontes", json!({})).unwrap()[0]["itens"], 3);
        let r = chamar(&c, "catalogo.buscar", json!({ "texto": "memorias postumas" })).unwrap();
        assert_eq!(r["total"], 1);
        assert!(r["itens"][0].get("obraId").is_none());
        assert_eq!(
            chamar(&c, "catalogo.atualizar", json!({ "fonte": "nao-existe" }))
                .unwrap_err()
                .codigo(),
            "NAO_ENCONTRADO"
        );
        // a pessoa já tem a obra (arquivo com o mesmo título e autor): o item aparece colorido
        let livros = tempfile::tempdir().unwrap();
        std::fs::write(
            livros
                .path()
                .join("Machado de Assis - Memórias Póstumas de Brás Cubas.pdf"),
            b"%PDF-falso",
        )
        .unwrap();
        chamar(
            &c,
            "pastas.adicionar",
            json!({ "caminho": livros.path().to_str().unwrap() }),
        )
        .unwrap();
        chamar(&c, "biblioteca.varrer", json!({})).unwrap();
        let obras = chamar(&c, "obras.listar", json!({})).unwrap();
        let r = chamar(&c, "catalogo.buscar", json!({ "texto": "machado assis" })).unwrap();
        let com: Vec<_> = r["itens"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|i| i.get("obraId").is_some())
            .collect();
        assert_eq!(com.len(), 1);
        assert_eq!(com[0]["id"], "gutenberg:1");
        assert_eq!(com[0]["obraId"], obras[0]["id"]);
        let i = chamar(&c, "catalogo.item", json!({ "id": "gutenberg:1" })).unwrap();
        assert_eq!(i["obraId"], obras[0]["id"]);
    }

    #[test]
    fn rede_desligada_da_sem_rede() {
        let (_d, c) = contexto_falso();
        assert_eq!(chamar(&c, "rede.ler", json!({})).unwrap()["permitida"], true);
        chamar(&c, "rede.definir", json!({ "permitida": false })).unwrap();
        assert_eq!(chamar(&c, "rede.ler", json!({})).unwrap()["permitida"], false);
        let e = chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap_err();
        assert_eq!(e.codigo(), "SEM_REDE");
        let e = chamar(&c, "catalogo.baixar", json!({ "id": "gutenberg:1" })).unwrap_err();
        assert_eq!(e.codigo(), "SEM_REDE");
        assert!(!c.pasta_de_livros.exists());
    }

    #[test]
    fn baixar_grava_o_arquivo_e_entra_na_biblioteca() {
        let (_d, c) = contexto_falso();
        chamar(&c, "catalogo.atualizar", json!({ "fonte": "gutenberg" })).unwrap();
        let r = chamar(&c, "catalogo.baixar", json!({ "id": "gutenberg:1" })).unwrap();
        let arq = c
            .pasta_de_livros
            .join("Machado de Assis - Memórias Póstumas de Brás Cubas.epub");
        assert_eq!(std::fs::read(&arq).unwrap(), b"PK-epub-falso");
        let obra = chamar(&c, "obra.obter", json!({ "id": r["obraId"] })).unwrap();
        assert_eq!(obra["edicoes"][0]["id"], r["edicaoId"]);
        assert_eq!(
            chamar(&c, "pastas.listar", json!({}))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
        // agora o item do catálogo aponta pra obra
        let i = chamar(&c, "catalogo.item", json!({ "id": "gutenberg:1" })).unwrap();
        assert_eq!(i["obraId"], r["obraId"]);
        // baixar de novo não duplica
        let r2 = chamar(&c, "catalogo.baixar", json!({ "id": "gutenberg:1" })).unwrap();
        assert_eq!(r2, r);
        assert_eq!(
            chamar(&c, "catalogo.baixar", json!({ "id": "gutenberg:999" }))
                .unwrap_err()
                .codigo(),
            "NAO_ENCONTRADO"
        );
    }
}
