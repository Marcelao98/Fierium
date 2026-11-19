# Como instalar o Fierium

Baixe sempre da página de **Releases** do projeto: https://github.com/Marcelao98/Fierium/releases/latest

## Windows

1. Na Release mais nova, baixe o arquivo que termina em **`-setup.exe`** (o `.msi` é a mesma coisa pra quem
   prefere esse formato).
2. Dê dois cliques. O Windows pode mostrar uma tela azul: **"O Windows protegeu o computador" (SmartScreen)**. Isso
   acontece porque o instalador não tem o certificado pago da Microsoft, não porque tenha algo errado. Clique em
   **"Mais informações"** e depois em **"Executar assim mesmo"**.
3. Siga o instalador (em português). Se faltar o WebView2 (o motor de páginas do Windows), ele baixa sozinho.
4. Abra o Fierium pelo menu Iniciar e, nos Ajustes, escolha a pasta dos seus livros.

Depois de instalado, o Fierium avisa quando sai versão nova: é só clicar em **"Atualizar e reiniciar"**.

## Linux

Escolha um (todos estão na Release):

- **AppImage**: `chmod +x Fierium_*.AppImage` e rode. Não instala nada.
- **Fedora, openSUSE** (`.rpm`): `sudo dnf install ./Fierium-*.rpm`
- **Debian, Ubuntu, Mint** (`.deb`): `sudo apt install ./Fierium_*.deb`

## Seus dados

O Fierium nunca mexe nos seus livros. As coisas dele ficam em `%APPDATA%\Fierium` (Windows) ou
`~/.local/share/fierium` (Linux); o log do dia fica lá também, e ajuda se algo der errado.
