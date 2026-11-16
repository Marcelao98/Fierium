#!/bin/sh
# Instala o Fierium só pra você (sem sudo): o executável em ~/.local/bin, o ícone em todos os tamanhos e o atalho
# (.desktop). Assim ele aparece no menu, abre com o ícone dele na barra de tarefas e dá pra fixar.
# A janela se apresenta como "fierium" (WM_CLASS / app_id), que é o nome do atalho: é isso que liga janela e ícone.
#
#   sh instalar.sh             instala (ou atualiza) a partir desta pasta
#   sh instalar.sh --remover   tira o atalho, os ícones e o executável (os seus dados ficam em ~/.local/share/fierium)
set -eu

AQUI=$(cd "$(dirname "$0")" && pwd)
DADOS=${XDG_DATA_HOME:-$HOME/.local/share}
BIN=$HOME/.local/bin
ATALHO=$DADOS/applications/fierium.desktop
TAMANHOS="32 64 128 256 512"

atualizar_menus() {
  # cada ambiente tem o seu cache; os que não existirem são só pulados
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DADOS/applications" 2>/dev/null || true
  command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t "$DADOS/icons/hicolor" 2>/dev/null || true
  for k in kbuildsycoca6 kbuildsycoca5; do command -v $k >/dev/null 2>&1 && $k >/dev/null 2>&1 && break; done || true
}

if [ "${1:-}" = "--remover" ]; then
  rm -f "$BIN/fierium" "$ATALHO"
  for t in $TAMANHOS; do rm -f "$DADOS/icons/hicolor/${t}x${t}/apps/fierium.png"; done
  atualizar_menus
  echo "Fierium removido. Seus dados continuam em $DADOS/fierium (apague à mão se quiser)."
  exit 0
fi

# o executável: ao lado deste script (pacote) ou o compilado no repositório
EXE=""
for c in "$AQUI/fierium" "$AQUI/../target/release/fierium"; do [ -f "$c" ] && EXE=$c && break; done
[ -n "$EXE" ] || { echo "Não achei o executável 'fierium' ao lado deste script." >&2; exit 1; }

# os ícones: a pasta icones/ do pacote ou os do app no repositório
ICONES=""
for c in "$AQUI/icones" "$AQUI/../crates/fierium-app/icons"; do [ -d "$c" ] && ICONES=$c && break; done
[ -n "$ICONES" ] || { echo "Não achei a pasta de ícones ao lado deste script." >&2; exit 1; }

install -Dm755 "$EXE" "$BIN/fierium"
for t in $TAMANHOS; do
  # usa o tamanho exato se tiver; senão o maior (o sistema reduz)
  origem=""
  for nome in "${t}x${t}.png" "fierium-${t}.png"; do [ -f "$ICONES/$nome" ] && origem="$ICONES/$nome" && break; done
  if [ -z "$origem" ]; then
    for nome in icon.png 512x512.png 256x256.png 128x128.png; do [ -f "$ICONES/$nome" ] && origem="$ICONES/$nome" && break; done
  fi
  [ -n "$origem" ] || { echo "Não achei um ícone de ${t}px em $ICONES." >&2; exit 1; }
  install -Dm644 "$origem" "$DADOS/icons/hicolor/${t}x${t}/apps/fierium.png"
done

mkdir -p "$(dirname "$ATALHO")"
cat > "$ATALHO" <<EOF
[Desktop Entry]
Type=Application
Name=Fierium
GenericName=Biblioteca e leitor de livros
Comment=Sua biblioteca, com leitores de PDF e EPUB
Exec=$BIN/fierium
Icon=fierium
Terminal=false
Categories=Office;Viewer;Literature;
Keywords=livros;biblioteca;pdf;epub;leitor;
StartupWMClass=fierium
StartupNotify=true
EOF
chmod 644 "$ATALHO"
atualizar_menus

echo "Fierium instalado: procure \"Fierium\" no menu. Com ele aberto, clique com o botão direito no ícone da barra"
echo "e escolha \"Fixar no gerenciador de tarefas\" (ou arraste do menu pra barra)."
