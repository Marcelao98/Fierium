//! Importar uma fonte no banco: troca tudo o que veio dela numa transação só.
use crate::banco::Catalogo;
use crate::{agora, bd, Fonte, ItemNovo};
use fierium_core::ErroFierium;
use rusqlite::params;
use serde_json::Value;

impl Catalogo {
    /// Troca tudo o que veio de `fonte` pelos `itens`, numa transação só (se algo falhar, o catálogo antigo fica).
    pub fn importar(&mut self, fonte: &dyn Fonte, itens: &[ItemNovo]) -> Result<Value, ErroFierium> {
        self.importar_avisando(fonte, itens, &mut |_| {})
    }

    /// O mesmo, avisando quantos itens já entraram (a cada mil).
    pub fn importar_avisando(
        &mut self,
        fonte: &dyn Fonte,
        itens: &[ItemNovo],
        aviso: &mut dyn FnMut(usize),
    ) -> Result<Value, ErroFierium> {
        let fid = fonte.id();
        let tx = self.bd.transaction().map_err(bd)?;
        for t in ["pessoas", "assuntos", "identificadores", "ofertas"] {
            tx.execute(
                &format!("DELETE FROM {t} WHERE item IN (SELECT id FROM itens WHERE fonte = ?1)"),
                params![fid],
            )
            .map_err(bd)?;
        }
        tx.execute(
            "DELETE FROM busca WHERE item IN (SELECT id FROM itens WHERE fonte = ?1)",
            params![fid],
        )
        .map_err(bd)?;
        tx.execute("DELETE FROM itens WHERE fonte = ?1", params![fid])
            .map_err(bd)?;
        {
            let mut i_item = tx
                .prepare(
                    "INSERT OR REPLACE INTO itens (id, fonte, tipo, titulo, idioma, ano, sinopse, serie_nome,
                        serie_volume, capa) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                )
                .map_err(bd)?;
            let mut i_pes = tx
                .prepare("INSERT INTO pessoas (item, nome, papel, ordem) VALUES (?1,?2,?3,?4)")
                .map_err(bd)?;
            let mut i_ass = tx
                .prepare("INSERT INTO assuntos (item, assunto) VALUES (?1,?2)")
                .map_err(bd)?;
            let mut i_ide = tx
                .prepare("INSERT INTO identificadores (item, esquema, valor) VALUES (?1,?2,?3)")
                .map_err(bd)?;
            let mut i_ofe = tx
                .prepare("INSERT INTO ofertas (item, fonte, formato, url, licenca, tamanho) VALUES (?1,?2,?3,?4,?5,?6)")
                .map_err(bd)?;
            let mut i_bus = tx
                .prepare("INSERT INTO busca (item, titulo, pessoas, assuntos) VALUES (?1,?2,?3,?4)")
                .map_err(bd)?;
            for (feitos, it) in itens.iter().enumerate() {
                if feitos % 1000 == 0 {
                    aviso(feitos);
                }
                let id = format!("{fid}:{}", it.id);
                i_item
                    .execute(params![
                        id,
                        fid,
                        it.tipo,
                        it.titulo,
                        it.idioma,
                        it.ano,
                        it.sinopse,
                        it.serie.as_ref().map(|s| s.0.clone()),
                        it.serie.as_ref().map(|s| s.1),
                        it.capa
                    ])
                    .map_err(bd)?;
                for (n, p) in it.pessoas.iter().enumerate() {
                    i_pes.execute(params![id, p.nome, p.papel, n as i64]).map_err(bd)?;
                }
                for a in &it.assuntos {
                    i_ass.execute(params![id, a]).map_err(bd)?;
                }
                for (e, v) in &it.identificadores {
                    i_ide.execute(params![id, e, v]).map_err(bd)?;
                }
                for o in &it.ofertas {
                    i_ofe
                        .execute(params![id, o.fonte, o.formato, o.url, o.licenca, o.tamanho])
                        .map_err(bd)?;
                }
                let pessoas = it
                    .pessoas
                    .iter()
                    .map(|p| p.nome.as_str())
                    .collect::<Vec<_>>()
                    .join(" ; ");
                i_bus
                    .execute(params![id, it.titulo, pessoas, it.assuntos.join(" ; ")])
                    .map_err(bd)?;
            }
        }
        tx.execute(
            "INSERT INTO fontes (id, nome, ligada, atualizada_em) VALUES (?1,?2,1,?3)
             ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, atualizada_em = excluded.atualizada_em",
            params![fid, fonte.nome(), agora()],
        )
        .map_err(bd)?;
        tx.commit().map_err(bd)?;
        self.fonte(fid)
    }
}
