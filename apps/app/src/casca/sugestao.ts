// "Mandar sugestão ou problema": monta o texto (o que a pessoa escreveu + versão, sistema e as últimas linhas do log da
// interface) e o link de uma issue nova no GitHub. Puro: nada é enviado daqui; a pessoa copia ou abre o link.
import type { Registro } from '@fierium/diagnostico';

export const REPOSITORIO_ISSUES = 'https://github.com/Marcelao98/Fierium/issues/new';

export interface EntradaSugestao {
  texto: string;
  versao: string;
  plataforma: string;
  /** o "user agent" do navegador/janela (diz o sistema e a versão do WebView) */
  sistema: string;
  log: readonly Registro[];
}

/** Quantas linhas do log entram (as mais recentes, sem as de depuração). */
export const LINHAS_DE_LOG = 15;

function hora(t: number): string {
  const d = new Date(t);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

/** As últimas linhas do log (info, aviso e erro), uma por linha, cada uma com no máximo 200 caracteres. */
export function linhasDoLog(log: readonly Registro[], max = LINHAS_DE_LOG): string[] {
  return log
    .filter((r) => r.nivel !== 'debug')
    .slice(-max)
    .map((r) => `${hora(r.quando)} ${r.nivel} [${r.origem}] ${r.mensagem}`.slice(0, 200));
}

export function montarMensagem(e: EntradaSugestao): string {
  const linhas = linhasDoLog(e.log);
  return [
    e.texto.trim() || '(escreva aqui o que aconteceu ou a ideia que você teve)',
    '',
    '---',
    `Fierium ${e.versao || '?'} · ${e.plataforma || '?'}`,
    `Sistema: ${e.sistema}`,
    '',
    'Últimas linhas do registro do app:',
    linhas.length ? linhas.map((l) => `  ${l}`).join('\n') : '  (nenhuma)',
  ].join('\n');
}

/** Título curto da issue: a primeira linha do que a pessoa escreveu. */
export function tituloDaSugestao(texto: string): string {
  const primeira = texto.trim().split('\n')[0] ?? '';
  return (primeira.length > 70 ? `${primeira.slice(0, 67)}…` : primeira) || 'Sugestão ou problema';
}

/** O link do GitHub com título e corpo prontos (o corpo é cortado pra caber no endereço). */
export function linkDoGitHub(texto: string, mensagem: string): string {
  const corpo = mensagem.length > 5500 ? `${mensagem.slice(0, 5500)}\n…(cortado)` : mensagem;
  const q = new URLSearchParams({ title: tituloDaSugestao(texto), body: corpo });
  return `${REPOSITORIO_ISSUES}?${q.toString()}`;
}
