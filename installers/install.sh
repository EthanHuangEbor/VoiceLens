# voicelens one-shot installer (POSIX: macOS / Linux).
# Copies the universal skill into every detected harness skill dir and links the CLI.
set -e

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)/skills/voicelens"

install_skill() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  cp -R "$SKILL_DIR" "$dest"
  echo "skill -> $dest"
}

[ -d "$HOME/.claude" ] && install_skill "$HOME/.claude/skills/voicelens"
[ -d "$HOME/.codex" ] && install_skill "$HOME/.codex/skills/voicelens"
[ -d "$HOME/.agents" ] && install_skill "$HOME/.agents/skills/voicelens"
[ -d "${DSH_HOME:-$HOME/.dsh}" ] && install_skill "${DSH_HOME:-$HOME/.dsh}/skills/voicelens"

echo "linking CLI (npm link) ..."
npm link || npm install -g .

echo "done. verify with: voicelens doctor"
