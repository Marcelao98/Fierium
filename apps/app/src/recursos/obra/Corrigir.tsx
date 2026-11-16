// "Corrigir dados…": sugestões pra aplicar com um clique ("É este livro?") e "Editar à mão".
import type { Obra } from '@fierium/contratos';
import { useEffect, useState } from 'react';
import { useFatia } from '../../nucleo/contexto';
import type { PaginaObraEstado } from './estado';

export function CorrigirDados({ estado, obra }: { estado: PaginaObraEstado; obra: Obra }) {
  const { sugestoes, buscandoSugestoes } = useFatia(estado.store, (s) => s);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    void estado.carregarSugestoes().catch(() => undefined); // o aviso já saiu
  }, [estado, obra.id]);
  return (
    <div className="f-cartao" role="group" aria-label="Corrigir dados" style={{ padding: 16, marginTop: 8 }}>
      <h3 style={{ marginBottom: 8 }}>É este livro?</h3>
      {buscandoSugestoes && <p style={{ color: 'var(--texto-3)' }}>Procurando…</p>}
      {!buscandoSugestoes && !sugestoes.length && (
        <p style={{ color: 'var(--texto-3)' }}>
          Nenhuma sugestão por enquanto. Você pode corrigir à mão (e a internet precisa estar ligada nos Ajustes pra eu
          procurar sugestões).
        </p>
      )}
      {sugestoes.map((g) => (
        <div key={g.id} className="sugestao f-cartao">
          {g.capa ? <img src={g.capa} alt="" style={{ width: 56, borderRadius: 3 }} /> : <span />}
          <div>
            <strong>{g.titulo}</strong>
            <small>
              {[
                g.pessoas.map((p) => p.nome).join(', '),
                g.serie ? `${g.serie.nome}, vol. ${g.serie.volume}` : '',
                g.ano ? String(g.ano) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
            <small>
              Origem: {g.origem} · {Math.round(g.confianca * 100)}% de certeza
            </small>
          </div>
          <button
            className="f-botao"
            data-tamanho="p"
            aria-label={`Aplicar: ${g.titulo}`}
            onClick={() => void estado.aplicarSugestao(g.id).catch(() => undefined)}
          >
            Aplicar
          </button>
        </div>
      ))}
      <button
        className="f-botao"
        data-tipo="fantasma"
        data-tamanho="p"
        aria-expanded={manual}
        onClick={() => setManual(!manual)}
      >
        Editar à mão
      </button>
      {manual && <EditarAMao estado={estado} obra={obra} aoSalvar={() => setManual(false)} />}
    </div>
  );
}

function EditarAMao({ estado, obra, aoSalvar }: { estado: PaginaObraEstado; obra: Obra; aoSalvar: () => void }) {
  const [titulo, setTitulo] = useState(obra.titulo);
  const [autores, setAutores] = useState(obra.criadores.map((c) => c.nome).join(', '));
  const [serie, setSerie] = useState(obra.serie?.nome ?? '');
  const [volume, setVolume] = useState(obra.serie ? String(obra.serie.volume) : '');
  const [ano, setAno] = useState(obra.ano ? String(obra.ano) : '');
  return (
    <form
      className="form-editar"
      style={{ marginTop: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        const nomeSerie = serie.trim();
        const n = Number(ano);
        void estado
          .editar({
            titulo: titulo.trim(),
            autores: autores
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean),
            serie: nomeSerie ? { nome: nomeSerie, volume: Number(volume) || 1 } : null,
            ano: ano.trim() && Number.isFinite(n) ? n : null,
          })
          .then(aoSalvar, () => undefined); // o aviso já saiu
      }}
    >
      <label>
        Título
        <input className="f-campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </label>
      <label>
        Autores (separados por vírgula)
        <input className="f-campo" value={autores} onChange={(e) => setAutores(e.target.value)} />
      </label>
      <label>
        Série
        <input className="f-campo" value={serie} onChange={(e) => setSerie(e.target.value)} />
      </label>
      <label>
        Volume
        <input className="f-campo" inputMode="numeric" value={volume} onChange={(e) => setVolume(e.target.value)} />
      </label>
      <label>
        Ano
        <input className="f-campo" inputMode="numeric" value={ano} onChange={(e) => setAno(e.target.value)} />
      </label>
      <div>
        <button className="f-botao" data-tipo="luz" type="submit">
          Salvar
        </button>
      </div>
    </form>
  );
}
