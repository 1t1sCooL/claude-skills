# Install instructions (for an AI agent)

You are a Claude Code agent asked to install this skill collection on the current machine.
Follow these steps exactly. Do not skip verification. Ask the user before overwriting an
existing skill of the same name.

## 0. Preconditions
- Target dir is `~/.claude/` (create `~/.claude/skills/` and `~/.claude/agents/` if missing).
- This repo is already cloned; run from its root.

## 1. Copy skills and agents
```bash
mkdir -p ~/.claude/skills ~/.claude/agents
cp -R skills/* ~/.claude/skills/
cp agents/*.md ~/.claude/agents/
```
If a destination skill already exists, STOP and ask the user whether to overwrite that one.

## 2. Register triggers in ~/.claude/CLAUDE.md
These skills are invoked by slash-trigger and must be registered so Claude Code routes the
trigger to the Skill tool. Append a block per skill to `~/.claude/CLAUDE.md` (create the file
if absent). Use this exact pattern for each:

```
# <name>
- **<name>** (`~/.claude/skills/<name>/SKILL.md`) - <one-line description>. Trigger: `/<name>`
When the user types `/<name>`, invoke the Skill tool with `skill: "<name>"` before doing anything else.
```

Register: `flights` (`/flights`), `graphify` (`/graphify`), `migrate` (`/migrate`),
`project-backlog` (`/project-backlog`), `1t1scopy` (`/1t1scopy`), and the freelance/quality/growth
skills: `proposal`, `outreach-track`, `invoice`, `perf-guard`, `a11y`, `seo-tech`, `slice`,
`deploy`, `changelog`, `devlog-post`, `flashcards`, `tg-content`, `seo-content`, `growth-audit`,
`news-filter` (each `/<name>`). The `aif-*` skills and the `daily-standup` skill self-describe via their own
`SKILL.md` frontmatter and do not need a CLAUDE.md trigger block (they activate by description/keywords).

## 3. Per-skill configuration
- **migrate** — needs `~/.claude/secrets.env` (NEVER commit it). Create from this template and
  fill real values:
  ```
  GITHUB_PERSONAL_USER=your_github_login
  GITHUB_PERSONAL_NAME=Your Name
  GITHUB_PERSONAL_EMAIL=you@example.com
  GITHUB_PERSONAL_TOKEN=ghp_xxx   # a PAT with repo scope
  ```
- **flights** and **1t1scopy** — need browser MCP servers. Ensure the Playwright MCP (and,
  optionally, Chrome DevTools MCP for device emulation) are configured for Claude Code. Browser
  automation only works from the MAIN session (sub-agents get auto-denied permission prompts).
- **devlog** / **roadmap-builder** — write to `$HOME/Documents/1t1sCooL/...` by default. Edit the
  paths inside `agents/devlog.md` and `agents/roadmap-builder.md` to your own notes/Obsidian dir.
- **1t1scopy** — placeholders `your-site.com`, `your-project`, `<your-project-memory-slug>` must be
  replaced with your real reference domain, project name, and Claude Code project memory slug.
- **graphify** — see its `SKILL.md`; it produces a `graphify-out/` dir (git-ignored).
- **perf-guard** — needs Node 18+ and Google Chrome for the Lighthouse CLI, or a `PSI_API_KEY`
  env var for the PageSpeed Insights fallback. Run from the MAIN session.
- **a11y** — uses Playwright (axe-core) when available; run from the MAIN session (browser
  automation is denied to sub-agents). Falls back to static HTML analysis without it.
- **deploy** — project-specific placeholders: Jenkins job/URL, deploy trigger method, env domains,
  smoke routes. Configure them per project on first run.
- **invoice** — fill `./billing/profile.json` (requisites) on first run; defaults to RF
  self-employed/ИП, no VAT (configurable). Payment requisites live in `profile.json`, not secrets.
- **tg-content** / **growth-audit** / **news-filter** — ask for your Telegram channel handle on first
  run and save it to `./growth/config.json`.
- **slice** — project-specific: self-detects the repo's FSD conventions (TS/JS, CSS Modules, barrel).

## 4. Verify
```bash
ls ~/.claude/skills | grep -E 'flights|graphify|migrate|project-backlog|1t1scopy|aif'
ls ~/.claude/agents | grep -E 'devlog|roadmap-builder'
grep -c '^# ' ~/.claude/CLAUDE.md   # trigger blocks present
```
Report which skills installed, which were skipped (already existed), and any config still needed
from the user (secrets.env, MCP servers, personal paths).
