-- 005: índices pras consultas que as telas fazem (ver docs/ARQUITETURA.md, "Desempenho")

-- obras.listar / biblioteca.limiar: os arquivos de cada edição já na ordem em que a tela mostra, sem tabela
-- temporária e sem voltar na tabela (índice que cobre as colunas lidas). Substitui o índice só de edicao_id.
DROP INDEX arquivos_edicao;
CREATE INDEX arquivos_edicao_lista ON arquivos (edicao_id, existe DESC, caminho_rel, id, nome, tamanho);

-- pastas.listar conta os arquivos de cada pasta
CREATE INDEX arquivos_pasta ON arquivos (pasta, existe);

-- marcacoes.listar de uma obra e a busca: já na ordem (mais nova primeiro), só as vivas
CREATE INDEX marcacoes_obra_data ON marcacoes (obra_id, criada_em DESC, id DESC) WHERE apagado_em IS NULL;
CREATE INDEX marcacoes_recentes ON marcacoes (criada_em DESC, id DESC) WHERE apagado_em IS NULL;
