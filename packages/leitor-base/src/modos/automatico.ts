// Modo Automático: o conteúdo rola sozinho, numa velocidade ajustável (px/s). Pausa quando a pessoa toca, rola à mão
// ou aperta uma tecla; no fim do capítulo vira o capítulo (EPUB) e no fim do livro para. Um laço de quadros e só.
import { chegouAoFim, criarLaco, criarRolador, virarSePuder } from './laco';
import { agendaDoNavegador, type EstadoModo, type InstanciaModo, type ModoLeitura } from './tipos';

const PAUSA_AO_VIRAR_S = 0.8; // dá tempo do capítulo novo aparecer antes de olhar o fim de novo
const CHECAR_FIM_A_CADA_S = 0.25; // ler a rolagem a cada quadro seria layout à toa

export const modoAutomatico: ModoLeitura = {
  id: 'automatico',
  rotulo: 'Automático',
  unidade: 'px/s',
  faixa: { min: 10, max: 300, passo: 5, padrao: 45 },
  precisa: ['rolar'],
  iniciar(sessao, ambiente) {
    let velocidade = ambiente.velocidade;
    let estado: EstadoModo = 'rodando';
    let espera = 0;
    let desdeChecagem = 0;
    const rolador = criarRolador(sessao);
    const mudar = (e: EstadoModo) => {
      if (e === estado) return;
      estado = e;
      ambiente.aoMudar?.(e);
    };

    const laco = criarLaco(ambiente.agenda ?? agendaDoNavegador, (dt) => {
      if (espera > 0) {
        espera -= dt;
        return;
      }
      rolador.rolar(velocidade * dt);
      desdeChecagem += dt;
      if (desdeChecagem < CHECAR_FIM_A_CADA_S) return;
      desdeChecagem = 0;
      if (!chegouAoFim(sessao)) return;
      if (virarSePuder(sessao)) {
        rolador.zerar();
        espera = PAUSA_AO_VIRAR_S;
        return;
      }
      laco.parar();
      mudar('fim');
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
        velocidade = v;
      },
      pausar,
      retomar() {
        if (estado === 'rodando') return;
        rolador.zerar();
        espera = 0;
        mudar('rodando');
        laco.iniciar();
      },
      estado: () => estado,
      parar() {
        laco.parar();
        desouvir?.();
      },
    } satisfies InstanciaModo;
  },
};
