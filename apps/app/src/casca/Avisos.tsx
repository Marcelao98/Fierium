import { useAvisos } from '../nucleo/avisos';

/** Copia o texto; sem permissão da área de transferência, devolve false. */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false; // o sistema não deixou: o texto continua no inspetor (Ctrl+Shift+D)
  }
}

export function Avisos() {
  const lista = useAvisos((s) => s.lista);
  return (
    <div className="avisos" role="status" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className="aviso" data-tipo={a.tipo}>
          <span>{a.texto}</span>
          {a.detalhes && (
            <button
              className="f-botao"
              data-tamanho="p"
              data-tipo="fantasma"
              onClick={(e) => {
                const botao = e.currentTarget;
                void copiar(a.detalhes ?? '').then((ok) => {
                  botao.textContent = ok ? 'Copiado' : 'Não consegui copiar';
                });
              }}
            >
              Copiar detalhes
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
