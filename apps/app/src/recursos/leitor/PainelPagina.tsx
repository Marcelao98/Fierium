// A seção "Página" do painel de aparência: grade de temas (agrupada, com busca e prévia ao passar o mouse) e o
// "Personalizar" (cor do papel e da letra livres, brilho, contraste, luz quente, manter figuras coloridas, e salvar
// como "meu tema"). Vale pra PDF e EPUB; quem pinta é o motor (@fierium/leitores).
import type { ConfigLeitura, PaginaLeitura, TemaMeu } from '@fierium/contratos';
import {
  buscarTemas,
  contraste,
  GRUPOS_TEMAS,
  normalizarHex,
  PAGINA_PADRAO,
  resolverTema,
  TEMAS_PAGINA,
} from '@fierium/leitores';
import { useEffect, useState } from 'react';

interface Props {
  cfg: ConfigLeitura;
  mudar(m: Partial<ConfigLeitura>): void;
  /** mostra um tema só de passagem (mouse em cima); null desfaz */
  previa(p: PaginaLeitura | null): void;
}

interface Amostra {
  id: string;
  nome: string;
  papel: string;
  tinta: string;
}

const MIN_CONTRASTE = 4.5;

function CampoCor({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar(hex: string): void }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  const ok = normalizarHex(texto) !== null;
  return (
    <div className="campo-cor">
      <input
        type="color"
        aria-label={`${rotulo} (seletor)`}
        value={valor}
        onChange={(e) => aoMudar(e.target.value.toLowerCase())}
      />
      <input
        type="text"
        className="campo-cor-hex"
        aria-label={`${rotulo} (hex)`}
        aria-invalid={!ok}
        spellCheck={false}
        maxLength={7}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          const h = normalizarHex(e.target.value);
          if (h) aoMudar(h);
        }}
      />
      <span>{rotulo}</span>
    </div>
  );
}

