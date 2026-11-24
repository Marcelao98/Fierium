// Peças dos modos: o laço de quadros (um pedido por vez, dt limitado) e o rolador que junta frações de pixel.
import type { SessaoLeitura } from '../motor';
import type { Agenda } from './tipos';

/** Chama `passo(dt)` a cada quadro (dt em segundos, no máximo 0,1: aba em segundo plano não dá salto). */
export function criarLaco(agenda: Agenda, passo: (dt: number) => void) {
  let cancela: (() => void) | null = null;
  let ultimo: number | null = null;
  const quadro = (agora: number) => {
    cancela = agenda.quadro(quadro); // pedido antes do passo: se o passo parar o laço, cancela este
    const dt = ultimo === null ? 0 : Math.min(0.1, Math.max(0, (agora - ultimo) / 1000));
    ultimo = agora;
    passo(dt);
  };
  return {
    iniciar() {
      if (cancela) return;
      ultimo = null;
      cancela = agenda.quadro(quadro);
    },
    parar() {
      cancela?.();
      cancela = null;
    },
    rodando: () => cancela !== null,
  };
}

/**
 * Rola a sessão por frações de pixel: guarda o que sobra e só chama `rolarPor` com pixels inteiros (rolar 0,4 px por
 * quadro não anda em muita tela; assim a velocidade fica exata em qualquer taxa de quadros).
 */
export function criarRolador(sessao: SessaoLeitura) {
  let sobra = 0;
  return {
    rolar(px: number) {
      sobra += px;
      const inteiro = Math.trunc(sobra);
      if (inteiro === 0) return;
      sobra -= inteiro;
      sessao.rolarPor?.(inteiro);
    },
    zerar() {
      sobra = 0;
    },
  };
}

/** O fim do conteúdo: rolou tudo o que dava. Em sessão que pagina (EPUB), tenta virar o capítulo antes de dar fim. */
export function chegouAoFim(sessao: SessaoLeitura): boolean {
  const r = sessao.rolagem?.();
  return !!r && r.atual >= r.total - 1;
}

/** Vira a página/capítulo se ainda houver; `false` quando já é a última (ou a sessão não pagina). */
export function virarSePuder(sessao: SessaoLeitura): boolean {
  const p = sessao.paginaAtual?.();
  if (!p || !sessao.paginar || p.atual >= p.total) return false;
  sessao.paginar(1);
  return true;
}
