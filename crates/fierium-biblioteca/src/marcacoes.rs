//! Marcações (destaques, notas, marcadores de página), a busca (Ctrl+K) e o "eco" do limiar.
//! Mesmo comportamento do exemplo em memória (`packages/cliente/src/memoria/marcacoes.ts` e `busca.ts`);
//! JSON camelCase igual ao tipo `Marcacao` do contrato.
use super::{agora, bd, normalizar, novo_id, Biblioteca};
use fierium_core::ErroFierium;
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};

pub(crate) const DIA_MS: i64 = 86_400_000;
const COLUNAS: &str =
    "id, obra_id, edicao_id, tipo, ancora, trecho, cor, nota, etiquetas, ligacoes, criada_em, editada_em";

fn json_de(texto: String) -> Value {
    serde_json::from_str(&texto).unwrap_or(Value::Null)
}

fn ler(r: &rusqlite::Row) -> rusqlite::Result<Value> {
    let mut m = json!({
        "id": r.get::<_, String>(0)?,
        "obraId": r.get::<_, String>(1)?,
        "edicaoId": r.get::<_, String>(2)?,
        "tipo": r.get::<_, String>(3)?,
        "ancora": json_de(r.get(4)?),
        "trecho": r.get::<_, String>(5)?,
        "cor": r.get::<_, String>(6)?,
        "etiquetas": json_de(r.get(8)?),
        "ligacoes": json_de(r.get(9)?),
        "criadaEm": r.get::<_, i64>(10)?,
        "editadaEm": r.get::<_, i64>(11)?,
    });
    if let Some(n) = r.get::<_, Option<String>>(7)? {
        m["nota"] = json!(n);
    }
    Ok(m)
}

fn texto<'a>(a: &'a Value, campo: &str) -> Result<&'a str, ErroFierium> {
    a[campo]
        .as_str()
        .ok_or_else(|| ErroFierium::argumento(campo, "tem que ser texto"))
}

fn lista_de_textos(a: &Value, campo: &str) -> Result<Vec<String>, ErroFierium> {
    match &a[campo] {
        Value::Null => Ok(vec![]),
        Value::Array(v) => v
            .iter()
            .map(|x| {
                x.as_str()
                    .map(String::from)
                    .ok_or_else(|| ErroFierium::argumento(campo, "tem que ser uma lista de textos"))
            })
            .collect(),
        _ => Err(ErroFierium::argumento(campo, "tem que ser uma lista de textos")),
    }
}

