#!/usr/bin/env bash
# Install this collection into ~/.claude/. Idempotent: skips skills that already exist
# unless --force is passed. Does NOT touch secrets or overwrite ~/.claude/CLAUDE.md blindly.
set -euo pipefail

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

CLAUDE_DIR="$HOME/.claude"
SRC="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$CLAUDE_DIR/skills" "$CLAUDE_DIR/agents"

installed=0; skipped=0
for d in "$SRC"/skills/*/; do
  name="$(basename "$d")"
  dest="$CLAUDE_DIR/skills/$name"
  if [ -e "$dest" ] && [ "$FORCE" -eq 0 ]; then
    echo "skip (exists): skills/$name"; skipped=$((skipped+1)); continue
  fi
  rm -rf "$dest"; cp -R "$d" "$dest"; echo "installed: skills/$name"; installed=$((installed+1))
done

for f in "$SRC"/agents/*.md; do
  name="$(basename "$f")"
  dest="$CLAUDE_DIR/agents/$name"
  if [ -e "$dest" ] && [ "$FORCE" -eq 0 ]; then
    echo "skip (exists): agents/$name"; skipped=$((skipped+1)); continue
  fi
  cp "$f" "$dest"; echo "installed: agents/$name"; installed=$((installed+1))
done

echo
echo "Done. installed=$installed skipped=$skipped"
echo "Next steps (see AGENTS.md):"
echo "  1. Register slash triggers in ~/.claude/CLAUDE.md (flights, graphify, migrate, project-backlog, 1t1scopy)"
echo "  2. Create ~/.claude/secrets.env for /migrate"
echo "  3. Configure Playwright/Chrome DevTools MCP for /flights and /1t1scopy"
echo "  4. Adjust personal paths in agents/devlog.md and agents/roadmap-builder.md"
