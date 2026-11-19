// Capas dos PDFs: depois que o app fica parado, desenha a 1ª página de cada PDF sem capa (uma por vez; pausa se a
// pessoa estiver lendo) e manda o núcleo guardar (`capa.salvar`). Roda em segundo plano e nunca incomoda: falha vira
// log, não aviso, e a edição que falhou não é tentada de novo na mesma sessão.
import type { Cliente } from '@fierium/cliente';
import type { Edicao } from '@fierium/contratos';
import type { Log } from '@fierium/diagnostico';
import type { Eventos } from './eventos';

export interface OpcoesFilaDeCapas {
  cliente: Cliente;
  eventos: Eventos;
  log: Log;
  /** a pessoa está no leitor? (pausa a fila) */
  lendo: () => boolean;
  /** desenha a 1ª página do PDF e devolve a imagem em base64 (sem `data:`) */
  desenhar: (fonte: { url: string; tamanho: number }) => Promise<string>;
  /** espera (nos testes, instantâneo) */
  esperar?: (ms: number) => Promise<void>;
  /** quanto esperar antes de começar e entre uma capa e outra */
  folga?: number;
}

export interface FilaDeCapas {
  /** procura PDFs sem capa e desenha o que faltar. Chamadas enquanto já está rodando não fazem nada. */
  varrer(): Promise<number>;
}

export const LARGURA_DA_CAPA = 360;

const aEsperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

export function criarFilaDeCapas(op: OpcoesFilaDeCapas): FilaDeCapas {
  const esperar = op.esperar ?? aEsperar;
  const folga = op.folga ?? 1500;
  const tentadas = new Set<string>();
  let rodando = false;

  async function pendentes(): Promise<Edicao[]> {
    const obras = await op.cliente.chamar('obras.listar', {});
    return obras.flatMap((o) =>
      o.edicoes.filter(
        (e) => e.formato === 'pdf' && !e.capa && e.arquivos.some((a) => a.disponivel) && !tentadas.has(e.id),
      ),
    );
  }

  async function uma(e: Edicao): Promise<boolean> {
    tentadas.add(e.id);
    try {
      const fonte = await op.cliente.chamar('edicao.abrir', { edicaoId: e.id });
      if (fonte.tipo !== 'arquivo' || fonte.formato !== 'pdf') return false;
      const imagem = await op.desenhar({ url: fonte.url, tamanho: fonte.tamanho });
      await op.cliente.chamar('capa.salvar', { edicaoId: e.id, imagem });
      return true;
    } catch (erro) {
      op.log.registrar('aviso', 'capas', `não consegui desenhar a capa do PDF ${e.id}`, { erro: String(erro) });
      return false;
    }
  }

  return {
    async varrer() {
      if (rodando) return 0;
      rodando = true;
      let feitas = 0;
      try {
        for (;;) {
          const fila = await pendentes();
          const proxima = fila[0];
          if (!proxima) break;
          // uma por vez, e só com o app parado: lendo, espera a pessoa terminar
          await esperar(folga);
          while (op.lendo()) await esperar(folga * 2);
          if (await uma(proxima)) {
            feitas++;
            // a cada capa nova a tela se atualiza sozinha (as listas recarregam); em lote seria mais barato, mas
            // a capa aparecendo uma a uma é justamente o efeito bonito
            op.eventos.emitir('biblioteca-mudou', {});
          }
        }
      } finally {
        rodando = false;
      }
      return feitas;
    },
  };
}
