---
name: migrate
description: "Mirror current git project to personal GitHub account with commit author rewrite. Use when user types /migrate."
trigger: /migrate
---

# /migrate — Mirror to Personal GitHub

Зеркалирует текущий git-проект в личный GitHub аккаунт, переписывая авторов коммитов под личную идентичность.

## Execution

Run immediately from the project root (do NOT ask for confirmation):

```bash
bash ~/.claude/skills/migrate/migrate.sh
```

Stream all output to the user. The script:
1. Loads credentials from `~/.claude/secrets.env`
2. Checks if the repo exists under personal account — creates private repo if not
3. Bare-clones the project locally to a temp directory
4. Rewrites ALL commit authors → `Mikhail Alabugin <mmalabugin@gmail.com>`
5. Force-pushes all branches and tags to personal GitHub
6. Prints the final URL and exits cleanly

## Notes
- Force-push is intentional — this is a mirror pattern, not a shared branch
- Uses `git-filter-repo` if installed (faster), falls back to `git filter-branch`
- Token is in `~/.claude/secrets.env` — never print it in output
- If the script fails mid-way, temp dir is auto-cleaned by the EXIT trap
