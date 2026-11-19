// O menu do botão direito do Início e da Biblioteca: o caminho curto pra "Mandar sugestão ou problema" (e os Ajustes).
// Usa o mesmo visual do menu do leitor (classes .menu-contexto/.menu-item). Campos de texto ficam com o menu do sistema.
import { Icone } from '@fierium/ui';
import { useEffect, useRef, useState } from 'react';
import { ir, sugestao } from '../nucleo/navegacao';

export function MenuDaTela({ ativo }: { ativo: boolean }) {
  const [ponto, setPonto] = useState<{ x: number; y: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ativo) return;
    const abrir = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest('input, textarea, [contenteditable="true"], .menu-contexto')) return;
      e.preventDefault();
      setPonto({ x: Math.min(e.clientX, innerWidth - 250), y: Math.min(e.clientY, innerHeight - 110) });
    };
    addEventListener('contextmenu', abrir);
    return () => removeEventListener('contextmenu', abrir);
  }, [ativo]);

  useEffect(() => {
    if (!ponto) return;
    caixa.current?.querySelector<HTMLElement>('button')?.focus();
    const fechar = (e: Event) => {
      if (!caixa.current?.contains(e.target as Node)) setPonto(null);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setPonto(null);
    addEventListener('pointerdown', fechar, true);
    addEventListener('keydown', tecla);
    addEventListener('resize', () => setPonto(null));
    return () => {
      removeEventListener('pointerdown', fechar, true);
      removeEventListener('keydown', tecla);
    };
  }, [ponto]);

  if (!ativo || !ponto) return null;
  const faz = (f: () => void) => () => {
    setPonto(null);
    f();
  };
  return (
    <div
      ref={caixa}
      className="menu-contexto"
      role="menu"
      aria-label="Menu da tela"
      style={{ left: ponto.x, top: ponto.y }}
    >
      <button role="menuitem" className="menu-item" onClick={faz(() => sugestao(true))}>
        <Icone nome="nota" tamanho={16} />
        <span>Mandar sugestão ou problema…</span>
      </button>
      <button role="menuitem" className="menu-item" onClick={faz(() => ir({ tela: 'ajustes' }))}>
        <Icone nome="ajustes" tamanho={16} />
        <span>Ajustes</span>
      </button>
    </div>
  );
}
