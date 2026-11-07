// O campo do fundo: poucas estrelas derivando devagar, com a cor da atmosfera atual (--matiz). Para quando o leitor
// abre, quando a janela some e no movimento reduzido (vira um céu parado). Custa quase nada: um canvas 2D.
import { useEffect, useRef } from 'react';

export function Atmosfera({ ativa }: { ativa: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const estrelas = Array.from({ length: 140 }, (_, i) => ({
      x: (Math.sin(i * 12.9898) * 43758.5453) % 1,
      y: (Math.sin(i * 78.233) * 12345.678) % 1,
      z: 0.2 + (((i * 7919) % 100) / 100) * 0.8,
      f: (i % 17) / 17,
    }));
    const medir = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    addEventListener('resize', medir);
    let quadro = 0;
    let t0 = performance.now();
    const desenhar = (t: number) => {
      const parado = document.documentElement.dataset.movimento === 'reduzido';
      const cor = getComputedStyle(document.documentElement).getPropertyValue('--estrela').trim() || '#fff6df';
      ctx.clearRect(0, 0, w, h);
      const dt = parado ? 0 : (t - t0) / 1000;
      for (const e of estrelas) {
        const x = (((Math.abs(e.x) + dt * 0.004 * e.z) % 1) + 1) % 1;
        const y = Math.abs(e.y);
        const brilho = parado ? 0.5 : 0.35 + 0.35 * Math.sin(dt * (0.4 + e.f) + e.f * 10);
        ctx.globalAlpha = Math.max(0.05, brilho * e.z * 0.9);
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.arc(x * w, y * h, e.z * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!parado && ativa) quadro = requestAnimationFrame(desenhar);
    };
    if (ativa) {
      t0 = performance.now();
      quadro = requestAnimationFrame(desenhar);
    }
    const visivel = () => {
      cancelAnimationFrame(quadro);
      if (!document.hidden && ativa) quadro = requestAnimationFrame(desenhar);
    };
    document.addEventListener('visibilitychange', visivel);
    return () => {
      cancelAnimationFrame(quadro);
      removeEventListener('resize', medir);
      document.removeEventListener('visibilitychange', visivel);
    };
  }, [ativa]);
  return (
    <div className="atmosfera" aria-hidden="true">
      <div className="atmosfera-nevoa" />
      <canvas ref={ref} />
    </div>
  );
}
