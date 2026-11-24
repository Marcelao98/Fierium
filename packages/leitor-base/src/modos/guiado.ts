// Modo Guiado: uma faixa destaca a linha atual e desce, linha a linha, no ritmo de N palavras por minuto (o olho
// acompanha a faixa). Quando a linha passa da parte de baixo da tela o conteúdo desce suave pra ela voltar ao alto.
// Tudo por requestAnimationFrame: a faixa é uma peça do motor (destacarTrecho) e o React nem fica sabendo.
import type { Linha } from '../motor';
import { chegouAoFim, criarLaco, criarRolador, virarSePuder } from './laco';
import { agendaDoNavegador, type EstadoModo, type InstanciaModo, type ModoLeitura } from './tipos';

const SEM_TEXTO_S = 4; // sem nenhuma linha por tanto tempo = não há texto pra guiar (PDF escaneado)
const MINIMO_POR_LINHA_S = 0.4;
const ALVO = 0.35; // onde a linha fica na área visível depois de descer (fração da altura)
const LIMITE_BAIXO = 0.65; // passou daqui, desce
const LIMITE_CIMA = 0.1;
const SUAVIDADE = 5; // por segundo: quanto da distância que falta é rolado

export const palavrasDe = (texto: string) => texto.split(/\s+/).filter(Boolean).length;

/** Quanto tempo a linha fica destacada, em segundos, no ritmo de `wpm` palavras por minuto. */
export const duracaoDaLinha = (l: Linha, wpm: number) =>
  Math.max(MINIMO_POR_LINHA_S, (palavrasDe(l.texto) / Math.max(1, wpm)) * 60);

export const modoGuiado: ModoLeitura = {
  id: 'guiado',
  rotulo: 'Guiado',
  unidade: 'palavras/min',
  faixa: { min: 60, max: 600, passo: 10, padrao: 220 },
  precisa: ['linhas', 'rolar', 'destacar'],
  iniciar(sessao, ambiente) {
    let wpm = ambiente.velocidade;
    let estado: EstadoModo = 'rodando';
    let atual: Linha | null = null;
    let decorrido = 0;
    let faltaRolar = 0;
    let semLinhas = 0;
    let espera = 0;
    const rolador = criarRolador(sessao);
    const mudar = (e: EstadoModo) => {
      if (e === estado) return;
      estado = e;
      ambiente.aoMudar?.(e);
    };

    const escolher = (l: Linha) => {
      atual = l;
      decorrido = 0;
      sessao.destacarTrecho?.({ caixa: l.caixa });
      const r = sessao.rolagem?.();
      if (!r) return;
      const centro = l.caixa.y + l.caixa.altura / 2;
      const { y, altura } = r.area;
      if (centro > y + altura * LIMITE_BAIXO || centro < y + altura * LIMITE_CIMA)
        faltaRolar = centro - (y + altura * ALVO);
    };

    const terminar = () => {
      laco.parar();
      sessao.destacarTrecho?.(null);
      atual = null;
      mudar('fim');
    };

    /** a linha seguinte à atual; sem ela, rola um pedaço (ou vira o capítulo, ou acaba) */
    const avancar = () => {
      const ls = sessao.linhas?.() ?? [];
      const i = atual ? ls.findIndex((l) => l.id === atual!.id) : -1;
      const prox = ls[i + 1];
      if (prox) return escolher(prox);
      if (i < 0 && ls[0]) return escolher(ls[0]); // a atual saiu da tela (rolou à mão): recomeça do alto
      if (!chegouAoFim(sessao)) {
        faltaRolar = (sessao.rolagem?.()?.area.altura ?? 400) * 0.5; // a próxima ainda não apareceu: desce meia tela
        return; // o tempo da linha já passou: assim que a rolagem acabar, tenta de novo
      }
      if (virarSePuder(sessao)) {
        atual = null;
        sessao.destacarTrecho?.(null);
        rolador.zerar();
        espera = 0.8;
        return;
      }
      terminar();
    };

    const laco = criarLaco(ambiente.agenda ?? agendaDoNavegador, (dt) => {
      if (espera > 0) {
        espera -= dt;
        return;
      }
      if (Math.abs(faltaRolar) > 0.5) {
        const parte = Math.abs(faltaRolar) < 2 ? faltaRolar : faltaRolar * Math.min(1, dt * SUAVIDADE);
        faltaRolar -= parte;
        rolador.rolar(parte);
      } else faltaRolar = 0;
      if (!atual) {
        const ls = sessao.linhas?.() ?? [];
        if (ls[0]) {
          semLinhas = 0;
          escolher(ls[0]);
        } else {
          semLinhas += dt;
          if (semLinhas > SEM_TEXTO_S) terminar();
        }
        return;
      }
      decorrido += dt;
      // a próxima linha só vale quando a rolagem suave terminou (a faixa não pula enquanto a tela anda)
      if (decorrido >= duracaoDaLinha(atual, wpm) && Math.abs(faltaRolar) < 1) avancar();
    });

    const pausar = () => {
      if (estado !== 'rodando') return;
      laco.parar();
      mudar('pausado');
    };
    const desouvir = sessao.aoInteragir?.(pausar);
    laco.iniciar();

    return {
      definirVelocidade(v) {
        wpm = v;
      },
      pausar,
      retomar() {
        if (estado === 'rodando') return;
        const ls = sessao.linhas?.() ?? [];
        const ainda = atual ? ls.find((l) => l.id === atual!.id) : undefined;
        atual = null;
        faltaRolar = 0;
        espera = 0;
        semLinhas = 0;
        if (ainda) escolher(ainda);
        mudar('rodando');
        laco.iniciar();
      },
      estado: () => estado,
      parar() {
        laco.parar();
        desouvir?.();
        sessao.destacarTrecho?.(null);
      },
    } satisfies InstanciaModo;
  },
};
