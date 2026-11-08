// O mapa: a biblioteca como um céu. Cada área (romance, filosofia, mangá…) é uma região; cada obra é uma luz.
// A luz conta a verdade: apagada = nunca aberta, pulsando = lendo, firme e forte = lida. Obras do mesmo autor ficam
// ligadas por um fio. Posições estáveis (o mesmo acervo dá sempre o mesmo céu), arrastar e zoom, e a deriva: o mapa
// passeia sozinho e para em obras que você nunca abriu.
import type { Obra } from '@fierium/contratos';
import { Icone } from '@fierium/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { autorDe, fracaoDe, haQuanto } from '../../compartilhado/Obras';
import { ir } from '../../nucleo/navegacao';
import { montarCeu, type Luz } from './ceu';

export function Mapa({ obras }: { obras: Obra[] }) {
  const { luzes, regioes, fios } = useMemo(() => montarCeu(obras), [obras]);
  const caixa = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 800, h: 600 });
  const [vista, setVista] = useState({ x: 0, y: 0, k: 0.85 });
  const [dica, setDica] = useState<{ luz: Luz; px: number; py: number } | null>(null);
  const [deriva, setDeriva] = useState<Luz | null>(null);
  const [suave, setSuave] = useState(false);
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number; moveu: boolean } | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ob = new ResizeObserver(() => setTam({ w: el.clientWidth, h: el.clientHeight }));
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  // deriva: a cada 6 s, viaja até uma obra nunca aberta (ou pouco lida)
  const derivando = deriva !== null;
  useEffect(() => {
    if (!derivando) return;
    const candidatas = luzes.filter((l) => l.obra.relacao.estado === 'nao-lida');
    const lista = candidatas.length ? candidatas : luzes;
    let i = Math.floor(Math.random() * lista.length);
    const viajar = () => {
      const l = lista[i++ % lista.length]!;
      setSuave(true);
      setDeriva(l);
      setVista({ x: -l.x, y: -l.y, k: 2.2 });
    };
    viajar();
    const t = setInterval(viajar, 6000);
    return () => clearInterval(t);
  }, [derivando, luzes]);

  const tela = (l: Luz) => ({ px: tam.w / 2 + (l.x + vista.x) * vista.k, py: tam.h / 2 + (l.y + vista.y) * vista.k });
  const zoom = (f: number, cx = tam.w / 2, cy = tam.h / 2) =>
    setVista((v) => {
      const k = Math.min(6, Math.max(0.35, v.k * f));
      // mantém o ponto sob o cursor parado
      const wx = (cx - tam.w / 2) / v.k - v.x;
      const wy = (cy - tam.h / 2) / v.k - v.y;
      return { k, x: (cx - tam.w / 2) / k - wx, y: (cy - tam.h / 2) / k - wy };
    });

  return (
    <div
      ref={caixa}
      className="mapa"
      onWheel={(e) => {
        setSuave(false);
        const r = caixa.current!.getBoundingClientRect();
        zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
      }}
      onPointerDown={(e) => {
        setSuave(false);
        arrasto.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, moveu: false };
      }}
      onPointerMove={(e) => {
        const a = arrasto.current;
        if (!a) return;
        const dx = e.clientX - a.x;
        const dy = e.clientY - a.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) {
          if (!a.moveu) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          a.moveu = true;
          setDeriva(null);
        }
        if (a.moveu) setVista((v) => ({ ...v, x: a.vx + dx / v.k, y: a.vy + dy / v.k }));
      }}
      onPointerUp={() => {
        setTimeout(() => (arrasto.current = null), 0);
      }}
    >
      <svg role="img" aria-label={`Mapa da biblioteca: ${obras.length} obras em ${regioes.length} áreas`}>
        <g
          transform={`translate(${tam.w / 2} ${tam.h / 2}) scale(${vista.k}) translate(${vista.x} ${vista.y})`}
          style={{ transition: suave ? 'transform 2.4s cubic-bezier(0.16, 1, 0.3, 1)' : 'none' }}
        >
          {regioes.map((r) => (
            <g key={r.nome}>
              <circle
                cx={r.x}
                cy={r.y}
                r={r.raio}
                fill="var(--superficie)"
                stroke="var(--borda)"
                strokeDasharray="2 6"
              />
              <text className="mapa-regiao" x={r.x} y={r.y - r.raio - 10} textAnchor="middle" fontSize={15}>
                {r.nome}
              </text>
            </g>
          ))}
          {fios.map(([a, b], i) => (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--violeta)"
              strokeOpacity={0.35}
              strokeWidth={0.6}
            />
          ))}
          {luzes.map((l) => {
            const est = l.obra.relacao.estado;
            const f = fracaoDe(l.obra);
            const forca = est === 'lida' ? 1 : est === 'lendo' ? 0.55 + f * 0.4 : 0.28;
            return (
              <g
                key={l.obra.id}
                className="mapa-luz"
                data-estado={est}
                tabIndex={0}
                role="link"
                aria-label={`${l.obra.titulo}, ${autorDe(l.obra)}`}
                onPointerEnter={() => setDica({ luz: l, ...tela(l) })}
                onPointerLeave={() => setDica(null)}
                onClick={() => {
                  if (!arrasto.current?.moveu) ir({ tela: 'obra', id: l.obra.id });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') ir({ tela: 'obra', id: l.obra.id });
                }}
              >
                <circle className="brilho" cx={l.x} cy={l.y} r={l.r * 3.2} fill="var(--luz)" opacity={forca * 0.22} />
                <circle
                  className="nucleo"
                  cx={l.x}
                  cy={l.y}
                  r={l.r}
                  fill="var(--estrela)"
                  opacity={0.3 + forca * 0.7}
                />
                {vista.k > 1.7 && (
                  <text x={l.x} y={l.y + l.r + 9} textAnchor="middle" fontSize={5.5} fill="var(--texto-2)">
                    {l.obra.titulo.length > 26 ? l.obra.titulo.slice(0, 25) + '…' : l.obra.titulo}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {dica && !deriva && (
        <div className="mapa-dica" style={{ left: dica.px, top: dica.py }}>
          {dica.luz.obra.titulo}
          <small>
            {autorDe(dica.luz.obra)} ·{' '}
            {dica.luz.obra.relacao.estado === 'lida'
              ? 'lida'
              : dica.luz.obra.relacao.estado === 'lendo'
                ? `${Math.round(fracaoDe(dica.luz.obra) * 100)}%`
                : 'nunca aberta'}
          </small>
        </div>
      )}
      {deriva && (
        <div className="mapa-deriva" role="status">
          <span>
            <strong>{deriva.obra.titulo}</strong> · {autorDe(deriva.obra)}
            <br />
            <small>
              {deriva.obra.relacao.estado === 'nao-lida'
                ? `Na biblioteca ${haQuanto(deriva.obra.relacao.adicionadaEm)} e nunca aberta`
                : 'Uma obra do seu céu'}
              {deriva.obra.edicoes[0]?.paginas ? ` · ${deriva.obra.edicoes[0].paginas} páginas` : ''}
            </small>
          </span>
          <button
            className="f-botao"
            data-tamanho="p"
            data-tipo="luz"
            onClick={() => ir({ tela: 'obra', id: deriva.obra.id })}
          >
            Ver
          </button>
          <button className="f-botao" data-tamanho="p" onClick={() => setDeriva(null)}>
            Parar
          </button>
        </div>
      )}
      <div className="mapa-legenda" aria-hidden="true">
        <span>
          <i style={{ opacity: 0.3 }} />
          nunca aberta
        </span>
        <span>
          <i style={{ opacity: 0.65 }} />
          lendo
        </span>
        <span>
          <i style={{ boxShadow: '0 0 8px var(--luz)' }} />
          lida
        </span>
      </div>
      <div className="mapa-controles">
        <button
          className="f-botao"
          onClick={() => (deriva ? setDeriva(null) : setDeriva(luzes[0] ?? null))}
          aria-pressed={!!deriva}
          title="O mapa passeia sozinho e para em obras que você nunca abriu"
        >
          <Icone nome="deriva" tamanho={18} /> {deriva ? 'Parar a deriva' : 'Deriva'}
        </button>
        <button className="f-botao f-icone-botao" aria-label="Aproximar" onClick={() => zoom(1.3)}>
          <Icone nome="mais" />
        </button>
        <button className="f-botao f-icone-botao" aria-label="Afastar" onClick={() => zoom(1 / 1.3)}>
          <Icone nome="menos" />
        </button>
      </div>
    </div>
  );
}