export function PainelPagina({ cfg, mudar, previa }: Props) {
  const [busca, setBusca] = useState('');
  const [personalizando, setPersonalizando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const pagina = cfg.pagina;
  const atual = resolverTema(pagina, cfg.temasMeus);
  const razao = contraste(atual.papel, atual.tinta);

  const mudarPagina = (m: Partial<PaginaLeitura>) => mudar({ pagina: { ...pagina, ...m } });
  const escolher = (id: string) => {
    previa(null);
    mudar({ pagina: { ...pagina, tema: id, papel: undefined, tinta: undefined } });
  };
  const cores = (papel: string, tinta: string) => mudarPagina({ tema: 'personalizado', papel, tinta: tinta });

  const meus = buscarTemas(cfg.temasMeus, busca);
  const grupos = GRUPOS_TEMAS.map((g) => ({
    grupo: g,
    temas: buscarTemas(
      TEMAS_PAGINA.filter((t) => t.grupo === g),
      busca,
    ),
  })).filter((g) => g.temas.length);

  const amostra = (t: Amostra, extra?: React.ReactNode) => (
    <div key={t.id} className="tema-celula">
      <button
        className="tema-amostra"
        style={{ background: t.papel, color: t.tinta }}
        aria-pressed={pagina.tema === t.id}
        aria-label={`Página ${t.nome}`}
        title={t.nome}
        onClick={() => escolher(t.id)}
        onMouseEnter={() => previa({ ...pagina, tema: t.id, papel: undefined, tinta: undefined })}
        onMouseLeave={() => previa(null)}
        onFocus={() => previa({ ...pagina, tema: t.id, papel: undefined, tinta: undefined })}
        onBlur={() => previa(null)}
      >
        <span className="tema-aa">Aa</span>
        <small>{t.nome}</small>
      </button>
      {extra}
    </div>
  );

  function salvar() {
    const nome = nomeNovo.trim() || 'Meu tema';
    const novo: TemaMeu = { id: `meu-${Date.now().toString(36)}`, nome, papel: atual.papel, tinta: atual.tinta };
    mudar({
      temasMeus: [...cfg.temasMeus, novo],
      pagina: { ...pagina, tema: novo.id, papel: undefined, tinta: undefined },
    });
    setNomeNovo('');
  }
  function apagar(id: string) {
    mudar({
      temasMeus: cfg.temasMeus.filter((m) => m.id !== id),
      pagina: pagina.tema === id ? { ...pagina, tema: PAGINA_PADRAO.tema, papel: undefined, tinta: undefined } : pagina,
    });
  }
  function renomear(id: string, nome: string) {
    const limpo = nome.trim();
    if (limpo) mudar({ temasMeus: cfg.temasMeus.map((m) => (m.id === id ? { ...m, nome: limpo } : m)) });
    setRenomeando(null);
  }

  return (
    <section aria-label="Página" className="painel-pagina">
      <h3>Página</h3>
      <input
        type="search"
        className="painel-busca"
        placeholder="Buscar tema…"
        aria-label="Buscar tema da página"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {meus.length > 0 && (
        <div className="temas-grupo">
          <h4>Meus temas</h4>
          <div className="temas-grade">
            {meus.map((m) =>
              amostra(
                m,
                <span className="tema-acoes">
                  {renomeando === m.id ? (
                    <input
                      autoFocus
                      aria-label={`Novo nome de ${m.nome}`}
                      defaultValue={m.nome}
                      onBlur={(e) => renomear(m.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renomear(m.id, e.currentTarget.value);
                        if (e.key === 'Escape') setRenomeando(null);
                        e.stopPropagation();
                      }}
                    />
                  ) : (
                    <>
                      <button aria-label={`Renomear ${m.nome}`} onClick={() => setRenomeando(m.id)}>
                        Renomear
                      </button>
                      <button aria-label={`Apagar ${m.nome}`} onClick={() => apagar(m.id)}>
                        Apagar
                      </button>
                    </>
                  )}
                </span>,
              ),
            )}
          </div>
        </div>
      )}

      {grupos.map((g) => (
        <div key={g.grupo} className="temas-grupo">
          <h4>{g.grupo}</h4>
          <div className="temas-grade">{g.temas.map((t) => amostra(t))}</div>
        </div>
      ))}
      {!meus.length && !grupos.length && <p className="painel-vazio">Nenhum tema com esse nome.</p>}

      <button
        className="f-botao"
        data-tamanho="p"
        aria-expanded={personalizando}
        onClick={() => setPersonalizando(!personalizando)}
      >
        Personalizar
      </button>

      {personalizando && (
        <div className="personalizar" role="group" aria-label="Personalizar a página">
          <CampoCor rotulo="Cor do papel" valor={atual.papel} aoMudar={(h) => cores(h, atual.tinta)} />
          <CampoCor rotulo="Cor da letra" valor={atual.tinta} aoMudar={(h) => cores(atual.papel, h)} />
          {razao < MIN_CONTRASTE && (
            <p role="status" className="aviso-contraste">
              Contraste baixo ({razao.toFixed(1).replace('.', ',')}:1): o texto pode ficar difícil de ler. O ideal é
              pelo menos 4,5:1.
            </p>
          )}
          <label className="leitor-controle">
            Brilho
            <input
              type="range"
              min={-100}
              max={100}
              value={pagina.brilho}
              onChange={(e) => mudarPagina({ brilho: Number(e.target.value) })}
            />
            <span>{pagina.brilho}</span>
          </label>
          <label className="leitor-controle">
            Contraste
            <input
              type="range"
              min={20}
              max={200}
              value={pagina.contraste}
              onChange={(e) => mudarPagina({ contraste: Number(e.target.value) })}
            />
            <span>{pagina.contraste}</span>
          </label>
          <label className="leitor-controle">
            Luz quente
            <input
              type="range"
              min={0}
              max={100}
              value={pagina.quente}
              onChange={(e) => mudarPagina({ quente: Number(e.target.value) })}
            />
            <span>{pagina.quente}</span>
          </label>
          <label className="leitor-marcar">
            <input
              type="checkbox"
              checked={pagina.manterCores}
              onChange={(e) => mudarPagina({ manterCores: e.target.checked })}
            />
            Manter as figuras coloridas
          </label>
          <button
            className="f-botao"
            data-tamanho="p"
            onClick={() => mudarPagina({ brilho: 0, contraste: 100, quente: 0, manterCores: true })}
          >
            Restaurar ajustes
          </button>
          <div className="salvar-tema">
            <input
              type="text"
              aria-label="Nome do tema"
              placeholder="Nome do tema"
              maxLength={40}
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') salvar();
              }}
            />
            <button className="f-botao" data-tamanho="p" onClick={salvar}>
              Salvar como meu tema
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
