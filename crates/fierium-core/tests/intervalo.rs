use fierium_core::intervalo::{interpretar, ler, Intervalo, MAX_PEDACO};
use std::io::Write;

#[test]
fn formas_do_cabecalho_range() {
    let i = |a, b| Ok(Intervalo { inicio: a, fim: b });
    assert_eq!(interpretar(Some("bytes=10-19"), 100).map_err(|e| e.codigo()), i(10, 19));
    assert_eq!(interpretar(Some("bytes=90-"), 100).map_err(|e| e.codigo()), i(90, 99));
    assert_eq!(interpretar(Some("bytes=-5"), 100).map_err(|e| e.codigo()), i(95, 99));
    assert_eq!(
        interpretar(Some("bytes=50-500"), 100).map_err(|e| e.codigo()),
        i(50, 99)
    );
    assert_eq!(interpretar(None, 100).map_err(|e| e.codigo()), i(0, 99));
}

#[test]
fn pedido_errado_tem_codigo() {
    let c = |r: &str| interpretar(Some(r), 100).unwrap_err().codigo();
    assert_eq!(c("bytes=100-"), "FORA_DO_ARQUIVO");
    assert_eq!(c("bytes=20-10"), "FORA_DO_ARQUIVO");
    assert_eq!(c("linhas=1-2"), "ARGUMENTO_INVALIDO");
    assert_eq!(c("bytes=1-2,5-6"), "ARGUMENTO_INVALIDO");
    assert_eq!(c("bytes=x-2"), "ARGUMENTO_INVALIDO");
}

#[test]
fn arquivo_grande_vem_aos_pedacos_sem_ler_tudo() {
    // 500 MB "esparsos": o arquivo existe com esse tamanho, mas o teste não grava nem lê 500 MB
    let mut f = tempfile::NamedTempFile::new().unwrap();
    let total: u64 = 500 << 20;
    f.as_file().set_len(total).unwrap();
    f.as_file_mut().seek_write_fim(total - 4, b"%EOF");
    let sem_range = interpretar(None, total).unwrap();
    assert_eq!(
        sem_range.tamanho(),
        MAX_PEDACO,
        "sem Range devolve só o primeiro pedaço"
    );
    let fim = interpretar(Some("bytes=-4"), total).unwrap();
    assert_eq!(ler(f.path(), fim).unwrap(), b"%EOF");
}

trait EscreverNoFim {
    fn seek_write_fim(&mut self, pos: u64, dados: &[u8]);
}
impl EscreverNoFim for std::fs::File {
    fn seek_write_fim(&mut self, pos: u64, dados: &[u8]) {
        use std::io::{Seek, SeekFrom};
        self.seek(SeekFrom::Start(pos)).unwrap();
        self.write_all(dados).unwrap();
    }
}
