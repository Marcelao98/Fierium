// O menu do botão direito do leitor (e da tecla Menu / Shift+F10). Substitui o menu do navegador: vidro escuro com a
// borda gravada e o ouro do Céu, atalhos à direita, setas/Enter/Esc, sempre dentro da tela. Só desenha: o que ele
// mostra vem de `itensDoMenu` e o que cada item faz vem da casca do leitor.
import { Icone } from '@fierium/ui';
import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ItemMenu } from './menuItens';

const MARGEM = 8;

/** Onde pôr o menu (w×h) pedido no ponto (x, y) sem sair da janela (W×H): vira pro outro lado se não couber. */
export function posicionar(x: number, y: number, w: number, h: number, W: number, H: number) {
  const left = x + w <= W - MARGEM ? x : x - w;
  const top = y + h <= H - MARGEM ? y : y - h;
  return {
    left: Math.max(MARGEM, Math.min(left, W - w - MARGEM)),
    top: Math.max(MARGEM, Math.min(top, H - h - MARGEM)),
  };
}

export interface PropsMenu {
  x: number;
  y: number;
  itens: ItemMenu[];
  aoFechar(): void;
  /** tamanho da janela (os testes passam) */
  largura?: number;
  altura?: number;
}

export function MenuContexto({ x, y, itens, aoFechar, largura, altura }: PropsMenu) {
  const caixa = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const r = caixa.current?.getBoundingClientRect();
    setLugar(posicionar(x, y, r?.width ?? 0, r?.height ?? 0, largura ?? innerWidth, altura ?? innerHeight));
  }, [x, y, itens.length, largura, altura]);

  const entradas = () => [...(caixa.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
  useEffect(() => {
    entradas()[0]?.focus();
  }, []);

  // clicar fora ou redimensionar fecha (cliques dentro do iframe do EPUB chegam como `toque`, pela casca)
  useEffect(() => {
    const fora = (e: Event) => {
      if (!caixa.current?.contains(e.target as Node)) aoFechar();
    };
    addEventListener('pointerdown', fora, true);
    addEventListener('resize', aoFechar);
    return () => {
      removeEventListener('pointerdown', fora, true);
      removeEventListener('resize', aoFechar);
    };
  }, [aoFechar]);

  const aoTeclar = (e: React.KeyboardEvent) => {
    const todas = entradas();
    const i = todas.indexOf(document.activeElement as HTMLElement);
    const ir = (n: number) => todas[(n + todas.length) % todas.length]?.focus();
    const naFileira = (document.activeElement as HTMLElement | null)?.closest('.menu-cores');
    switch (e.key) {
      case 'ArrowDown':
        ir(i + 1);
        break;
      case 'ArrowUp':
        ir(i - 1);
        break;
      case 'ArrowRight':
        if (naFileira) ir(i + 1);
        break;
      case 'ArrowLeft':
        if (naFileira) ir(i - 1);
        break;
      case 'Home':
        ir(0);
        break;
      case 'End':
        ir(todas.length - 1);
        break;
      case 'Escape':
        e.stopPropagation();
        aoFechar();
        break;
      case 'Tab':
        aoFechar();
        break;
      default:
        return; // Enter e Espaço já ativam o botão focado
    }
    e.preventDefault();
  };

  return (
    <div
      ref={caixa}
      className="menu-contexto"
      role="menu"
      aria-label="Menu do leitor"
      style={{ left: lugar?.left ?? x, top: lugar?.top ?? y, visibility: lugar ? 'visible' : 'hidden' }}
      onKeyDown={aoTeclar}
      onContextMenu={(e) => e.preventDefault()}
    >
      {itens.map((item, n) => {
        if (item.tipo === 'sep') return <div key={n} className="menu-sep" role="separator" />;
        if (item.tipo === 'cores')
          return (
            <div key={n} className="menu-cores" role="group" aria-label="Cor da marcação">
              {item.cores.map((c) => (
                <button
                  key={c.id}
                  role="menuitemradio"
                  aria-checked={item.atual === c.id}
                  aria-label={c.nome}
                  title={c.nome}
                  tabIndex={-1}
                  style={{ '--cor-marca': c.cor } as CSSProperties}
                  onClick={() => item.escolher(c.id)}
                >
                  <i />
                </button>
              ))}
            </div>
          );
        return (
          <button
            key={item.id}
            role="menuitem"
            tabIndex={-1}
            className="menu-item"
            data-perigo={item.perigo || undefined}
            onClick={item.escolher}
          >
            <Icone nome={item.icone} tamanho={16} />
            <span>{item.rotulo}</span>
            {item.atalho && <kbd>{item.atalho}</kbd>}
          </button>
        );
      })}
    </div>
  );
}
