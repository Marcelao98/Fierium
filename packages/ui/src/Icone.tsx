// Ícones de traço fino com geometria celeste (círculos, arcos, órbitas): nada de símbolo de fantasia (§9.5).
import type { SVGProps } from 'react';

const CAMINHOS = {
  limiar: 'M12 3a9 9 0 1 0 0 18M12 7v5l3 2M16 4.5l1 1.8M20 9l-1.9.6',
  biblioteca: 'M5 4h3v16H5zM10 4h3v16h-3zM15.5 5l2.9-.8 3.6 15-2.9.8z',
  atlas: 'M12 12m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0M5 6l.01 0M19 7l.01 0M17 18l.01 0M7 17l.01 0M5 6l7 6 7-5M12 12l5 6M12 12l-5 5',
  indice: 'M4 5h4v4H4zM10 5h4v4h-4zM16 5h4v4h-4zM4 11h4v4H4zM10 11h4v4h-4zM16 11h4v4h-4zM4 17h4v2H4zM10 17h4v2h-4z',
  lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  colecoes: 'M12 3l8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4',
  marginalia: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h5',
  cronica: 'M12 3a9 9 0 1 0 9 9M12 7v5h5M17 3v4M15 5h4',
  ajustes: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4',
  voltar: 'M15 5l-7 7 7 7',
  fechar: 'M6 6l12 12M18 6L6 18',
  mais: 'M12 5v14M5 12h14',
  estrela: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z',
  ler: 'M3 5.5C5.5 4.5 8.5 4.5 12 6c3.5-1.5 6.5-1.5 9-.5V19c-2.5-1-5.5-1-9 .5-3.5-1.5-6.5-1.5-9-.5zM12 6v13.5',
  letra: 'M4 19l5-14 5 14M6 14h6M15 19l3-8 3 8M16 17h4',
  marcador: 'M7 3h10v18l-5-4-5 4z',
  nota: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  lixo: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  ligar: 'M10 14a4 4 0 0 1 0-5.7l3-3a4 4 0 0 1 5.7 5.7l-1.5 1.5M14 10a4 4 0 0 1 0 5.7l-3 3a4 4 0 0 1-5.7-5.7l1.5-1.5',
  baixar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  deriva: 'M3 12c3-4 6-4 9 0s6 4 9 0M3 17c3-4 6-4 9 0s6 4 9 0M12 3l.01 0M7 6l.01 0M17 6l.01 0',
  lua: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  sol: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  check: 'M5 12l5 5 9-10',
  pasta: 'M3 6h6l2 2h10v11H3z',
  menos: 'M5 12h14',
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export function Icone({ nome, tamanho = 20, ...resto }: { nome: NomeIcone; tamanho?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...resto}
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
