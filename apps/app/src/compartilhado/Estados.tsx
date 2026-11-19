// Os estados que toda tela precisa ter: carregando, vazio e erro. Nenhum deles fica mudo: cada um diz o que houve em
// português e oferece o próximo passo (um botão). O erro do núcleo mostra a mensagem dele e "Copiar detalhes".
import { paraErroFierium, type ErroFierium } from '@fierium/cliente';
import { useCallback, useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';
import { ir } from '../nucleo/navegacao';

/** Carrega os dados da tela e guarda o erro (em vez de deixar "Abrindo…" pra sempre). `tentar` roda de novo. */
export function useCarregar(carregar: () => Promise<unknown>, deps: DependencyList) {
  const [erro, setErro] = useState<ErroFierium | null>(null);
  const funcao = useRef(carregar);
  funcao.current = carregar;
  const tentar = useCallback(() => {
    setErro(null);
    funcao.current().then(
      () => undefined,
      (e: unknown) => setErro(paraErroFierium(e)), // o aviso com os detalhes já saiu; a tela guarda o motivo
    );
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- o chamador diz de quê depende
  useEffect(tentar, deps);
  return { erro, tentar };
}

/** Texto de um erro pra copiar e mandar (código, mensagem e onde aconteceu). */
export function detalhesDoErro(e: ErroFierium, onde: string): string {
  return `Tela: ${onde}\nCódigo: ${e.codigo}\nMensagem: ${e.mensagem}`;
}

/** Um estado de tela (vazio, carregando, erro): título, explicação e botões. */
export function EstadoDaTela({
  titulo,
  children,
  acoes,
  alerta = false,
}: {
  titulo: string;
  children?: ReactNode;
  acoes?: ReactNode;
  alerta?: boolean;
}) {
  return (
    <div className="estado-tela" role={alerta ? 'alert' : 'status'}>
      <h2>{titulo}</h2>
      {children && <p>{children}</p>}
      {acoes && <div className="estado-tela-acoes">{acoes}</div>}
    </div>
  );
}

/** "Abrindo…" com um respiro; se demorar demais a tela não muda, mas o erro (se vier) toma o lugar. */
export function Carregando({ texto }: { texto: string }) {
  return (
    <p className="carregando" role="status">
      {texto}
    </p>
  );
}

/** O erro de uma tela: a mensagem do núcleo, "Tentar de novo", "Copiar detalhes" e a saída pro Início. */
export function ErroDaTela({ erro, onde, aoTentar }: { erro: ErroFierium; onde: string; aoTentar: () => void }) {
  const [copiado, setCopiado] = useState('');
  const copiar = () => {
    navigator.clipboard.writeText(detalhesDoErro(erro, onde)).then(
      () => setCopiado('Copiado.'),
      () => setCopiado('Não consegui copiar (o sistema não deixou).'),
    );
  };
  return (
    <EstadoDaTela
      alerta
      titulo="Algo não saiu como esperado"
      acoes={
        <>
          <button className="f-botao" data-tipo="luz" onClick={aoTentar}>
            Tentar de novo
          </button>
          <button className="f-botao" onClick={copiar}>
            Copiar detalhes
          </button>
          <button className="f-botao" data-tipo="fantasma" onClick={() => ir({ tela: 'inicio' })}>
            Ir para o Início
          </button>
        </>
      }
    >
      {erro.mensagem} ({erro.codigo}){copiado && ` · ${copiado}`}
    </EstadoDaTela>
  );
}
