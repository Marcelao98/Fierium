// O modo de leitura da sessão (Rolagem, Automático, Guiado): quem roda é o `leitor-base` (requestAnimationFrame, sem
// render do React por quadro); aqui só vive a escolha da pessoa e o estado "rodando/pausado" pro botão.
import {
  modoDisponivel,
  modoPorId,
  type EstadoModo,
  type IdModo,
  type InstanciaModo,
  type SessaoLeitura,
} from '@fierium/leitor-base';
import { useCallback, useEffect, useRef, useState } from 'react';

const VELOCIDADES_PADRAO: Record<IdModo, number> = {
  rolagem: 0,
  automatico: modoPorId('automatico').faixa!.padrao,
  guiado: modoPorId('guiado').faixa!.padrao,
};

export function useModo(sessao: SessaoLeitura | null) {
  const [id, setId] = useState<IdModo>('rolagem');
  const [velocidades, setVelocidades] = useState(VELOCIDADES_PADRAO);
  const [estado, setEstado] = useState<EstadoModo>('rodando');
  const instancia = useRef<InstanciaModo | null>(null);
  const velocidadesAtuais = useRef(velocidades);
  velocidadesAtuais.current = velocidades;

  // um livro novo abre em Rolagem
  useEffect(() => setId('rolagem'), [sessao]);

  useEffect(() => {
    setEstado('rodando');
    const modo = modoPorId(id);
    if (!sessao || modo.id === 'rolagem' || !modoDisponivel(modo, sessao.capacidades)) return;
    const inst = modo.iniciar(sessao, { velocidade: velocidadesAtuais.current[id], aoMudar: setEstado });
    instancia.current = inst;
    return () => {
      inst.parar();
      instancia.current = null;
    };
  }, [sessao, id]);

  const mudarVelocidade = useCallback(
    (v: number) => {
      setVelocidades((antes) => ({ ...antes, [id]: v }));
      instancia.current?.definirVelocidade(v);
    },
    [id],
  );
  /** pausa se está rodando; retoma se está pausado ou chegou ao fim */
  const alternar = useCallback(() => {
    const i = instancia.current;
    if (!i) return;
    if (i.estado() === 'rodando') i.pausar();
    else i.retomar();
  }, []);

  return { id, mudar: setId, velocidade: velocidades[id], mudarVelocidade, estado, alternar };
}
