// O véu (a interface some 2,5 s depois do último movimento; nunca com painel, balão ou menu aberto), o modo mergulho
// (tela cheia, sem barra; a barra volta com Esc ou com o mouse no topo) e os atalhos de teclado do leitor.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fecharLeitura } from '../../nucleo/navegacao';
import type { Servicos } from '../../nucleo/servicos';
import type { Leitor as EstadoLeitor } from './estado';

interface Entrada {
  leitor: EstadoLeitor;
  servicos: Servicos;
  aberto: { painel: string | null; balao: boolean; menu: boolean };
  /** Esc fecha primeiro o menu, depois o balão, depois o painel: devolve `true` se fechou algo */
  aoEsc(): boolean;
  aoMenuPeloTeclado(): void;
  aoAlternarNotas(): void;
  /** devolve `false` se não há o que copiar (a tecla segue o caminho normal) */
  aoCopiarCitacao(): boolean;
  aoMergulhar(): void;
}

export function useVeuEMergulho(e: Entrada) {
  const [escondida, setEscondida] = useState(false);
  const [mergulho, setMergulho] = useState(false);
  const [barraNoTopo, setBarraNoTopo] = useState(false);
  const mergulhoAtual = useRef(false);
  const tempo = useRef(0);
  const ultima = useRef(e);
  ultima.current = e;
  const { leitor, servicos } = e;

  const acordar = useCallback(() => {
    leitor.mexeu();
    setEscondida(false);
    clearTimeout(tempo.current);
    tempo.current = window.setTimeout(() => setEscondida(true), 2500);
  }, [leitor]);

  const mergulhar = useCallback((dentro: boolean) => setMergulho(dentro), []);

  useEffect(() => {
    if (mergulhoAtual.current === mergulho) return;
    mergulhoAtual.current = mergulho;
    setBarraNoTopo(false);
    if (mergulho) ultima.current.aoMergulhar();
    void servicos.telaCheia(mergulho).then((ok) => {
      if (!ok && mergulho) servicos.log.registrar('aviso', 'leitor', 'tela cheia indisponível: mergulho só sem barra');
    });
  }, [mergulho, servicos]);

  useEffect(() => {
    // Esc no navegador sai da tela cheia por conta própria: o mergulho acompanha
    const mudou = () => {
      if (!document.fullscreenElement && mergulhoAtual.current) setMergulho(false);
    };
    document.addEventListener('fullscreenchange', mudou);
    return () => {
      document.removeEventListener('fullscreenchange', mudou);
      if (mergulhoAtual.current) void servicos.telaCheia(false);
    };
  }, [servicos]);

  useEffect(() => {
    acordar();
    const tecla = (ev: KeyboardEvent) => {
      const a = ultima.current;
      leitor.mexeu();
      if (ev.key === 'F11') {
        ev.preventDefault();
        setMergulho((m) => !m);
      } else if (ev.key === 'ContextMenu' || (ev.shiftKey && ev.key === 'F10')) {
        ev.preventDefault();
        a.aoMenuPeloTeclado();
      } else if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'n') {
        ev.preventDefault();
        a.aoAlternarNotas();
      } else if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'c') {
        if (a.aoCopiarCitacao()) ev.preventDefault();
      } else if (ev.key === 'Escape') {
        if (a.aoEsc()) return;
        if (mergulhoAtual.current) setMergulho(false);
        else fecharLeitura();
      }
    };
    addEventListener('keydown', tecla);
    return () => {
      removeEventListener('keydown', tecla);
      clearTimeout(tempo.current);
    };
  }, [leitor, acordar]);

  return {
    /** a interface está escondida pelo véu (a casca ainda confere se há painel, balão ou menu abertos) */
    escondida,
    mergulho,
    barraNoTopo,
    mergulhar,
    /** o toque no conteúdo alterna o véu */
    alternar: () => setEscondida((v) => !v),
    aoMoverPonteiro(y: number) {
      acordar();
      if (mergulhoAtual.current) setBarraNoTopo(y < (barraNoTopo ? 120 : 56));
    },
  };
}
