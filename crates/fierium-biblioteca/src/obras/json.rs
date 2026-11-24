//! A obra com as edições e os arquivos, e o JSON dela (formato do contrato TypeScript).
use crate::metadados::Pessoa;
use crate::url_da_capa;
use serde::Deserialize;
use serde_json::{json, Value};

/// O pedaço dos metadados da edição que a estante mostra (o resto do JSON `meta` nem é construído).
#[derive(Deserialize, Default)]
#[serde(default)]
pub(crate) struct MetaLeve {
    pub idioma: String,
    pub assuntos: Vec<String>,
    pub paginas: Option<u32>,
}

/// O resumo leve de uma obra da estante: o que basta pra filtrar e ordenar sem carregar edições e arquivos.
pub(crate) struct Resumo {
    pub id: String,
    pub titulo: String,
    pub autor: String,
    pub estado: String,
    pub adicionada_em: i64,
    pub ultima_leitura: Option<i64>,
    /// quanto já foi lido (da edição lida por último)
    pub fracao: f64,
}

pub(crate) struct ArquivoLinha {
    pub id: String,
    pub nome: String,
    pub rel: String,
    pub tamanho: i64,
    pub existe: bool,
}

pub(crate) struct EdicaoLinha {
    pub id: String,
    pub formato: String,
    pub arquivos: Vec<ArquivoLinha>,
    pub progresso: Option<(String, f64, i64)>,
    pub meta: Option<MetaLeve>,
    pub tem_capa: bool,
}

impl EdicaoLinha {
    pub fn disponivel(&self) -> bool {
        self.arquivos.iter().any(|a| a.existe)
    }

    pub(crate) fn lida_em(&self) -> Option<i64> {
        self.progresso.as_ref().map(|p| p.2)
    }

    fn json(&self, obra_id: &str) -> Value {
        let mut e = json!({
            "id": self.id,
            "obraId": obra_id,
            "formato": self.formato,
            "idioma": self.meta.as_ref().map(|m| m.idioma.clone()).unwrap_or_default(),
            "descricao": "",
            "arquivos": self.arquivos.iter().map(|a| json!({
                "id": a.id,
                "nome": a.nome,
                "caminho": a.rel,
                "tamanho": a.tamanho,
                "disponivel": a.existe,
            })).collect::<Vec<_>>(),
        });
        if let Some(p) = self.meta.as_ref().and_then(|m| m.paginas) {
            e["paginas"] = json!(p);
        }
        if self.tem_capa {
            e["capa"] = json!(url_da_capa(&self.id));
        }
        if let Some((posicao, fracao, quando)) = &self.progresso {
            e["progresso"] = json!({ "posicao": posicao, "fracao": fracao, "quando": quando });
        }
        e
    }
}

pub(crate) struct ObraLinha {
    pub id: String,
    pub titulo: String,
    pub autor: String,
    pub matiz: i64,
    pub adicionada_em: i64,
    pub estado: String,
    pub favorita: bool,
    pub ultima_leitura: Option<i64>,
    pub terminada_em: Option<i64>,
    pub serie: Option<(String, f64)>,
    pub ano: Option<i64>,
    pub criadores: Option<Vec<Pessoa>>,
    /// a primeira é a que "Continuar"/"Ler" abre: a lida por último; nunca aberta, EPUB antes de PDF
    pub edicoes: Vec<EdicaoLinha>,
}

impl ObraLinha {
    pub fn json(&self) -> Value {
        let mut relacao = json!({
            "estado": self.estado,
            "favorita": self.favorita,
            "adicionadaEm": self.adicionada_em,
        });
        if let Some(u) = self.ultima_leitura {
            relacao["ultimaLeitura"] = json!(u);
        }
        if let Some(t) = self.terminada_em {
            relacao["terminadaEm"] = json!(t);
        }
        let criadores = match &self.criadores {
            Some(c) if !c.is_empty() => json!(c),
            _ if self.autor.is_empty() => json!([]),
            _ => json!([{ "nome": self.autor, "papel": "autor" }]),
        };
        let mut assuntos: Vec<String> = Vec::new();
        for m in self.edicoes.iter().filter_map(|e| e.meta.as_ref()) {
            for a in &m.assuntos {
                if !assuntos.contains(a) {
                    assuntos.push(a.clone());
                }
            }
        }
        let mut o = json!({
            "id": self.id,
            "titulo": self.titulo,
            "criadores": criadores,
            "assuntos": assuntos,
            "reino": "biblioteca",
            "matiz": self.matiz,
            "colecaoIds": [],
            "edicoes": self.edicoes.iter().map(|e| e.json(&self.id)).collect::<Vec<_>>(),
            "relacao": relacao,
        });
        if let Some((nome, volume)) = &self.serie {
            o["serie"] = json!({ "nome": nome, "volume": volume });
        }
        if let Some(a) = self.ano {
            o["ano"] = json!(a);
        }
        o
    }
}
