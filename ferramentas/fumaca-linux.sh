#!/bin/sh
# Teste de fumaça do app de verdade no Linux: abre o executável numa tela virtual (Xvfb), espera, e confere no log em
# arquivo que (1) o núcleo abriu e (2) a interface carregou e falou com o Rust (a linha "Fierium aberto (tauri)" só
# chega lá pelo comando log.escrever, ou seja, pelo IPC). Usa uma pasta de dados temporária (não mexe na sua).
#   sh ferramentas/fumaca-linux.sh [caminho do executável]   (padrão: target/release/fierium)
set -eu
cd "$(dirname "$0")/.."
EXE="${1:-target/release/fierium}"
[ -x "$EXE" ] || { echo "falta o executável $EXE (rode: pnpm tauri build)"; exit 1; }
DADOS="$(mktemp -d)"
trap 'kill "$PID" 2>/dev/null || true; rm -rf "$DADOS"' EXIT
XDG_DATA_HOME="$DADOS" xvfb-run -a "$EXE" > "$DADOS/saida.txt" 2>&1 &
PID=$!
for _ in $(seq 1 40); do
  if grep -qs "Fierium aberto (tauri)" "$DADOS"/fierium/logs/fierium.log.* 2>/dev/null; then
    echo "ok: o núcleo abriu e a interface falou com o Rust"
    grep -h "Fierium aberto" "$DADOS"/fierium/logs/fierium.log.* | sed 's/^/  /'
    exit 0
  fi
  sleep 0.5
done
echo "FALHOU: a interface não mandou a linha pro log em 20 s"
cat "$DADOS"/fierium/logs/fierium.log.* 2>/dev/null | tail -20 || true
tail -20 "$DADOS/saida.txt"
exit 1
