// Páginas virtualizadas, parte 1: o tamanho reservado de cada página, a posição de leitura e a rolagem.
import { paginaEm, type PosicaoPdf } from './posicao';
import { escalaDe, ESPACO, type Contexto } from './tipos';

/** Reserva o espaço de todas as páginas (só tamanho; o canvas vem só pras que estão perto da tela). */
export function disposicao(c: Contexto): void {
  const escala = escalaDe(c);
  let y = ESPACO;
  let maior = 0;
  c.topos = c.paginas.map((p) => {
    const t = y;
    const altura = p.h * escala;
    p.el.style.top = `${t}px`;
    p.el.style.width = `${p.w * escala}px`;
    p.el.style.height = `${altura}px`;
    p.el.style.setProperty('--scale-factor', String(escala));
    maior = Math.max(maior, p.w * escala);
    y += altura + ESPACO;
    return t;
  });
  c.lista.style.height = `${y}px`;
  c.lista.style.width = `${maior + 2 * ESPACO}px`;
}

export function posicaoAtual(c: Contexto): PosicaoPdf {
  if (!c.topos.length) return { pagina: 1, fracao: 0 };
  const i = paginaEm(c.topos, c.rolagem.scrollTop + 1);
  const altura = c.paginas[i]!.h * escalaDe(c);
  return { pagina: i + 1, fracao: Math.min(1, Math.max(0, (c.rolagem.scrollTop - c.topos[i]!) / altura)) };
}

export function rolarPara(c: Contexto, p: PosicaoPdf): void {
  const i = Math.min(c.n, Math.max(1, p.pagina)) - 1;
  c.rolagem.scrollTop = c.topos[i]! + p.fracao * c.paginas[i]!.h * escalaDe(c);
}

/** Refaz o layout mantendo o ponto de leitura no mesmo lugar. */
export function redisporMantendo(c: Contexto): void {
  const p = posicaoAtual(c);
  disposicao(c);
  rolarPara(c, p);
}
