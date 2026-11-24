-- 001: pastas, arquivos, obras (uma por arquivo, no começo) e progresso
CREATE TABLE pastas (caminho TEXT PRIMARY KEY, adicionada_em INTEGER NOT NULL);
CREATE TABLE arquivos (
   id TEXT PRIMARY KEY, pasta TEXT NOT NULL, caminho_rel TEXT NOT NULL, nome TEXT NOT NULL,
   formato TEXT NOT NULL, tamanho INTEGER NOT NULL, impressao TEXT NOT NULL,
   existe INTEGER NOT NULL DEFAULT 1, visto_em INTEGER NOT NULL);
CREATE INDEX arquivos_impressao ON arquivos (impressao);
CREATE TABLE obras (
   id TEXT PRIMARY KEY, arquivo_id TEXT NOT NULL UNIQUE REFERENCES arquivos(id),
   titulo TEXT NOT NULL, autor TEXT NOT NULL, matiz INTEGER NOT NULL,
   adicionada_em INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT 'nao-lida',
   favorita INTEGER NOT NULL DEFAULT 0, ultima_leitura INTEGER, terminada_em INTEGER);
CREATE TABLE progresso (
   edicao_id TEXT PRIMARY KEY REFERENCES arquivos(id), posicao TEXT NOT NULL,
   fracao REAL NOT NULL, quando INTEGER NOT NULL);
