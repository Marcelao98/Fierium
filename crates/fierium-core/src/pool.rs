//! Um pool pequeno de conexões (ou de qualquer coisa cara de abrir) emprestadas por pedido.
//!
//! Escolha: guarda até `max` itens abertos; se chegarem mais pedidos ao mesmo tempo do que itens livres, o excesso
//! abre um item passageiro (abrir uma conexão só-leitura do SQLite em WAL custa décimos de milissegundo) que é
//! descartado ao devolver. Assim ninguém espera na fila de outra consulta lenta (uma busca grande não segura a
//! estante) e o banco não fica com dezenas de conexões abertas depois de um pico.
use crate::ErroFierium;
use std::ops::{Deref, DerefMut};
use std::sync::Mutex;

type Abrir<T> = Box<dyn Fn() -> Result<T, ErroFierium> + Send + Sync>;

pub struct Pool<T> {
    max: usize,
    abrir: Abrir<T>,
    livres: Mutex<Vec<T>>,
}

impl<T> Pool<T> {
    pub fn novo(max: usize, abrir: impl Fn() -> Result<T, ErroFierium> + Send + Sync + 'static) -> Self {
        Self {
            max: max.max(1),
            abrir: Box::new(abrir),
            livres: Mutex::new(Vec::new()),
        }
    }

    /// Empresta um item (o guardado, ou um novo). Volta ao pool quando o `Emprestado` sai de escopo.
    pub fn emprestar(&self) -> Result<Emprestado<'_, T>, ErroFierium> {
        let guardado = self.livres.lock().expect("pool").pop();
        let item = match guardado {
            Some(i) => i,
            None => (self.abrir)()?,
        };
        Ok(Emprestado {
            pool: self,
            item: Some(item),
        })
    }

    /// Quantos itens estão guardados (livres) agora.
    pub fn livres(&self) -> usize {
        self.livres.lock().expect("pool").len()
    }
}

pub struct Emprestado<'a, T> {
    pool: &'a Pool<T>,
    item: Option<T>,
}

impl<T> Deref for Emprestado<'_, T> {
    type Target = T;
    fn deref(&self) -> &T {
        self.item.as_ref().expect("item emprestado")
    }
}

impl<T> DerefMut for Emprestado<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        self.item.as_mut().expect("item emprestado")
    }
}

impl<T> Drop for Emprestado<'_, T> {
    fn drop(&mut self) {
        if let Some(i) = self.item.take() {
            let mut livres = self.pool.livres.lock().expect("pool");
            if livres.len() < self.pool.max {
                livres.push(i);
            }
        }
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    #[test]
    fn reaproveita_guarda_ate_o_maximo_e_descarta_o_excesso() {
        let abertos = Arc::new(AtomicUsize::new(0));
        let a = abertos.clone();
        let p = Pool::novo(2, move || Ok(a.fetch_add(1, Ordering::SeqCst)));
        {
            let x = p.emprestar().unwrap();
            let y = p.emprestar().unwrap();
            let z = p.emprestar().unwrap();
            assert_eq!(abertos.load(Ordering::SeqCst), 3);
            assert_eq!((*x, *y, *z), (0, 1, 2));
        }
        assert_eq!(p.livres(), 2);
        let _ = p.emprestar().unwrap();
        assert_eq!(abertos.load(Ordering::SeqCst), 3, "reaproveitou em vez de abrir outro");
    }
}
