-- 003: a busca por prefixo ("al" -> Alice, Alienista…) com índice de prefixos de 1 a 3 letras no FTS5. Sem ele, um
-- prefixo curto varre milhares de termos; com ele, vai direto. A tabela é refeita com os mesmos dados.
CREATE VIRTUAL TABLE busca_nova USING fts5(
   item UNINDEXED, titulo, pessoas, assuntos, tokenize = 'unicode61 remove_diacritics 2', prefix = '1 2 3');
INSERT INTO busca_nova (item, titulo, pessoas, assuntos) SELECT item, titulo, pessoas, assuntos FROM busca;
DROP TABLE busca;
ALTER TABLE busca_nova RENAME TO busca;
