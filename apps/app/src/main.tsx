import '@fierium/ui';
import { criarLog } from '@fierium/diagnostico';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { montar } from './montar';
import { ProvedorNucleo } from './nucleo/contexto';
import { ligarEndereco } from './nucleo/navegacao';
import { escolherCliente } from './plataforma/escolher';
import './casca/casca.css';
import './compartilhado/compartilhado.css';
import './casca/celular.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('index.html sem o #raiz');

const log = criarLog({
  // em desenvolvimento, o log também aparece no console do navegador
  saidas: import.meta.env.DEV
    ? [(r) => r.nivel !== 'debug' && console.info(`[${r.origem}] ${r.mensagem}`, r.dados ?? '')]
    : [],
});
const app = montar(escolherCliente(new URL(location.href)), { log });

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
