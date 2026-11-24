<p align="center">
  <img src="site/selo.svg" width="120" alt="Selo de Fieri: um astrolábio com a lua e a centelha">
</p>

<h1 align="center">Fierium</h1>

<p align="center">
  <em>Tudo que já foi imaginado está no mapa de Fieri.</em><br>
  Sua biblioteca pessoal: leitor de PDF e EPUB, notas e citações. Offline, sem conta, sem nuvem.
</p>

<p align="center">
  <a href="https://marcelao98.github.io/Fierium/">Site</a> ·
  <a href="https://github.com/Marcelao98/Fierium/releases/latest">Baixar</a> ·
  <a href="docs/INSTALAR.md">Como instalar</a> ·
  <a href="CHANGELOG.md">Novidades</a>
</p>

<p align="center">
  <img src="site/imagens/inicio.webp" width="92%" alt="O Início do Fierium: a frase do mapa de Fieri, a obra que você está lendo e uma citação marcada">
</p>

## Baixar

Windows (`.exe`) e Linux (AppImage, `.rpm`, `.deb`) na página de
[Releases](https://github.com/Marcelao98/Fierium/releases/latest). No Windows, o SmartScreen pode avisar (o
instalador não tem certificado pago): **Mais informações → Executar assim mesmo**. Passo a passo em
[docs/INSTALAR.md](docs/INSTALAR.md). Depois de instalado, o Fierium avisa sozinho quando sai versão nova.

## O que ele faz

<table>
  <tr>
    <td width="50%"><img src="site/imagens/leitor.webp" alt="O leitor com página em pergaminho e trechos marcados"><br><sub><b>PDF e EPUB</b> no mesmo leitor, com progresso salvo</sub></td>
    <td width="50%"><img src="site/imagens/temas.webp" alt="Painel com cerca de 100 temas de página"><br><sub><b>100 temas de página</b>, mais cor de papel e de letra livres</sub></td>
  </tr>
  <tr>
    <td><img src="site/imagens/notas.webp" alt="Página de Notas com as citações marcadas"><br><sub><b>Notas e citações</b>: marque em cores, copie em ABNT, exporte em Markdown</sub></td>
    <td><img src="site/imagens/descobrir.webp" alt="Descobrir: catálogo de clássicos em domínio público"><br><sub><b>Catálogo de clássicos</b> (Projeto Gutenberg): baixar e ler</sub></td>
  </tr>
  <tr>
    <td><img src="site/imagens/biblioteca.webp" alt="Biblioteca em grade com capas desenhadas"><br><sub><b>Capas bonitas</b>, até pra livro sem capa</sub></td>
    <td><img src="site/imagens/cartao.webp" alt="Cartão de citação em estilo Céu antigo"><br><sub><b>Cartão de citação</b> 1080×1350 pra compartilhar</sub></td>
  </tr>
</table>

## Privacidade

Sem conta. Funciona offline (a internet só é usada pelo catálogo, quando você pede, e dá pra desligar). Notas,
marcações e progresso ficam no seu computador. O Fierium só lê os seus livros: nunca altera os seus arquivos.

## Rodar pra desenvolver

Precisa de **Node 22+**, **pnpm 10** e, pro programa de verdade, **Rust (rustup)** e as bibliotecas do Tauri
(Fedora: `sudo dnf install webkit2gtk4.1-devel gtk3-devel librsvg2-devel libsoup3-devel`; Ubuntu/Debian:
`sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libsoup-3.0-dev`).

```bash
pnpm install
pnpm dev          # a interface no navegador, com a biblioteca de exemplo
pnpm tauri dev    # o programa de verdade (Rust + interface)
pnpm check        # formato, lint, tipos e testes   (pnpm check:rust pro Rust, pnpm e2e pros fluxos)
```

Os prints e o vídeo do site saem de `node ferramentas/vitrine/prints.mjs`; o site (`site/`) é publicado no GitHub
Pages pelo workflow `site.yml`. Arquitetura, decisões e roadmap: [ARQUITETURA](docs/ARQUITETURA.md),
[DECISOES](docs/DECISOES.md), [ROADMAP](docs/ROADMAP.md), [IDENTIDADE](docs/IDENTIDADE.md) e a
[visão de produto](docs/FIERIUM_PRODUCT_VISION.md). Agentes de IA: comecem pelo [AGENTS.md](AGENTS.md).

## Licença

Ainda em aberto (D14 em [docs/DECISOES.md](docs/DECISOES.md)): até o dono decidir, nenhum uso está liberado além
de ler o código.

O Fierium não inclui nem indica onde baixar livros protegidos; os clássicos do catálogo são de domínio público.
