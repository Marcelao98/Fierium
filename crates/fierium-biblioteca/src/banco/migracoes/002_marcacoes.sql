-- 002: marcações (destaques, notas, marcadores de página)
CREATE TABLE marcacoes (
   id TEXT PRIMARY KEY, obra_id TEXT NOT NULL, edicao_id TEXT NOT NULL, tipo TEXT NOT NULL,
   ancora TEXT NOT NULL, trecho TEXT NOT NULL, cor TEXT NOT NULL, nota TEXT,
   etiquetas TEXT NOT NULL DEFAULT '[]', ligacoes TEXT NOT NULL DEFAULT '[]',
   criada_em INTEGER NOT NULL, editada_em INTEGER NOT NULL, apagado_em INTEGER);
CREATE INDEX marcacoes_obra ON marcacoes (obra_id);
