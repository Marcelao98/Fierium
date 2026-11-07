// Invocar (Ctrl+K): chegar em qualquer coisa na hora. Obras, autores, coleções, marcações e comandos.
import type { ResultadoBusca } from '@fierium/contratos';
import { Icone, type NomeIcone } from '@fierium/ui';
import { useEffect, useRef, useState } from 'react';
import { useBiblioteca } from '../estado/biblioteca';
import { mudarConfig, useConfig } from '../estado/config';
import { buscarTudo } from '../estado/invocar';
import { abrirLeitura, invocar, ir, useNavegacao } from '../estado/navegacao';

interface Opcao {
  id: string;
  icone: NomeIcone;
  titulo: string;
  detalhe: string;
  fazer: () => void;
}

const ICONE: Record<ResultadoBusca['tipo'], NomeIcone> = {
  obra: 'ler',
  colecao: 'colecoes',
  criador: 'estrela',
  marcacao: 'marcador',
};

export function Invocar() {
  const aberto = useNavegacao((s) => s.invocarAberto);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [i, setI] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const ultimo = useBiblioteca((s) => s.limiar?.ultimo);
  const tema = useConfig((s) => s.config?.tema);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        invocar(!useNavegacao.getState().invocarAberto);
      }
    };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, []);

  useEffect(() => {
    if (aberto) {
      setTexto('');
      setResultados([]);
      setI(0);
      setTimeout(() => campo.current?.focus(), 10);
    }
  }, [aberto]);

  useEffect(() => {
    if (!texto.trim()) return;
    let vale = true;
    const t = setTimeout(() => {
      void buscarTudo(texto).then((r) => {
        if (vale) {
          setResultados(r);
          setI(0);
        }
      });
    }, 90);
    return () => {
      vale = false;
      clearTimeout(t);
    };
  }, [texto]);

  if (!aberto) return null;
  const comandos: Opcao[] = [
    ...(ultimo
      ? [
          {
            id: 'continuar',
            icone: 'ler' as const,
            titulo: `Continuar ${ultimo.titulo}`,
            detalhe: 'O último sonho',
            fazer: () =>
              abrirLeitura({ obraId: ultimo.id, edicaoId: ultimo.edicoes[0]!.id, origem: { x: innerWidth / 2, y: innerHeight / 2 } }),
          },
        ]
      : []),
    { id: 'biblio', icone: 'indice', titulo: 'Ir para a Biblioteca', detalhe: 'Índice', fazer: () => ir({ tela: 'biblioteca', lente: 'indice' }) },
    { id: 'atlas', icone: 'atlas', titulo: 'Abrir o Atlas', detalhe: 'A biblioteca como um céu', fazer: () => ir({ tela: 'biblioteca', lente: 'atlas' }) },
    { id: 'margin', icone: 'marginalia', titulo: 'Marginália', detalhe: 'Todas as marcações e notas', fazer: () => ir({ tela: 'marginalia' }) },
    { id: 'cronica', icone: 'cronica', titulo: 'Crônica', detalhe: 'Estatísticas e metas', fazer: () => ir({ tela: 'cronica' }) },
    {
      id: 'tema',
      icone: tema === 'lucido' ? 'lua' : 'sol',
      titulo: tema === 'lucido' ? 'Tema Noite' : 'Tema Lúcido',
      detalhe: 'Trocar o tema do app',
      fazer: () => void mudarConfig((c) => ({ ...c, tema: c.tema === 'lucido' ? 'noite' : 'lucido' })),
    },
    { id: 'ajustes', icone: 'ajustes', titulo: 'Ajustes', detalhe: '', fazer: () => ir({ tela: 'ajustes' }) },
  ];
  const deBusca: Opcao[] = resultados.map((r) => ({
    id: r.tipo + r.id,
    icone: ICONE[r.tipo],
    titulo: r.titulo,
    detalhe: r.detalhe,
    fazer: () => {
      if (r.tipo === 'colecao') ir({ tela: 'colecao', id: r.id });
      else if (r.tipo === 'criador') {
        ir({ tela: 'biblioteca', lente: 'indice' });
        window.dispatchEvent(new CustomEvent('fierium:buscar', { detail: r.titulo }));
      } else if (r.obraId) ir({ tela: 'obra', id: r.obraId });
    },
  }));
  const opcoes = texto.trim() ? [...deBusca, ...comandos.filter((c) => c.titulo.toLowerCase().includes(texto.toLowerCase()))] : comandos;
  const escolher = (o: Opcao | undefined) => {
    if (!o) return;
    invocar(false);
    o.fazer();
  };
  return (
    <div className="invocar-fundo" onMouseDown={() => invocar(false)}>
      <div className="invocar" role="dialog" aria-label="Invocar" onMouseDown={(e) => e.stopPropagation()}>
        <div className="invocar-campo">
          <Icone nome="buscar" />
          <input
            ref={campo}
            value={texto}
            placeholder="Invocar uma obra, um autor, uma frase marcada…"
            aria-label="Invocar"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') invocar(false);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setI((x) => Math.min(opcoes.length - 1, x + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              }
              if (e.key === 'Enter') escolher(opcoes[i]);
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="invocar-lista" role="listbox">
          {opcoes.map((o, k) => (
            <li key={o.id} role="option" aria-selected={k === i}>
              <button onMouseEnter={() => setI(k)} onClick={() => escolher(o)}>
                <Icone nome={o.icone} />
                <span className="invocar-titulo">{o.titulo}</span>
                <span className="invocar-detalhe">{o.detalhe}</span>
              </button>
            </li>
          ))}
          {texto.trim() && !opcoes.length && <li className="invocar-vazio">Nada com esse nome no seu reino.</li>}
        </ul>
      </div>
    </div>
  );
}