impl Biblioteca {
    fn marcacao_ou_erro(&self, id: &str) -> Result<Value, ErroFierium> {
        self.bd
            .query_row(
                &format!("SELECT {COLUNAS} FROM marcacoes WHERE id = ?1 AND apagado_em IS NULL"),
                params![id],
                ler,
            )
            .optional()
            .map_err(bd)?
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("marcação {id}")))
    }

    pub(crate) fn todas_marcacoes(&self) -> Result<Vec<Value>, ErroFierium> {
        let mut st = self
            .bd
            .prepare(&format!(
                "SELECT {COLUNAS} FROM marcacoes WHERE apagado_em IS NULL ORDER BY criada_em DESC, id DESC"
            ))
            .map_err(bd)?;
        let v = st
            .query_map([], ler)
            .map_err(bd)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(bd)?;
        Ok(v)
    }

    pub fn marcacoes_listar(&self, filtro: &Value) -> Result<Value, ErroFierium> {
        let obra = filtro["obraId"].as_str().filter(|s| !s.is_empty());
        let cor = filtro["cor"].as_str().filter(|s| !s.is_empty());
        let busca = normalizar(filtro["texto"].as_str().unwrap_or(""));
        let palavras: Vec<&str> = busca.split_whitespace().collect();
        let v = self.todas_marcacoes()?.into_iter().filter(|m| {
            obra.is_none_or(|o| m["obraId"] == o) && cor.is_none_or(|c| m["cor"] == c) && {
                let alvo = normalizar(&format!(
                    "{} {}",
                    m["trecho"].as_str().unwrap_or(""),
                    m["nota"].as_str().unwrap_or("")
                ));
                palavras.iter().all(|p| alvo.contains(p))
            }
        });
        Ok(Value::Array(v.collect()))
    }

    pub fn marcacao_criar(&self, a: &Value) -> Result<Value, ErroFierium> {
        let obra_id = texto(a, "obraId")?;
        let edicao_id = texto(a, "edicaoId")?;
        let tipo = texto(a, "tipo")?;
        if !["destaque", "nota", "marcador"].contains(&tipo) {
            return Err(ErroFierium::argumento("tipo", format!("tipo desconhecido: {tipo}")));
        }
        if !a["ancora"].is_object() || a["ancora"]["tipo"].as_str().is_none() {
            return Err(ErroFierium::argumento("ancora", "tem que ser uma âncora com tipo"));
        }
        let trecho = texto(a, "trecho")?;
        if trecho.trim().is_empty() && tipo == "destaque" {
            return Err(ErroFierium::argumento("trecho", "marcação sem trecho"));
        }
        let cor = texto(a, "cor")?;
        let nota = a["nota"].as_str().filter(|n| !n.trim().is_empty());
        let etiquetas = lista_de_textos(a, "etiquetas")?;
        let ligacoes = lista_de_textos(a, "ligacoes")?;
        let achou: Option<String> = self
            .bd
            .query_row(
                "SELECT obra_id FROM edicoes WHERE obra_id = ?1 AND id = ?2",
                params![obra_id, edicao_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(bd)?;
        if achou.is_none() {
            return Err(ErroFierium::NaoEncontrado(format!(
                "edição {edicao_id} da obra {obra_id}"
            )));
        }
        let id = novo_id();
        let t = agora();
        self.bd
            .execute(
                "INSERT INTO marcacoes (id, obra_id, edicao_id, tipo, ancora, trecho, cor, nota, etiquetas, ligacoes,
                    criada_em, editada_em) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)",
                params![
                    id,
                    obra_id,
                    edicao_id,
                    tipo,
                    a["ancora"].to_string(),
                    trecho,
                    cor,
                    nota,
                    json!(etiquetas).to_string(),
                    json!(ligacoes).to_string(),
                    t
                ],
            )
            .map_err(bd)?;
        self.marcacao_ou_erro(&id)
    }

    pub fn marcacao_atualizar(&self, a: &Value) -> Result<Value, ErroFierium> {
        let id = texto(a, "id")?;
        self.marcacao_ou_erro(id)?;
        if let Some(c) = a.get("cor").filter(|c| !c.is_null()) {
            let c = c
                .as_str()
                .ok_or_else(|| ErroFierium::argumento("cor", "tem que ser texto"))?;
            self.bd
                .execute("UPDATE marcacoes SET cor = ?2 WHERE id = ?1", params![id, c])
                .map_err(bd)?;
        }
        if let Some(n) = a.get("nota").filter(|n| !n.is_null()) {
            let n = n
                .as_str()
                .ok_or_else(|| ErroFierium::argumento("nota", "tem que ser texto"))?;
            let n = if n.trim().is_empty() { None } else { Some(n) };
            self.bd
                .execute("UPDATE marcacoes SET nota = ?2 WHERE id = ?1", params![id, n])
                .map_err(bd)?;
        }
        for campo in ["etiquetas", "ligacoes"] {
            if a.get(campo).is_some_and(|v| !v.is_null()) {
                let l = lista_de_textos(a, campo)?;
                self.bd
                    .execute(
                        &format!("UPDATE marcacoes SET {campo} = ?2 WHERE id = ?1"),
                        params![id, json!(l).to_string()],
                    )
                    .map_err(bd)?;
            }
        }
        self.bd
            .execute(
                "UPDATE marcacoes SET editada_em = ?2 WHERE id = ?1",
                params![id, agora()],
            )
            .map_err(bd)?;
        self.marcacao_ou_erro(id)
    }

    pub fn marcacao_apagar(&self, id: &str) -> Result<(), ErroFierium> {
        self.marcacao_ou_erro(id)?;
        self.bd
            .execute(
                "UPDATE marcacoes SET apagado_em = ?2 WHERE id = ?1",
                params![id, agora()],
            )
            .map_err(bd)?;
        for m in self.todas_marcacoes()? {
            let ligs = m["ligacoes"].as_array().cloned().unwrap_or_default();
            if ligs.iter().any(|l| l == id) {
                let resto: Vec<&Value> = ligs.iter().filter(|l| *l != id).collect();
                self.bd
                    .execute(
                        "UPDATE marcacoes SET ligacoes = ?2 WHERE id = ?1",
                        params![m["id"].as_str().unwrap_or(""), json!(resto).to_string()],
                    )
                    .map_err(bd)?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::fs;

    fn montar() -> (tempfile::TempDir, tempfile::TempDir, Biblioteca, String, String) {
        let dados = tempfile::tempdir().unwrap();
        let livros = tempfile::tempdir().unwrap();
        fs::write(livros.path().join("Machado - Memórias Póstumas.pdf"), "%PDF-falso a").unwrap();
        let mut b = Biblioteca::abrir(&dados.path().join("fierium.db")).unwrap();
        b.pastas_adicionar(livros.path().to_str().unwrap()).unwrap();
        b.varrer().unwrap();
        let o = b.obras_listar(&json!({})).unwrap();
        let obra = o[0]["id"].as_str().unwrap().to_string();
        let ed = o[0]["edicoes"][0]["id"].as_str().unwrap().to_string();
        (dados, livros, b, obra, ed)
    }

    fn nova(b: &Biblioteca, obra: &str, ed: &str, trecho: &str, cor: &str) -> Value {
        b.marcacao_criar(&json!({
            "obraId": obra, "edicaoId": ed, "tipo": "destaque", "trecho": trecho, "cor": cor,
            "ancora": { "tipo": "pdf", "pagina": 2, "retangulos": [[0.1, 0.2, 0.3, 0.05]] },
            "etiquetas": [], "ligacoes": [],
        }))
        .unwrap()
    }

    fn definir_criada_em(b: &Biblioteca, id: &str, quando: i64) {
        b.bd.execute("UPDATE marcacoes SET criada_em = ?2 WHERE id = ?1", params![id, quando])
            .unwrap();
    }

    #[test]
    fn banco_v1_migra_ate_a_versao_atual_sem_perder_nada() {
        let dados = tempfile::tempdir().unwrap();
        let caminho = dados.path().join("fierium.db");
        {
            let c = rusqlite::Connection::open(&caminho).unwrap();
            c.execute_batch(
                "CREATE TABLE pastas (caminho TEXT PRIMARY KEY, adicionada_em INTEGER NOT NULL);
                 CREATE TABLE arquivos (id TEXT PRIMARY KEY, pasta TEXT NOT NULL, caminho_rel TEXT NOT NULL,
                    nome TEXT NOT NULL, formato TEXT NOT NULL, tamanho INTEGER NOT NULL, impressao TEXT NOT NULL,
                    existe INTEGER NOT NULL DEFAULT 1, visto_em INTEGER NOT NULL);
                 CREATE TABLE obras (id TEXT PRIMARY KEY, arquivo_id TEXT NOT NULL UNIQUE REFERENCES arquivos(id),
                    titulo TEXT NOT NULL, autor TEXT NOT NULL, matiz INTEGER NOT NULL, adicionada_em INTEGER NOT NULL,
                    estado TEXT NOT NULL DEFAULT 'nao-lida', favorita INTEGER NOT NULL DEFAULT 0,
                    ultima_leitura INTEGER, terminada_em INTEGER);
                 CREATE TABLE progresso (edicao_id TEXT PRIMARY KEY REFERENCES arquivos(id), posicao TEXT NOT NULL,
                    fracao REAL NOT NULL, quando INTEGER NOT NULL);
                 INSERT INTO arquivos VALUES ('a1','/p','l.pdf','l.pdf','pdf',10,'h',1,1);
                 INSERT INTO obras VALUES ('o1','a1','Livro Antigo','Ana',10,1,'lendo',0,5,NULL);
                 INSERT INTO progresso VALUES ('a1','7',0.4,5);
                 PRAGMA user_version = 1;",
            )
            .unwrap();
        }
        let b = Biblioteca::abrir(&caminho).unwrap();
        let o = b.obra_obter("o1").unwrap();
        assert_eq!(o["titulo"], "Livro Antigo");
        assert_eq!(o["edicoes"][0]["progresso"]["posicao"], "7");
        let m = nova(&b, "o1", "a1", "oi", "importante");
        assert_eq!(m["obraId"], "o1");
        let v: i64 = b.bd.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(v, super::super::VERSAO_BANCO);
    }

    #[test]
    fn criar_listar_filtrar_atualizar_e_apagar() {
        let (_d, _l, b, obra, ed) = montar();
        let a = nova(&b, &obra, &ed, "Ação tão Única", "duvida");
        let c = nova(&b, &obra, &ed, "Outro trecho", "ideia");
        assert_eq!(a["ancora"]["pagina"], 2);
        assert_eq!(a["etiquetas"], json!([]));
        assert!(a.get("nota").is_none());
        assert_eq!(a["criadaEm"], a["editadaEm"]);
        assert_eq!(b.marcacoes_listar(&json!({})).unwrap().as_array().unwrap().len(), 2);
        assert_eq!(
            b.marcacoes_listar(&json!({ "cor": "ideia" })).unwrap()[0]["id"],
            c["id"]
        );
        assert_eq!(b.marcacoes_listar(&json!({ "obraId": "x" })).unwrap(), json!([]));
        assert_eq!(
            b.marcacoes_listar(&json!({ "texto": "ACAO unica" })).unwrap()[0]["id"],
            a["id"]
        );
        let atual = b
            .marcacao_atualizar(&json!({
                "id": a["id"], "cor": "citacao", "nota": "Dúvida séria", "etiquetas": ["x"],
                "ligacoes": [c["id"]],
            }))
            .unwrap();
        assert_eq!(atual["cor"], "citacao");
        assert_eq!(atual["nota"], "Dúvida séria");
        assert_eq!(
            b.marcacoes_listar(&json!({ "texto": "duvida seria" }))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
        let limpa = b.marcacao_atualizar(&json!({ "id": a["id"], "nota": "  " })).unwrap();
        assert!(limpa.get("nota").is_none());
        b.marcacao_atualizar(&json!({ "id": c["id"], "ligacoes": [a["id"]] }))
            .unwrap();
        b.marcacao_apagar(a["id"].as_str().unwrap()).unwrap();
        assert_eq!(b.marcacoes_listar(&json!({})).unwrap().as_array().unwrap().len(), 1);
        assert_eq!(b.marcacoes_listar(&json!({})).unwrap()[0]["ligacoes"], json!([]));
        assert_eq!(
            b.marcacao_apagar(a["id"].as_str().unwrap()).unwrap_err().codigo(),
            "NAO_ENCONTRADO"
        );
        assert_eq!(
            b.marcacao_atualizar(&json!({ "id": "x" })).unwrap_err().codigo(),
            "NAO_ENCONTRADO"
        );
        let ruim = b.marcacao_criar(&json!({
            "obraId": obra, "edicaoId": ed, "tipo": "destaque", "trecho": " ", "cor": "x",
            "ancora": { "tipo": "pdf", "pagina": 1, "retangulos": [] }, "etiquetas": [], "ligacoes": [],
        }));
        assert_eq!(ruim.unwrap_err().codigo(), "ARGUMENTO_INVALIDO");
        let sem_edicao = b.marcacao_criar(&json!({
            "obraId": obra, "edicaoId": "nada", "tipo": "marcador", "trecho": "", "cor": "x",
            "ancora": { "tipo": "pdf", "pagina": 1, "retangulos": [] }, "etiquetas": [], "ligacoes": [],
        }));
        assert_eq!(sem_edicao.unwrap_err().codigo(), "NAO_ENCONTRADO");
    }

    #[test]
    fn busca_sem_acento_em_obras_e_marcacoes() {
        let (_d, _l, b, obra, ed) = montar();
        let m = nova(&b, &obra, &ed, "Trecho comum", "duvida");
        b.marcacao_atualizar(&json!({ "id": m["id"], "nota": "tenho uma dúvida aqui" }))
            .unwrap();
        assert_eq!(b.busca_tudo("   ").unwrap(), json!([]));
        let r = b.busca_tudo("duvida").unwrap();
        assert_eq!(r.as_array().unwrap().len(), 1);
        assert_eq!(r[0]["tipo"], "marcacao");
        assert_eq!(r[0]["obraId"], json!(obra));
        assert_eq!(r[0]["detalhe"], "Memórias Póstumas");
        let r = b.busca_tudo("MEMORIAS postumas").unwrap();
        assert_eq!(r[0]["tipo"], "obra");
        let r = b.busca_tudo("machado").unwrap();
        assert!(r.as_array().unwrap().iter().any(|x| x["tipo"] == "criador"));
    }

    #[test]
    fn eco_so_com_mais_de_30_dias_e_estavel_no_dia() {
        let (_d, _l, b, obra, ed) = montar();
        let agora_ms = 200 * DIA_MS + 5;
        assert_eq!(b.eco(agora_ms).unwrap(), Value::Null);
        let nova_m = nova(&b, &obra, &ed, "recente", "ideia");
        definir_criada_em(&b, nova_m["id"].as_str().unwrap(), agora_ms - DIA_MS);
        assert_eq!(b.eco(agora_ms).unwrap(), Value::Null);
        let velha = nova(&b, &obra, &ed, "antiga", "ideia");
        definir_criada_em(&b, velha["id"].as_str().unwrap(), agora_ms - 31 * DIA_MS);
        let e = b.eco(agora_ms).unwrap();
        assert_eq!(e["marcacao"]["id"], velha["id"]);
        assert_eq!(e["obra"]["id"], json!(obra));
        assert_eq!(b.eco(agora_ms + 1000).unwrap()["marcacao"]["id"], velha["id"]);
    }
}
