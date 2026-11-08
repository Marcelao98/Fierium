// Para onde a pessoa está olhando. A rota fica no endereço (#/biblioteca/grade, #/obra/<id>…) pra o voltar do navegador
// (e o do Android, depois) funcionar. O leitor é um MODO por cima de tudo: fechar volta pra onde estava.
import { create } from 'zustand';

export type Rota =
  | { tela: 'inicio' }
  | { tela: 'biblioteca'; lente: 'grade' | 'mapa' }
  | { tela: 'obra'; id: string }
  | { tela: 'colecoes' }
  | { tela: 'colecao'; id: string }
  | { tela: 'notas' }
  | { tela: 'estatisticas' }
  | { tela: 'ajustes' }
  /** só em desenvolvimento: cada componente sozinho */
  | { tela: 'vitrine' };

export interface Leitura {
  obraId: string;
  edicaoId: string;
  /** de onde o portal abre (centro do elemento clicado, em px) */
  origem: { x: number; y: number };
  /** abrir já rolando até esta marcação */
  marcacaoId?: string;
}

interface Navegacao {
  rota: Rota;
  leitura: Leitura | null;
  invocarAberto: boolean;
  inspetorAberto: boolean;
}

export const useNavegacao = create<Navegacao>(() => ({
  rota: deEndereco(location.hash),
  leitura: null,
  invocarAberto: false,
  inspetorAberto: false,
}));

export function paraEndereco(r: Rota): string {
  switch (r.tela) {
    case 'inicio':
      return '#/';
    case 'biblioteca':
      return `#/biblioteca/${r.lente}`;
    case 'obra':
      return `#/obra/${r.id}`;
    case 'colecao':
      return `#/colecao/${r.id}`;
    default:
      return `#/${r.tela}`;
  }
}

export function deEndereco(h: string): Rota {
  const [, a, b] = h.replace(/^#/, '').split('/');
  if (a === 'biblioteca') return { tela: 'biblioteca', lente: b === 'mapa' ? 'mapa' : 'grade' };
  if (a === 'obra' && b) return { tela: 'obra', id: b };
  if (a === 'colecao' && b) return { tela: 'colecao', id: b };
  if (a === 'colecoes' || a === 'notas' || a === 'estatisticas' || a === 'ajustes' || a === 'vitrine')
    return { tela: a };
  return { tela: 'inicio' };
}

export function ir(r: Rota) {
  const novo = paraEndereco(r);
  if (location.hash !== novo) history.pushState(null, '', novo);
  useNavegacao.setState({ rota: r, invocarAberto: false });
  document.getElementById('conteudo')?.scrollTo({ top: 0 });
}

export function ligarEndereco() {
  addEventListener('popstate', () => {
    const { leitura } = useNavegacao.getState();
    if (leitura) {
      // o voltar fecha o leitor primeiro
      useNavegacao.setState({ leitura: null });
      return;
    }
    useNavegacao.setState({ rota: deEndereco(location.hash) });
  });
}

export function abrirLeitura(l: Leitura) {
  history.pushState(null, '', location.hash);
  useNavegacao.setState({ leitura: l, invocarAberto: false });
}

export function fecharLeitura() {
  if (useNavegacao.getState().leitura) history.back();
}

export function invocar(aberto = true) {
  useNavegacao.setState({ invocarAberto: aberto });
}

/** O inspetor de depuração (Ctrl+Shift+D). */
export function inspetor(aberto = true) {
  useNavegacao.setState({ inspetorAberto: aberto });
}
