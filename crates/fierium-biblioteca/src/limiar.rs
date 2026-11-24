//! A tela de início ("limiar"): onde parei, em andamento, novidades, esquecidas e o eco.
use crate::banco::Biblioteca;
use crate::obras::ObraLinha;
use crate::{agora, LIDA};
use fierium_core::ErroFierium;
use serde_json::{json, Value};

impl Biblioteca {
    pub fn limiar(&self) -> Result<Value, ErroFierium> {
        let todas = self.todas(true)?;
        let mut por_leitura: Vec<&ObraLinha> = todas.iter().filter(|o| o.ultima_leitura.is_some()).collect();
        por_leitura.sort_by_key(|o| std::cmp::Reverse(o.ultima_leitura));
        let ultimo = por_leitura.iter().find(|o| o.fracao() < LIDA).map(|o| o.json());
        let mut lendo: Vec<&ObraLinha> = todas.iter().filter(|o| o.estado == "lendo").collect();
        lendo.sort_by_key(|o| std::cmp::Reverse(o.ultima_leitura));
        let mut novas: Vec<&ObraLinha> = todas.iter().collect();
        novas.sort_by(|a, b| (b.adicionada_em, &b.id).cmp(&(a.adicionada_em, &a.id)));
        let mut velhas: Vec<&ObraLinha> = todas.iter().filter(|o| o.ultima_leitura.is_none()).collect();
        velhas.sort_by(|a, b| (a.adicionada_em, &a.id).cmp(&(b.adicionada_em, &b.id)));
        let lista = |v: &[&ObraLinha], n: usize| Value::Array(v.iter().take(n).map(|o| o.json()).collect());
        Ok(json!({
            "ultimo": ultimo,
            "emAndamento": lista(&lendo, 12),
            "eco": self.eco(agora())?,
            "novidades": lista(&novas, 12),
            "esquecidas": lista(&velhas, 3),
            "totalObras": todas.len(),
        }))
    }
}
