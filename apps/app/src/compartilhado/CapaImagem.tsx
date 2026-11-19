// A capa na tela: o espaço 2:3 já nasce com a capa gerada (o layout não pula); se há imagem, ela carrega por cima e
// aparece com uma troca suave. Imagem que não vem (catálogo sem capa, arquivo sumido) deixa a gerada no lugar.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import './capas.css';

type Fase = 'carregando' | 'pronta' | 'falhou';

export function CapaImagem({ src, gerada }: { src?: string | undefined; gerada: ReactNode }) {
  const [fase, setFase] = useState<Fase>('carregando');
  const [fundoSaiu, setFundoSaiu] = useState(false);
  useEffect(() => {
    setFase('carregando');
    setFundoSaiu(false);
  }, [src]);
  // quando a imagem já apareceu por inteiro, a gerada embaixo não é mais necessária (sai depois da troca suave)
  useEffect(() => {
    if (fase !== 'pronta') return;
    const t = setTimeout(() => setFundoSaiu(true), 500);
    return () => clearTimeout(t);
  }, [fase]);
  // imagem que já estava no cache do navegador pode ter carregado antes do React ligar o onLoad
  const aoMontar = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setFase(img.naturalWidth > 0 ? 'pronta' : 'falhou');
  }, []);
  const comImagem = !!src && fase !== 'falhou';
  return (
    <div className="capa" data-fase={comImagem ? fase : 'gerada'}>
      {!(comImagem && fundoSaiu) && gerada}
      {comImagem && (
        <img
          ref={aoMontar}
          className="capa-imagem"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setFase('pronta')}
          onError={() => setFase('falhou')}
        />
      )}
    </div>
  );
}
