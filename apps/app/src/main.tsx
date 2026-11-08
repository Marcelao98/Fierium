import '@fierium/ui';
import { criarLog, type Registro } from '@fierium/diagnostico';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { montar } from './montar';
import { ProvedorNucleo } from './nucleo/contexto';
import { ligarEndereco } from './nucleo/navegacao';
import { escolherPlataforma } from './plataforma/escolher';
import './casca/casca.css';
import './compartilhado/compartilhado.css';
import './casca/celular.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('index.html sem o #raiz');

// página de desenvolvimento do leitor de PDF (?dev=pdf&url=...): monta só o motor, sem o app (usada pelo e2e)
if (new URL(location.href).searchParams.get('dev') === 'pdf') {
  await (await import('./dev/PaginaPdf')).abrirPaginaPdf(raiz);
  await new Promise<never>(() => undefined); // o resto do app não sobe
}

const plataforma = await escolherPlataforma(new URL(location.href));
const paraConsole = (r: Registro) => {
  if (r.nivel !== 'debug') console.info(`[${r.origem}] ${r.mensagem}`, r.dados ?? '');
};
const paraArquivo = (r: Registro) => {
  if (r.nivel !== 'debug')
    plataforma.enviarLog?.({ nivel: r.nivel, origem: r.origem, mensagem: r.mensagem, dados: r.dados });
};
const log = criarLog({
  // em desenvolvimento o log aparece no console; no app, info/aviso/erro vão pro arquivo de log do núcleo (um por dia)
  saidas: [...(import.meta.env.DEV ? [paraConsole] : []), ...(plataforma.enviarLog ? [paraArquivo] : [])],
});
const app = montar(plataforma.cliente, { log });
log.registrar('info', 'app', `Fierium aberto (${plataforma.nome})`);

// erros que escaparam de tudo também vão pro log (e pro inspetor)
addEventListener('error', (e) =>
  log.registrar('erro', 'tela', String(e.message), { arquivo: e.filename, linha: e.lineno }),
);
addEventListener('unhandledrejection', (e) =>
  log.registrar('erro', 'promessa', String((e.reason as Error)?.message ?? e.reason)),
);

if (import.meta.env.DEV || new URL(location.href).searchParams.has('depurar'))
  (window as unknown as { __fierium: unknown }).__fierium = app;

ligarEndereco();
// a configuração vem antes da primeira tela (tema, movimento); se falhar, o aviso aparece e abre com o padrão
await app.config.carregar().catch(() => undefined);
createRoot(raiz).render(
  <StrictMode>
    <ProvedorNucleo valor={{ servicos: app.servicos, config: app.config }}>
      <App recursos={app.recursos} />
    </ProvedorNucleo>
  </StrictMode>,
);
