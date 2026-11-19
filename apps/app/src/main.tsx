import '@fierium/ui';
import { criarLog, type Registro } from '@fierium/diagnostico';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { montar } from './montar';
import { ProvedorNucleo } from './nucleo/contexto';
import { procurarAtualizacao } from './nucleo/atualizacao';
import { criarFilaDeCapas } from './nucleo/capasPdf';
import { ligarEndereco, useNavegacao } from './nucleo/navegacao';
import { escolherPlataforma } from './plataforma/escolher';
import './casca/casca.css';
import './compartilhado/compartilhado.css';
import './casca/celular.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('index.html sem o #raiz');

// páginas de desenvolvimento dos leitores (usadas pelo e2e): ?dev=pdf&url=... e ?dev=epub&url=... montam só o motor
const dev = new URL(location.href).searchParams.get('dev');
if (dev === 'pdf') await (await import('./dev/PaginaPdf')).abrirPaginaPdf(raiz);
else if (dev === 'epub') {
  const { default: DevEpub } = await import('./dev/DevEpub');
  createRoot(raiz).render(<DevEpub />);
} else await iniciar(raiz);

async function iniciar(raiz: HTMLElement) {
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
  const app = montar(plataforma.cliente, {
    log,
    ...(plataforma.escolherPastas ? { escolherPastas: plataforma.escolherPastas } : {}),
    abrirLink: plataforma.abrirLink,
    telaCheia: plataforma.telaCheia,
  });
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

  // no app: procura livros novos nas pastas ao abrir (um arquivo posto na pasta aparece sem ir aos Ajustes)
  if (plataforma.nome === 'tauri')
    void plataforma.cliente.chamar('biblioteca.varrer', {}).then(
      (r) => {
        if (r.novos || r.sumiram) {
          log.registrar('info', 'app', `varredura ao abrir: ${r.novos} novos, ${r.sumiram} sumiram`);
          app.servicos.eventos.emitir('biblioteca-mudou', {});
        }
      },
      (e: unknown) => log.registrar('aviso', 'app', 'a varredura ao abrir falhou', { erro: String(e) }),
    );

  void procurarAtualizacao(plataforma.atualizador, log); // em segundo plano; só avisa se houver versão nova
  // capas dos PDFs: com o app parado, desenha a 1ª página de cada PDF sem capa e o núcleo guarda (uma por vez)
  const capas = criarFilaDeCapas({
    cliente: plataforma.cliente,
    eventos: app.servicos.eventos,
    log,
    lendo: () => !!useNavegacao.getState().leitura,
    desenhar: async (f) => (await import('@fierium/leitores')).desenharCapaPdf(f),
  });
  const desenharCapas = () => void capas.varrer().catch((e: unknown) => log.registrar('aviso', 'capas', String(e)));
  app.servicos.eventos.ouvir('biblioteca-mudou', desenharCapas);
  setTimeout(desenharCapas, 4000);

  ligarEndereco();
  // a configuração vem antes da primeira tela (tema, movimento); se falhar, o aviso aparece e abre com o padrão
  await app.config.carregar().catch(() => undefined);
  createRoot(raiz).render(
    <StrictMode>
      <ProvedorNucleo valor={{ servicos: app.servicos, config: app.config }}>
        <App recursos={app.recursos} estatisticasDisponiveis={plataforma.nome === 'navegador'} />
      </ProvedorNucleo>
    </StrictMode>,
  );
}
