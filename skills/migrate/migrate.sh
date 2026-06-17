#!/usr/bin/env bash
# ~/.claude/skills/migrate/migrate.sh
# Mirror current git repo to personal GitHub with rewritten commit authors.
# Detects the personal repo by:
#   1. Pattern from work remote URL  (e.g. ppm/frontend/landing → ppm__frontend__landing)
#   2. package.json "name" field scan across all personal repos
#   3. Basename of work remote URL   (e.g. landing)
#   4. Local directory name          (last resort)
# Usage: bash ~/.claude/skills/migrate/migrate.sh [repo-name-override]

set -euo pipefail

# ── Credentials ───────────────────────────────────────────────────────────────
SECRETS="$HOME/.claude/secrets.env"
[ -f "$SECRETS" ] || { echo "❌  ~/.claude/secrets.env not found" >&2; exit 1; }
# shellcheck source=/dev/null
source "$SECRETS"

GH_USER="${GITHUB_PERSONAL_USER:?}"
GH_EMAIL="${GITHUB_PERSONAL_EMAIL:?}"
GH_TOKEN="${GITHUB_PERSONAL_TOKEN:?}"
GH_NAME="${GITHUB_PERSONAL_NAME:-Mikhail Alabugin}"
AUTH="-H \"Authorization: token $GH_TOKEN\""

api() { curl -sf -H "Authorization: token $GH_TOKEN" "$@"; }

# ── Detect project root ───────────────────────────────────────────────────────
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) \
  || { echo "❌  Not inside a git repository" >&2; exit 1; }

ORIGIN_URL=$(git remote get-url origin 2>/dev/null \
  || git remote get-url "$(git remote | head -1)" 2>/dev/null \
  || echo "")

# ── Detect personal repo name ─────────────────────────────────────────────────
find_repo_name() {
  # 1. Explicit override from CLI arg
  if [ -n "${1:-}" ]; then echo "$1"; return 0; fi

  # 2. Pattern: parse work remote path → {org}__{layer}__{name}
  if [ -n "$ORIGIN_URL" ]; then
    # strip protocol + host, remove leading slash, strip .git
    PATH_PART=$(echo "$ORIGIN_URL" | sed 's|.*://[^/]*/||; s|\.git$||')
    PART_COUNT=$(echo "$PATH_PART" | tr '/' '\n' | wc -l | tr -d ' ')
    if [ "$PART_COUNT" -ge 3 ]; then
      CANDIDATE=$(echo "$PATH_PART" | tr '/' '__')
      # Check if repo exists for this user
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: token $GH_TOKEN" \
        "https://api.github.com/repos/$GH_USER/$CANDIDATE")
      if [ "$STATUS" = "200" ]; then echo "$CANDIDATE"; return 0; fi
    fi
  fi

  # 3. package.json "name" scan — compare with all personal repos
  LOCAL_PKG_NAME=""
  if [ -f "$ROOT/package.json" ]; then
    LOCAL_PKG_NAME=$(python3 -c "
import json, sys
try:
    print(json.load(open('$ROOT/package.json')).get('name', ''))
except:
    print('')
" 2>/dev/null || echo "")
  fi

  if [ -n "$LOCAL_PKG_NAME" ]; then
    echo "   (scanning personal repos for package.json name: $LOCAL_PKG_NAME...)" >&2
    PAGE=1
    while true; do
      REPOS=$(api "https://api.github.com/user/repos?per_page=100&page=$PAGE&type=all" \
        | python3 -c "
import json, sys
repos = json.load(sys.stdin)
if not repos:
    sys.exit(1)
for r in repos:
    print(r['name'])
" 2>/dev/null || break)
      [ -z "$REPOS" ] && break

      for REPO in $REPOS; do
        REMOTE_PKG=$(api "https://api.github.com/repos/$GH_USER/$REPO/contents/package.json" \
          | python3 -c "
import json, base64, sys
try:
    c = json.load(sys.stdin)
    content = base64.b64decode(c['content'].replace('\n','')).decode()
    print(json.loads(content).get('name', ''))
except:
    print('')
" 2>/dev/null || echo "")
        if [ "$REMOTE_PKG" = "$LOCAL_PKG_NAME" ]; then
          echo "$REPO"; return 0
        fi
      done
      PAGE=$((PAGE + 1))
    done
  fi

  # 4. Basename of work remote URL
  if [ -n "$ORIGIN_URL" ]; then
    echo "$(basename "$ORIGIN_URL" .git)"; return 0
  fi

  # 5. Local directory name
  echo "$(basename "$ROOT")"
}

REPO_NAME=$(find_repo_name "${1:-}")
REMOTE_URL="https://$GH_TOKEN@github.com/$GH_USER/$REPO_NAME.git"
STATE_FILE="$HOME/.claude/migrate-state.json"
[ -f "$STATE_FILE" ] || echo '{}' > "$STATE_FILE"

echo ""
echo "🔀  Migrate → github.com/$GH_USER/$REPO_NAME"
echo "    Author: $GH_NAME <$GH_EMAIL>"
echo ""

# ── Ensure repo exists ────────────────────────────────────────────────────────
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: token $GH_TOKEN" \
  "https://api.github.com/repos/$GH_USER/$REPO_NAME")

case "$HTTP_STATUS" in
  200) echo "📂  Repo exists — incremental mode" ;;
  404)
    echo "📦  Creating private repo $GH_USER/$REPO_NAME..."
    api -X POST \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$REPO_NAME\",\"private\":true,\"description\":\"Personal mirror\"}" \
      "https://api.github.com/user/repos" > /dev/null
    echo "   ✓ Created"
    ;;
  *) echo "❌  GitHub API error (HTTP $HTTP_STATUS)" >&2; exit 1 ;;
