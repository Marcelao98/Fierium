// A barra lateral (computador) e a de baixo (celular): os mesmos destinos, duas posturas (§12.2 da visão).
import { Icone, SeloFieri, type NomeIcone } from '@fierium/ui';
import { invocar, ir, useNavegacao, type Rota } from '../nucleo/navegacao';

const DESTINOS: { nome: string; icone: NomeIcone; rota: Rota; ativo: (r: Rota) => boolean; celular: boolean }[] = [
  { nome: 'Início', icone: 'limiar', rota: { tela: 'inicio' }, ativo: (r) => r.tela === 'inicio', celular: true },
  {
    nome: 'Biblioteca',
    icone: 'biblioteca',
    rota: { tela: 'biblioteca', lente: 'grade' },
    ativo: (r) => r.tela === 'biblioteca' || r.tela === 'obra',
    celular: true,
  },
  {
    nome: 'Coleções',
    icone: 'colecoes',
    rota: { tela: 'colecoes' },
    ativo: (r) => r.tela === 'colecoes' || r.tela === 'colecao',
    celular: false,
  },
  { nome: 'Notas', icone: 'marginalia', rota: { tela: 'notas' }, ativo: (r) => r.tela === 'notas', celular: true },
  {
    nome: 'Estatísticas',
    icone: 'cronica',
    rota: { tela: 'estatisticas' },
    ativo: (r) => r.tela === 'estatisticas',
    celular: true,
  },
];

export function Lateral() {
  const rota = useNavegacao((s) => s.rota);
  return (
    <nav className="lateral" aria-label="Principal">
      <button className="lateral-marca" onClick={() => ir({ tela: 'inicio' })} aria-label="Fierium — Início">
        <SeloFieri tamanho={34} />
      </button>
      <button className="lateral-item" onClick={() => invocar()} title="Buscar (Ctrl+K)">
        <Icone nome="buscar" />
        <span>Buscar</span>
      </button>
      <div className="lateral-grupo">
        {DESTINOS.map((d) => (
          <button
            key={d.nome}
            className="lateral-item"
            aria-current={d.ativo(rota) ? 'page' : undefined}
            onClick={() => ir(d.rota)}
          >
            <Icone nome={d.icone} />
            <span>{d.nome}</span>
          </button>
        ))}
      </div>
      <button
        className="lateral-item lateral-fim"
        aria-current={rota.tela === 'ajustes' ? 'page' : undefined}
        onClick={() => ir({ tela: 'ajustes' })}
      >
        <Icone nome="ajustes" />
        <span>Ajustes</span>
      </button>
    </nav>
  );
}

export function BarraInferior() {
  const rota = useNavegacao((s) => s.rota);
  return (
    <nav className="barra-inferior" aria-label="Principal">
      {DESTINOS.filter((d) => d.celular).map((d) => (
        <button key={d.nome} aria-current={d.ativo(rota) ? 'page' : undefined} onClick={() => ir(d.rota)}>
          <Icone nome={d.icone} />
          <span>{d.nome}</span>
        </button>
      ))}
      <button onClick={() => invocar()} aria-label="Buscar">
        <Icone nome="buscar" />
        <span>Buscar</span>
      </button>
    </nav>
  );
}
