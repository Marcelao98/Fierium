// Monta o motor de leitura certo no palco (carregando o pacote do formato sob demanda) e liga os eventos dele à casca.
// Trocar de formato = trocar de motor; o resto do leitor não muda.
import type { ConfigLeitura, CorMarcacao, FonteLeitura, Obra } from '@fierium/contratos';
import type { Caixa, PedidoMenu, Selecao, SessaoLeitura } from '@fierium/leitor-base';
import { useEffect, useRef, useState } from 'react';
import type { Servicos } from '../../nucleo/servicos';
import type { Leitor as EstadoLeitor } from './estado';
import { abrirMotor } from './motores';

/** O que a casca faz quando o motor avisa algo (sempre a versão mais nova: o motor guarda esta referência). */
export interface GanchosPalco {
  aoSelecionar(s: Selecao | null): void;
  aoClicarMarcacao(id: string, caixa: Caixa): void;
  aoPedirMenu(p: PedidoMenu): void;
  aoTocar(): void;
}

interface Entrada {
  leitor: EstadoLeitor;
  servicos: Servicos;
  fonte: FonteLeitura | null;
  obra: Obra | null;
  edicaoId: string;
  marcacaoId: string | undefined;
  cfg: ConfigLeitura | undefined;
  cores: CorMarcacao[];
  ganchos: GanchosPalco;
}

export function usePalco(e: Entrada) {
  const palco = useRef<HTMLDivElement>(null);
  const sessao = useRef<SessaoLeitura | null>(null);
  const posicaoAtual = useRef('');
  const [viva, setViva] = useState<SessaoLeitura | null>(null);
  // o motor é montado uma vez por fonte, mas deve ver sempre os valores mais novos (também depois do import dinâmico)
  const ultimo = useRef(e);
  ultimo.current = e;
  const { fonte } = e;

  useEffect(() => {
    const el = palco.current;
    if (!el || !fonte || !ultimo.current.cfg) return;
    let vivo = true;
    const { leitor, servicos } = ultimo.current;
    void (async () => {
      let nome = '';
      try {
        const motor = await abrirMotor(fonte);
        nome = motor.nome;
        if (!vivo) return;
        const a = ultimo.current;
        const salvo = a.obra?.edicoes.find((x) => x.id === a.edicaoId)?.progresso?.posicao;
        const s = await motor.montar(el, {
          fonte,
          alvo: a.marcacaoId ? { marcacaoId: a.marcacaoId } : salvo ? { posicao: salvo } : undefined,
          aparencia: a.cfg!,
          marcacoes: leitor.store.getState().marcacoes,
          cores: a.cores,
          eventos: {
            posicao: (p, f) => {
              posicaoAtual.current = p;
              leitor.posicaoMudou(p, f);
            },
            selecao: (sel) => ultimo.current.ganchos.aoSelecionar(sel),
            marcacaoClicada: (id, caixa) => ultimo.current.ganchos.aoClicarMarcacao(id, caixa),
            menu: (p) => ultimo.current.ganchos.aoPedirMenu(p),
            toque: () => ultimo.current.ganchos.aoTocar(),
            erro: (codigo, mensagem, detalhe) => {
              servicos.log.registrar('erro', 'leitor', `${codigo}: ${mensagem}`, detalhe ? { detalhe } : undefined);
              servicos.avisar(`${mensagem} (${codigo})`, 'erro');
            },
          },
        });
        if (vivo) {
          sessao.current = s;
          setViva(s);
        } else s.desmontar();
        if (a.marcacaoId) leitor.selecionar(a.marcacaoId);
      } catch (erro) {
        const m = erro instanceof Error ? erro.message : String(erro);
        // um erro do motor já foi avisado por ele; os de escolher/carregar o motor ainda não
        if (!nome) servicos.avisar(m, 'erro');
        servicos.log.registrar('erro', 'leitor', nome ? `motor ${nome} não montou` : m, { erro: String(erro) });
      }
    })();
    return () => {
      vivo = false;
      sessao.current?.desmontar();
      sessao.current = null;
      setViva(null);
    };
  }, [fonte]);

  return { palco, sessao, posicaoAtual, viva };
}
