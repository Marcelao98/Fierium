// @fierium/leitor-base — a tomada dos leitores (MotorDeLeitura/SessaoLeitura), os tipos comuns, o registro sob demanda,
// os modos de leitura e o Pintor de temas. Sem React e sem pdf.js/epub.js: cada formato mora no seu pacote.
export * from './motor';
export * from './registro';
export * from './pintor/index';
export * from './modos/index';
export { agruparLinhas, criarDestaque, intersecta, type Pedaco } from './comum/linhas';
