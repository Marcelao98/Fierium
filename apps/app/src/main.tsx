import '@fierium/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { carregarConfig } from './estado/config';
import { ligarEndereco } from './estado/navegacao';
import { ligarCliente } from './estado/servicos';
import { escolherCliente } from './plataforma/escolher';
import './app/app.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('index.html sem o #raiz');
ligarCliente(escolherCliente(new URL(location.href)));
ligarEndereco();
// a configuração vem antes da primeira tela (tema, movimento); se falhar, o aviso aparece e abre com o padrão
await carregarConfig().catch(() => undefined);
createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
