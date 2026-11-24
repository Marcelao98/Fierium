// A casca do EPUB: o elemento raiz, o palco onde o epub.js desenha e os botões ‹ › pra virar capítulo.

const botao = (doc: Document, rotulo: string, texto: string, lado: 'left' | 'right') => {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = 'fl-epub-nav';
  b.setAttribute('aria-label', rotulo);
  b.textContent = texto;
  b.style.cssText = `position:absolute;${lado}:8px;top:50%;transform:translateY(-50%);z-index:5;width:40px;height:56px;border:0;border-radius:12px;background:rgba(127,127,127,.28);color:inherit;font-size:22px;cursor:pointer;opacity:.7;`;
  return b;
};

export function criarCasca(doc: Document, alvo: HTMLElement) {
  const raiz = doc.createElement('div');
  raiz.className = 'fl-epub';
  raiz.style.cssText = 'position:relative;width:100%;height:100%;';
  const palco = doc.createElement('div');
  palco.style.cssText = 'width:100%;height:100%;';
  raiz.append(palco);
  const anterior = botao(doc, 'Capítulo anterior', '‹', 'left');
  const proximo = botao(doc, 'Próximo capítulo', '›', 'right');
  raiz.append(anterior, proximo);
  alvo.append(raiz);
  return { raiz, palco, anterior, proximo };
}
