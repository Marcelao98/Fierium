// A casca de cima: navegação, fundo, busca, inspetor, avisos e a tela da rota atual. O leitor abre por cima de tudo
// (um modo, não uma página); ao fechar, a tela de baixo continua exatamente como estava.
import { lazy, Suspense, useEffect } from 'react';
import { Atmosfera } from './casca/Atmosfera';
import { Avisos } from './casca/Avisos';
import { Busca } from './casca/Busca';
import { Inspetor } from './casca/Inspetor';
import { BarraInferior, Lateral } from './casca/Navegacao';
import { useConfig } from './nucleo/contexto';
import { useNavegacao } from './nucleo/navegacao';
import type { Recursos } from './montar';
import { TelaAjustes } from './recursos/ajustes/Tela';
import { TelaBiblioteca } from './recursos/biblioteca/Tela';
import { TelaColecao, TelaColecoes } from './recursos/colecoes/Tela';
import { TelaEstatisticas } from './recursos/estatisticas/Tela';
import { Abertura } from './recursos/inicio/Abertura';
import { TelaInicio } from './recursos/inicio/Tela';
import { Leitor } from './recursos/leitor/Tela';
import { TelaNotas } from './recursos/notas/Tela';
import { TelaObra } from './recursos/obra/Tela';

// a vitrine (cada componente sozinho) só existe em desenvolvimento e não entra no pacote final
const Vitrine = import.meta.env.DEV ? lazy(() => import('./dev/Vitrine')) : null;

export function App({ recursos }: { recursos: Recursos }) {
  const rota = useNavegacao((s) => s.rota);
  const leitura = useNavegacao((s) => s.leitura);
  const primeiraVez = useConfig()?.primeiraVez;

  useEffect(() => {
    if (rota.tela !== 'colecao') document.documentElement.style.setProperty('--matiz', '255');
  }, [rota]);

  if (primeiraVez) return <Abertura />;
  return (
    <div className="app">
      <Atmosfera ativa={!leitura} />
      <Lateral />
      <main id="conteudo" className="conteudo" aria-hidden={!!leitura}>
        {rota.tela === 'inicio' && <TelaInicio inicio={recursos.inicio} />}
        {rota.tela === 'biblioteca' && <TelaBiblioteca biblioteca={recursos.biblioteca} lente={rota.lente} />}
        {rota.tela === 'obra' && <TelaObra estado={recursos.obra} id={rota.id} />}
        {rota.tela === 'colecoes' && <TelaColecoes colecoes={recursos.colecoes} />}
        {rota.tela === 'colecao' && <TelaColecao colecoes={recursos.colecoes} id={rota.id} />}
        {rota.tela === 'notas' && <TelaNotas notas={recursos.notas} />}
        {rota.tela === 'estatisticas' && <TelaEstatisticas estatisticas={recursos.estatisticas} />}
        {rota.tela === 'ajustes' && <TelaAjustes pastas={recursos.pastas} />}
        {rota.tela === 'vitrine' && Vitrine && (
          <Suspense fallback={null}>
            <Vitrine />
          </Suspense>
        )}
      </main>
      <BarraInferior />
      {leitura && <Leitor leitor={recursos.leitor} leitura={leitura} />}
      <Busca />
      <Inspetor />
      <Avisos />
    </div>
  );
}
