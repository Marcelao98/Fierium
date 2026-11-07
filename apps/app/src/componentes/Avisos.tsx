import { useAvisos } from '../estado/avisos';

export function Avisos() {
  const lista = useAvisos((s) => s.lista);
  return (
    <div className="avisos" role="status" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className="aviso" data-tipo={a.tipo}>
          {a.texto}
        </div>
      ))}
    </div>
  );
}
