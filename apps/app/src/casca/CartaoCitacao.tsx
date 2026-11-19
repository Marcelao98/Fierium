// A prévia do cartão de citação ("Compartilhar como imagem"): 3 estilos, "Copiar imagem" e "Salvar…". O desenho em si
// está em cartaoCitacao.ts; aqui só a janela. As cores do primeiro estilo vêm do tema da página que a pessoa lê.
import { resolverTema } from '@fierium/leitores';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfig, useServicos } from '../nucleo/contexto';
import { abrirCartao, useNavegacao } from '../nucleo/navegacao';
import { canvasParaPng, desenharCartao, estilosDoCartao, nomeDoArquivo } from './cartaoCitacao';

export function CartaoCitacao() {
  const dados = useNavegacao((s) => s.cartao);
  return dados ? <Previa dados={dados} /> : null;
}

function Previa({ dados }: { dados: NonNullable<ReturnType<typeof useNavegacao.getState>['cartao']> }) {
  const servicos = useServicos();
  const leitura = useConfig()?.leitura;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [escolhido, setEscolhido] = useState(0);
  const [pronto, setPronto] = useState(false);
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState('');

  const estilos = useMemo(() => {
    const t = leitura
      ? resolverTema(leitura.pagina, leitura.temasMeus)
      : { papel: '#f1e6c9', tinta: '#2b2216', nome: '' };
    return estilosDoCartao(t);
  }, [leitura]);

  useEffect(() => {
    const el = canvas.current;
    const estilo = estilos[escolhido];
    if (!el || !estilo) return;
    let vivo = true;
    setPronto(false);
    desenharCartao(el, dados, estilo).then(
      () => vivo && (setPronto(true), setErro('')),
      (e: unknown) => {
        const m = e instanceof Error ? e.message : String(e);
        servicos.log.registrar('erro', 'cartao', m);
        if (vivo) setErro(m);
      },
    );
    return () => {
      vivo = false;
    };
  }, [dados, estilos, escolhido, servicos]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        abrirCartao(null);
      }
    };
    addEventListener('keydown', tecla, true);
    return () => removeEventListener('keydown', tecla, true);
  }, []);

  const png = async () => canvasParaPng(canvas.current!);
  const copiar = async () => {
    try {
      const blob = await png();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setNota('Imagem copiada. Cole na conversa ou no post.');
    } catch {
      setNota('Não consegui copiar a imagem (o sistema não deixou). Use “Salvar…” e envie o arquivo.');
    }
  };
  const salvar = async () => {
    try {
      const blob = await png();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nomeDoArquivo(dados.livro);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setNota(`Salvando ${a.download} na sua pasta de downloads.`);
    } catch (e) {
      setNota(e instanceof Error ? e.message : 'Não consegui salvar a imagem.');
    }
  };

  return (
    <div className="modal-fundo" onPointerDown={(e) => e.target === e.currentTarget && abrirCartao(null)}>
      <div className="modal cartao-previa" role="dialog" aria-modal="true" aria-label="Compartilhar como imagem">
        <h2>Compartilhar como imagem</h2>
        <div className="cartao-previa-corpo">
          <canvas
            ref={canvas}
            className="cartao-canvas"
            aria-label="Prévia do cartão de citação"
            data-pronto={pronto}
          />
          <div className="cartao-previa-lado">
            <p className="modal-sub">1080 × 1350, o formato do Instagram. Escolha o estilo:</p>
            <div className="cartao-estilos" role="group" aria-label="Estilo do cartão">
              {estilos.map((e, i) => (
                <button
                  key={e.id}
                  className="cartao-estilo"
                  aria-pressed={escolhido === i}
                  style={{ background: e.papel, color: e.tinta, borderColor: e.destaque }}
                  onClick={() => setEscolhido(i)}
                >
                  {e.nome}
                </button>
              ))}
            </div>
            {(erro || nota) && (
              <p className="modal-nota" role="status">
                {erro || nota}
              </p>
            )}
            <div className="modal-acoes">
              <button className="f-botao" data-tipo="luz" disabled={!pronto} onClick={() => void copiar()}>
                Copiar imagem
              </button>
              <button className="f-botao" disabled={!pronto} onClick={() => void salvar()}>
                Salvar…
              </button>
              <button className="f-botao" data-tipo="fantasma" onClick={() => abrirCartao(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
