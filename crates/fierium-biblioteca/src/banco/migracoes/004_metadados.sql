-- 004: metadados de dentro dos arquivos, série/ano/criadores, sugestões e cache da rede
ALTER TABLE obras ADD COLUMN serie TEXT;
ALTER TABLE obras ADD COLUMN volume REAL;
ALTER TABLE obras ADD COLUMN ano INTEGER;
ALTER TABLE obras ADD COLUMN editada INTEGER NOT NULL DEFAULT 0;
ALTER TABLE obras ADD COLUMN criadores TEXT;
ALTER TABLE edicoes ADD COLUMN meta TEXT;
ALTER TABLE edicoes ADD COLUMN capa TEXT;
ALTER TABLE edicoes ADD COLUMN meta_v INTEGER NOT NULL DEFAULT 0;
CREATE TABLE sugestoes (
   obra_id TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (obra_id, id));
CREATE TABLE cache_rede (consulta TEXT PRIMARY KEY, resposta TEXT NOT NULL, em INTEGER NOT NULL);
