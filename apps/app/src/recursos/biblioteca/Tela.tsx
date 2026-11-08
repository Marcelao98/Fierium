// Biblioteca: duas lentes sobre o mesmo acervo. Grade/lista (precisa, rápida) e mapa (a biblioteca como um céu).
import type { EstadoLeitura, Formato, Ordem } from '@fierium/contratos';
import { Icone } from '@fierium/ui';
import { useEffect, useMemo, useState } from 'react';
import { autorDe, Capa, CartaoObra, fracaoDe } from '../../compartilhado/Obras';
import { useFatia } from '../../nucleo/contexto';
import { ir } from '../../nucleo/navegacao';
import type { Biblioteca } from './estado';
import { Mapa } from './Mapa';
import './biblioteca.css';

const ESTADOS: [EstadoLeitura | undefined, string][] = [
  [undefined, 'Todas'],
  ['lendo', 'Lendo'],
  ['nao-lida', 'Não lidas'],
  ['lida', 'Lidas'],
];
const FORMATOS: [Formato | '', string][] = [
  ['', 'Todos os formatos'],
  ['pdf', 'PDF'],
  ['epub', 'EPUB'],
  ['cbz', 'Mangá / HQ'],
];
const ORDENS: [Ordem, string][] = [
  ['recentes', 'Recentes'],
  ['titulo', 'Título'],
  ['autor', 'Autor'],
  ['progresso', 'Progresso'],
];

export function TelaBiblioteca({ biblioteca, lente }: { biblioteca: Biblioteca; lente: 'grade' | 'mapa' }) {
  const { lista, filtro, visao, todas, carregando } = useFatia(biblioteca.store, (s) => s);
  const { filtrar, mudarVisao } = biblioteca;
  const [texto, setTexto] = useState(filtro.texto ?? '');
  const areas = useMemo(
    () => [...new Set(todas.map((o) => o.reino))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [todas],
  );

  useEffect(() => {
    void biblioteca.carregar().catch(() => undefined);
    const deFora = (e: Event) => {
      const t = (e as CustomEvent<string>).detail;
      setTexto(t);
      void filtrar({ texto: t }).catch(() => undefined);
    };
    addEventListener('fierium:buscar', deFora);
    return () => removeEventListener('fierium:buscar', deFora);
  }, [biblioteca, filtrar]);

  useEffect(() => {
    const t = setTimeout(() => void filtrar({ texto: texto.trim() || undefined }).catch(() => undefined), 120);
    return () => clearTimeout(t);
  }, [texto, filtrar]);

  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Biblioteca</h1>
          <p>{todas.length} obras</p>
        </div>
        <div className="alternar" role="group" aria-label="Lente">
          <button aria-pressed={lente === 'grade'} onClick={() => ir({ tela: 'biblioteca', lente: 'grade' })}>
            <Icone nome="indice" tamanho={16} /> Grade
          </button>
          <button aria-pressed={lente === 'mapa'} onClick={() => ir({ tela: 'biblioteca', lente: 'mapa' })}>
            <Icone nome="atlas" tamanho={16} /> Mapa
          </button>
        </div>
      </div>

      {lente === 'mapa' ? (
        <Mapa obras={todas} />
      ) : (
        <>
          <div className="barra-ferramentas">
            <input
              className="f-campo"
              type="search"
              placeholder="Buscar por título, autor, assunto…"
              aria-label="Buscar na biblioteca"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <select
              className="f-campo"
              aria-label="Área"
              value={filtro.reino ?? ''}
              onChange={(e) => void filtrar({ reino: e.target.value || undefined })}
            >
              <option value="">Todas as áreas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              className="f-campo"
              aria-label="Formato"
              value={filtro.formato ?? ''}
              onChange={(e) => void filtrar({ formato: (e.target.value || undefined) as Formato | undefined })}
            >
              {FORMATOS.map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
            <select
              className="f-campo"
              aria-label="Ordenar"
              value={filtro.ordem ?? 'recentes'}
              onChange={(e) => void filtrar({ ordem: e.target.value as Ordem })}
            >
              {ORDENS.map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
            <div className="alternar" role="group" aria-label="Visão">
              <button aria-pressed={visao === 'grade'} aria-label="Grade" onClick={() => mudarVisao('grade')}>
                <Icone nome="indice" tamanho={16} />
              </button>
              <button aria-pressed={visao === 'lista'} aria-label="Lista" onClick={() => mudarVisao('lista')}>
                <Icone nome="lista" tamanho={16} />
              </button>
            </div>
          </div>
          <div className="chips">
            {ESTADOS.map(([v, n]) => (
              <button
                key={n}
                className="f-chip"
                aria-pressed={filtro.estado === v && !filtro.favoritas}
                onClick={() => void filtrar({ estado: v, favoritas: undefined })}
              >
                {n}
              </button>
            ))}
            <button
              className="f-chip"
              aria-pressed={!!filtro.favoritas}
              onClick={() => void filtrar({ favoritas: filtro.favoritas ? undefined : true })}
            >
              ✦ Favoritas
            </button>
            <span className="contagem" aria-live="polite">
              {carregando ? 'buscando…' : `${lista.length} ${lista.length === 1 ? 'obra' : 'obras'}`}
            </span>
          </div>

          {!lista.length && !carregando ? (
            <div className="vazio">
              <h2>Nenhuma obra assim</h2>
              <p>Tente outras palavras ou limpe os filtros.</p>
            </div>
          ) : visao === 'grade' ? (
            <div className="grade">
              {lista.map((o) => (
                <CartaoObra key={o.id} obra={o} />
              ))}
            </div>
          ) : (
            <div className="lista-obras" role="list">
              {lista.map((o) => (
                <button
                  key={o.id}
                  role="listitem"
                  className="linha-obra"
                  onClick={() => ir({ tela: 'obra', id: o.id })}
                >
                  <Capa obra={o} compacto />
                  <span>{o.titulo}</span>
                  <span className="secundario">{autorDe(o)}</span>
                  <span className="secundario">{o.edicoes[0]?.formato.toUpperCase()}</span>
                  <span className="secundario">
                    {o.relacao.estado === 'lida'
                      ? 'Lida'
                      : fracaoDe(o) > 0
                        ? `${Math.round(fracaoDe(o) * 100)}%`
                        : 'Não lida'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