esac

# ── State helpers ─────────────────────────────────────────────────────────────
get_state() {
  python3 - "$STATE_FILE" "$REPO_NAME" "$1" <<'PY'
import json, sys
try:
    print(json.load(open(sys.argv[1])).get(sys.argv[2], {}).get(sys.argv[3], ""))
except:
    print("")
PY
}

save_state() {  # save_state <branch> <sha>
  python3 - "$STATE_FILE" "$REPO_NAME" "$1" "$2" <<'PY'
import json, sys
f = sys.argv[1]
try:
    d = json.load(open(f))
except:
    d = {}
d.setdefault(sys.argv[2], {})[sys.argv[3]] = sys.argv[4]
json.dump(d, open(f, "w"), indent=2)
PY
}

# ── Push a single branch (bare clone → rewrite → force push) ─────────────────
push_branch() {
  local BRANCH="$1"
  local WORK_DIR
  WORK_DIR=$(mktemp -d)
  # shellcheck disable=SC2064
  trap "rm -rf '$WORK_DIR'" RETURN

  git clone --bare --local --no-hardlinks "$ROOT" "$WORK_DIR/repo.git" --quiet
  cd "$WORK_DIR/repo.git"

  if command -v git-filter-repo &>/dev/null; then
    git filter-repo --force \
      --email-callback "return b'$GH_EMAIL'" \
      --name-callback  "return b'$GH_NAME'" \
      --refs "refs/heads/$BRANCH" 2>&1 | grep -v "^Ref \|^NOTICE" | tail -2 || true
  else
    FILTER_BRANCH_SQUELCH_WARNING=1 \
    git filter-branch -f --env-filter "
      GIT_AUTHOR_NAME='$GH_NAME'
      GIT_AUTHOR_EMAIL='$GH_EMAIL'
      GIT_COMMITTER_NAME='$GH_NAME'
      GIT_COMMITTER_EMAIL='$GH_EMAIL'
      export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL
    " -- "refs/heads/$BRANCH" 2>&1 | tail -2 || true
  fi

  git remote set-url origin "$REMOTE_URL" 2>/dev/null || git remote add origin "$REMOTE_URL"
  git push origin "$BRANCH" --force --quiet
  cd "$ROOT"
}

# ── Process all branches ──────────────────────────────────────────────────────
BRANCHES=$(git for-each-ref --format='%(refname:short)' refs/heads/)
ANY_PUSHED=false

for BRANCH in $BRANCHES; do
  LOCAL_HEAD=$(git rev-parse "$BRANCH")
  LAST_SYNCED=$(get_state "$BRANCH")

  if [ "$LAST_SYNCED" = "$LOCAL_HEAD" ]; then
    echo "   ✓ $BRANCH (up to date)"
    continue
  fi

  if [ -n "$LAST_SYNCED" ]; then
    NEW_COUNT=$(git log --oneline "$LAST_SYNCED..$BRANCH" 2>/dev/null | wc -l | tr -d ' ')
    echo "   → $BRANCH (+$NEW_COUNT commits)"
  else
    TOTAL=$(git log --oneline "$BRANCH" | wc -l | tr -d ' ')
    echo "   → $BRANCH (first sync, $TOTAL commits)"
  fi

  push_branch "$BRANCH"
  save_state "$BRANCH" "$LOCAL_HEAD"
  ANY_PUSHED=true
done

# Tags (idempotent)
TAGS_DIR=$(mktemp -d)
trap 'rm -rf "$TAGS_DIR"' EXIT
git clone --bare --local --no-hardlinks "$ROOT" "$TAGS_DIR/tags.git" --quiet
cd "$TAGS_DIR/tags.git"
git remote set-url origin "$REMOTE_URL" 2>/dev/null || git remote add origin "$REMOTE_URL"
git push origin --tags --force --quiet 2>/dev/null || true
cd "$ROOT"

echo ""
if [ "$ANY_PUSHED" = true ]; then
  echo "✅  Done! → https://github.com/$GH_USER/$REPO_NAME"
else
  echo "✅  All up to date → https://github.com/$GH_USER/$REPO_NAME"
fi
echo ""
