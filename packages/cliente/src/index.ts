export * from './cliente';
export { rastrear } from './rastreado';
export { criarClienteTauri, criarClienteCombinado, criarClienteSemSessoesDeDemonstracao, type Invocar } from './tauri';
export { criarClienteMemoria, CONFIG_PADRAO, type OpcoesMemoria } from './memoria/memoria';
export { normalizar, combina } from './memoria/normalizar';
// a biblioteca de exemplo também serve de dados pra vitrine e pros testes de componente
export { bibliotecaDeExemplo, CORES_PADRAO } from './memoria/dados-exemplo';
export { resumo as resumoEstatisticas } from './memoria/estatisticas';
