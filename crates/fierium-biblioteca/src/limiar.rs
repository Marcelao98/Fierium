//! A tela de início ("limiar"): onde parei, em andamento, novidades, esquecidas e o eco.
//! Só o resumo leve da estante é lido pra escolher; o JSON pesado sai só das ~30 obras que aparecem.
use crate::banco::Biblioteca;
use crate::obras::Resumo;
use crate::{agora, LIDA};
use fierium_core::ErroFierium;
use serde_json::{json, Value};
use std::cmp::Reverse;
use std::collections::HashMap;

impl Biblioteca {
    pub fn limiar(&self) -> Result<Value, ErroFierium> {
        let todas = self.resumos(None, false, None, true)?;
        let mut por_leitura: Vec<&Resumo> = todas.iter().filter(|o| o.ultima_leitura.is_some()).collect();
        por_leitura.sort_by_key(|o| Reverse(o.ultima_leitura));
        let ultimo = por_leitura.iter().find(|o| o.fracao < LIDA).copied();
        let mut lendo: Vec<&Resumo> = todas.iter().filter(|o| o.estado == "lendo").collect();
        lendo.sort_by_key(|o| Reverse(o.ultima_leitura));
        let mut novas: Vec<&Resumo> = todas.iter().collect();
        novas.sort_by(|a, b| (b.adicionada_em, &b.id).cmp(&(a.adicionada_em, &a.id)));
        let mut velhas: Vec<&Resumo> = todas.iter().filter(|o| o.ultima_leitura.is_none()).collect();
        velhas.sort_by(|a, b| (a.adicionada_em, &a.id).cmp(&(b.adicionada_em, &b.id)));

        let lendo: Vec<&Resumo> = lendo.into_iter().take(12).collect();
        let novas: Vec<&Resumo> = novas.into_iter().take(12).collect();
        let velhas: Vec<&Resumo> = velhas.into_iter().take(3).collect();
        // uma carga só pras obras que aparecem (sem repetir)
        let mut ids: Vec<String> = Vec::new();
        for o in ultimo.iter().chain(&lendo).chain(&novas).chain(&velhas) {
            if !ids.contains(&o.id) {
                ids.push(o.id.clone());
            }
        }
        let carregadas: HashMap<String, Value> = self
            .carregar_obras(Some(&ids))?
            .iter()
            .map(|o| (o.id.clone(), o.json()))
            .collect();
        let lista = |v: &[&Resumo]| Value::Array(v.iter().filter_map(|o| carregadas.get(&o.id).cloned()).collect());
        Ok(json!({
            "ultimo": ultimo.and_then(|o| carregadas.get(&o.id).cloned()),
            "emAndamento": lista(&lendo),
            "eco": self.eco(agora())?,
            "novidades": lista(&novas),
            "esquecidas": lista(&velhas),
            "totalObras": todas.len(),
        }))
    }
}
