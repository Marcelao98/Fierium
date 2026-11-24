// Modo Rolagem: o normal, a pessoa rola à mão. Não faz nada; existe pra a lista de modos ser uniforme.
import type { ModoLeitura } from './tipos';

export const modoRolagem: ModoLeitura = {
  id: 'rolagem',
  rotulo: 'Rolagem',
  unidade: '',
  faixa: null,
  precisa: [],
  iniciar() {
    return {
      definirVelocidade: () => undefined,
      pausar: () => undefined,
      retomar: () => undefined,
      estado: () => 'rodando',
      parar: () => undefined,
    };
  },
};
