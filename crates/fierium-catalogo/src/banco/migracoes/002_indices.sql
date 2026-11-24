-- 002: índices pras consultas da tela
-- "Sem texto digitado" lista na ordem em que os itens entraram na fonte (número do id, depois título). O índice
-- tem a MESMA expressão da consulta (consultas.rs, POR_NUMERO) pra o SQLite andar nele já ordenado, sem ordenar 75 mil.
CREATE INDEX itens_por_numero ON itens (CAST(substr(id, instr(id, ':') + 1) AS INTEGER), titulo COLLATE NOCASE);
