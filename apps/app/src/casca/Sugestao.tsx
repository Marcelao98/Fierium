// O painel "Mandar sugestão ou problema". A pessoa escreve; o painel junta a versão, o sistema e as últimas linhas do
// registro do app, e oferece copiar (pra colar no WhatsApp) ou abrir uma issue no GitHub. Nunca envia nada sozinho.
import { useEffect, useRef, useState } from 'react';
import { useServicos } from '../nucleo/contexto';
import { sugestao, useNavegacao } from '../nucleo/navegacao';
import { linkDoGitHub, linhasDoLog, montarMensagem } from './sugestao';

export function PainelSugestao() {
  const aberto = useNavegacao((s) => s.sugestaoAberta);
  return aberto ? <Painel /> : null;
}

function Painel() {
  const servicos = useServicos();
  const [texto, setTexto] = useState('');
  const [info, setInfo] = useState({ versao: '', plataforma: '' });
  const [nota, setNota] = useState('');
  const campo = useRef<HTMLTextAreaElement>(null);
  const [registros] = useState(() => servicos.log.recentes().slice());

  useEffect(() => {
    campo.current?.focus();
    void servicos.chamar('app.info', {}).then(
      (i) => setInfo({ versao: i.versao, plataforma: i.plataforma }),
      () => undefined, // sem a versão, o texto sai com "?" e o aviso do erro já apareceu
    );
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sugestao(false);
    };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, [servicos]);

  const mensagem = montarMensagem({
    texto,
    versao: info.versao,
    plataforma: info.plataforma,
    sistema: navigator.userAgent,
    log: registros,
  });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setNota('Copiado. Agora é só colar na conversa.');
    } catch {
      setNota(
        'Não consegui copiar: o sistema não deixou acessar a área de transferência. Selecione o texto abaixo e copie.',
      );
    }
  };
  const abrirGitHub = async () => {
    const ok = await servicos.abrirLink(linkDoGitHub(texto, mensagem));
    setNota(
      ok
        ? 'Abri o GitHub no seu navegador. Confira o texto e clique em enviar lá.'
        : 'Não consegui abrir o navegador. Use “Copiar” e cole na conversa.',
    );
  };

  return (
    <div className="modal-fundo" onPointerDown={(e) => e.target === e.currentTarget && sugestao(false)}>
      <div className="modal sugestao" role="dialog" aria-modal="true" aria-label="Mandar sugestão ou problema">
        <h2>Mandar sugestão ou problema</h2>
        <p className="modal-sub">
          Conte o que aconteceu ou a ideia que você teve. Nada é enviado sozinho: você copia ou abre no GitHub.
        </p>
        <textarea
          ref={campo}
          className="f-campo"
          rows={5}
          aria-label="O que você quer contar"
          placeholder="Ex.: ao abrir um EPUB grande a tela ficou branca…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <details>
          <summary>O que vai junto ({linhasDoLog(registros).length} linhas do registro, a versão e o sistema)</summary>
          <pre className="sugestao-previa" aria-label="Texto completo da mensagem">
            {mensagem}
          </pre>
        </details>
        {nota && (
          <p className="modal-nota" role="status">
            {nota}
          </p>
        )}
        <div className="modal-acoes">
          <button className="f-botao" data-tipo="luz" onClick={() => void copiar()}>
            Copiar
          </button>
          <button className="f-botao" onClick={() => void abrirGitHub()}>
            Abrir no GitHub
          </button>
          <button className="f-botao" data-tipo="fantasma" onClick={() => sugestao(false)}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
