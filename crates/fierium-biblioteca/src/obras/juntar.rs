//! Juntar obras e separar uma edição, à mão. A varredura respeita as duas escolhas.
use super::relacao::{absorver_relacao, ler_relacao};
use crate::banco::Biblioteca;
use crate::{agora, bd, matiz_do_titulo, novo_id, titulo_e_autor};
use fierium_core::ErroFierium;
use rusqlite::{params, OptionalExtension};
use serde_json::Value;

impl Biblioteca {
    /// A varredura não desfaz: ela só decide a obra de arquivo NOVO, e os novos seguem as edições pra onde elas foram.
    pub fn obra_juntar(&self, ids: &[String]) -> Result<Value, ErroFierium> {
        let mut unicos: Vec<&String> = Vec::new();
        for id in ids {
            if !unicos.contains(&id) {
                unicos.push(id);
            }
        }
        if unicos.len() < 2 {
            return Err(ErroFierium::argumento(
                "ids",
                "preciso de duas obras diferentes pra juntar",
            ));
        }
        for id in &unicos {
            self.uma(id)?;
        }
        let alvo = unicos[0];
        let tx = self.bd.unchecked_transaction().map_err(bd)?;
        for outra in &unicos[1..] {
            let relacao = ler_relacao(&tx, "obras", outra)?;
            absorver_relacao(&tx, alvo, &relacao)?;
            tx.execute(
                "UPDATE edicoes SET obra_id = ?2 WHERE obra_id = ?1",
                params![outra, alvo],
            )
            .map_err(bd)?;
            tx.execute(
                "UPDATE marcacoes SET obra_id = ?2 WHERE obra_id = ?1",
                params![outra, alvo],
            )
            .map_err(bd)?;
            tx.execute("DELETE FROM obras WHERE id = ?1", params![outra])
                .map_err(bd)?;
        }
        tx.commit().map_err(bd)?;
        self.obra_obter(alvo)
    }

    /// Separa uma edição à mão: ela vira uma obra própria (com o progresso e as marcações dela) e fica marcada
    /// como separada, pra nenhuma varredura juntar de novo nem mandar arquivos novos atrás dela.
    pub fn edicao_separar(&self, edicao_id: &str) -> Result<Value, ErroFierium> {
        let obra_id: String = self
            .bd
            .query_row("SELECT obra_id FROM edicoes WHERE id = ?1", params![edicao_id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(bd)?
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("edição {edicao_id}")))?;
        let obra = self.uma(&obra_id)?;
        if obra.edicoes.len() < 2 {
            return Err(ErroFierium::argumento(
                "edicaoId",
                "esta é a única edição da obra: não há do que separar",
            ));
        }
        let edicao = obra
            .edicoes
            .iter()
            .find(|e| e.id == edicao_id)
            .ok_or_else(|| ErroFierium::NaoEncontrado(format!("edição {edicao_id}")))?;
        // o nome da obra nova vem do arquivo da edição (como numa obra recém-achada)
        let (autor, titulo) = match edicao.arquivos.first() {
            Some(a) => titulo_e_autor(&a.nome),
            None => (obra.autor.clone(), obra.titulo.clone()),
        };
        let (estado, lida_em) = match &edicao.progresso {
            Some((_, f, quando)) if *f >= crate::LIDA => ("lida", Some(*quando)),
            Some((_, _, quando)) => ("lendo", Some(*quando)),
            None => ("nao-lida", None),
        };
        let nova = novo_id();
        let tx = self.bd.unchecked_transaction().map_err(bd)?;
        tx.execute(
            "INSERT INTO obras (id, titulo, autor, matiz, adicionada_em, estado, ultima_leitura, terminada_em)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                nova,
                titulo,
                autor,
                matiz_do_titulo(&titulo),
                agora(),
                estado,
                lida_em,
                if estado == "lida" { lida_em } else { None }
            ],
        )
        .map_err(bd)?;
        tx.execute(
            "UPDATE edicoes SET obra_id = ?2, separada = 1 WHERE id = ?1",
            params![edicao_id, nova],
        )
        .map_err(bd)?;
        tx.execute(
            "UPDATE marcacoes SET obra_id = ?2 WHERE edicao_id = ?1",
            params![edicao_id, nova],
        )
        .map_err(bd)?;
        tx.commit().map_err(bd)?;
        self.obra_obter(&nova)
    }
}
