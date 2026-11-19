import { criarLog } from '@fierium/diagnostico';
import { describe, expect, it } from 'vitest';
import { linhasDoLog, linkDoGitHub, montarMensagem, tituloDaSugestao } from './sugestao';

const log = () => {
  const l = criarLog({ agora: () => new Date(2026, 10, 7, 20, 5, 9).getTime() });
  l.registrar('debug', 'evento', 'ruído que não entra');
  l.registrar('info', 'app', 'Fierium aberto');
  l.registrar('erro', 'comando', 'obra.obter falhou: NAO_ENCONTRADO');
  return l.recentes();
};

describe('sugestão ou problema', () => {
  it('as linhas do log pulam a depuração e levam hora, nível e origem', () => {
    expect(linhasDoLog(log())).toEqual([
      '20:05:09 info [app] Fierium aberto',
      '20:05:09 erro [comando] obra.obter falhou: NAO_ENCONTRADO',
    ]);
  });
  it('só as últimas N linhas entram', () => {
    const l = criarLog();
    for (let i = 0; i < 40; i++) l.registrar('info', 'x', `linha ${i}`);
    const linhas = linhasDoLog(l.recentes(), 15);
    expect(linhas).toHaveLength(15);
    expect(linhas.at(-1)).toContain('linha 39');
  });
  it('a mensagem junta o texto, a versão, o sistema e o log', () => {
    const m = montarMensagem({
      texto: 'A tela ficou branca',
      versao: '0.2.0',
      plataforma: 'linux',
      sistema: 'Mozilla/5.0 (X11; Linux)',
      log: log(),
    });
    expect(m).toContain('A tela ficou branca');
    expect(m).toContain('Fierium 0.2.0 · linux');
    expect(m).toContain('Sistema: Mozilla/5.0 (X11; Linux)');
    expect(m).toContain('erro [comando] obra.obter falhou');
    expect(m).not.toContain('ruído');
  });
  it('sem texto a mensagem pede pra escrever (não manda vazio)', () => {
    const m = montarMensagem({ texto: '  ', versao: '', plataforma: '', sistema: 'x', log: [] });
    expect(m).toContain('escreva aqui');
    expect(m).toContain('(nenhuma)');
  });
  it('o link do GitHub leva título e corpo codificados e só o endereço de issue nova', () => {
    const texto = 'Não abre\nmais detalhes';
    const msg = montarMensagem({ texto, versao: '1', plataforma: 'p', sistema: 's', log: [] });
    const url = new URL(linkDoGitHub(texto, msg));
    expect(url.origin + url.pathname).toBe('https://github.com/Marcelao98/Fierium/issues/new');
    expect(url.searchParams.get('title')).toBe('Não abre');
    expect(url.searchParams.get('body')).toContain('mais detalhes');
  });
  it('título longo é cortado', () => {
    expect(tituloDaSugestao('a'.repeat(200))).toHaveLength(68);
    expect(tituloDaSugestao('')).toBe('Sugestão ou problema');
  });
});
