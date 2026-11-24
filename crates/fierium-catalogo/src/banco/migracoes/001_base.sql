-- 001: itens, pessoas, assuntos, identificadores, ofertas, fontes, config e a busca FTS5
CREATE TABLE itens (
   id TEXT PRIMARY KEY, fonte TEXT NOT NULL, tipo TEXT NOT NULL, titulo TEXT NOT NULL,
   idioma TEXT NOT NULL, ano INTEGER, sinopse TEXT, serie_nome TEXT, serie_volume INTEGER,
   capa TEXT);
CREATE INDEX itens_fonte ON itens (fonte);
CREATE TABLE pessoas (
   item TEXT NOT NULL REFERENCES itens(id), nome TEXT NOT NULL, papel TEXT NOT NULL,
   ordem INTEGER NOT NULL);
CREATE INDEX pessoas_item ON pessoas (item);
CREATE TABLE assuntos (item TEXT NOT NULL REFERENCES itens(id), assunto TEXT NOT NULL);
CREATE INDEX assuntos_item ON assuntos (item);
CREATE TABLE identificadores (
   item TEXT NOT NULL REFERENCES itens(id), esquema TEXT NOT NULL, valor TEXT NOT NULL);
CREATE INDEX identificadores_item ON identificadores (item);
CREATE INDEX identificadores_valor ON identificadores (esquema, valor);
CREATE TABLE ofertas (
   item TEXT NOT NULL REFERENCES itens(id), fonte TEXT NOT NULL, formato TEXT NOT NULL,
   url TEXT NOT NULL, licenca TEXT NOT NULL CHECK (length(licenca) > 0), tamanho INTEGER);
CREATE INDEX ofertas_item ON ofertas (item);
CREATE TABLE fontes (
   id TEXT PRIMARY KEY, nome TEXT NOT NULL, ligada INTEGER NOT NULL DEFAULT 1,
   atualizada_em INTEGER);
CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE VIRTUAL TABLE busca USING fts5(
   item UNINDEXED, titulo, pessoas, assuntos, tokenize = 'unicode61 remove_diacritics 2');
