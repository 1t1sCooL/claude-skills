---
name: 1t1scopy
description: "Pixel-parity port of a page from a reference (original site or local HTML mirror) to the current Next.js/FSD project. Uses Playwright MCP to capture original + ours at multiple viewports, diffs layout/DOM/computed styles, then migrates legacy CSS to CSS Modules until parity. Trigger: /1t1scopy <route>"
trigger: /1t1scopy
---

# /1t1scopy

Bring a project page at `<route>` to pixel-identical parity with a reference (live original site and/or downloaded HTML mirror). The skill captures three versions via Playwright, diffs them, migrates legacy global CSS into CSS Modules per the FSD layout, and iterates until parity.

## Usage

```
/1t1scopy <route>                        # e.g. /1t1scopy /blog/some-post
/1t1scopy <route> --orig <url>           # original site URL (skip the question)
/1t1scopy <route> --ref <path|url>       # downloaded reference (file path or :4444 URL)
/1t1scopy <route> --ours <url>           # ours (default http://localhost:3000<route>)
/1t1scopy <route> --viewports 1920,1024,540,390   # default
/1t1scopy <route> --no-migrate           # diff only, don't write code
/1t1scopy <route> --max-iters 4          # parity loop cap (default 3)
```

## When to invoke

Invoke this skill when the user types `/1t1scopy …` or asks to "port the page", "make it pixel-identical to reference/site", "compare with reference and fix", "migrate styles for this page", or any equivalent in Russian ("сравни с референсом", "приведи к идентичности", "перенеси стили в модули для страницы X").

Before doing anything else: prerequisites + collect sources.

---

## Step 0 — Prerequisites & sources

1. **Required MCP**: Playwright MCP must be available. Tool names start with `mcp__playwright__…` (deferred — load via `ToolSearch` with `query: "select:mcp__playwright__browser_navigate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_resize,mcp__playwright__browser_evaluate,mcp__playwright__browser_snapshot,mcp__playwright__browser_console_messages,mcp__playwright__browser_close"`). If unavailable → tell user to install `@playwright/mcp` and stop.

2. **Parse args**: extract `<route>` (required, must start with `/`). Parse optional flags.

3. **Resolve "ours" URL**:
   - Default: `http://localhost:3000<route>`.
   - Check parallel-session rule from project memory `[[project_phase2_componentization]]`: if a parallel claude session might be running, ours may be on `:3100` with `NEXT_DIST_DIR=.next-parallel`. Probe `curl -sI http://localhost:3000<route>` first; if it fails or returns 4xx/5xx, probe `:3100`. If neither responds, ask user to start dev (`npm run dev`) and wait.

4. **Resolve "orig" URL** (the live original site):
   - If `--orig` provided → use it.
   - Else: ask user — *"Какой URL оригинала для этого роута? (например `https://your-site.com<route>`)"*. Accept "skip" to omit.

5. **Resolve "ref" reference**:
   - If `--ref` provided → use it directly.
   - Else: probe local mirror — `curl -sI http://localhost:4444<route>` (and `<route>/index.html`). If it responds → use that URL.
   - Else: probe `reference/site/your-site.com<route>/index.html` and `reference/site/your-site.com<route>.html` on disk. If found → tell user we'll serve it via Playwright `file://` or via a `python3 -m http.server 4444` started in `reference/site/your-site.com/`.
   - Else: ask user — *"Есть ли скачанный референс? Дай путь или URL, или 'skip'."*

6. **Verify at least one of (orig, ref) is available.** If both skipped, stop — there's nothing to compare against.

7. **Memory checks** — read project memories under `$HOME/.claude/projects/<your-project-memory-slug>/memory/` that match these slugs (load them up-front, they encode landmines):
   - `feedback_use_playwright`
   - `feedback_css_migration_pitfalls`
   - `feedback_slider_bm_bridge`
   - `feedback_premium_css_header_bridge`
   - `reference_4444_font_artifact` (mirror lacks webfont → don't trust glyph-level diffs, compare layout)
   - `reference_premium_new_folder` (some refs live in `new/` subfolder)
   - `project_phase2_componentization`
   - `project_legacy_css_teardown`

---

## Step 1 — Capture (Playwright MCP)

For each available source (`ours`, `orig`, `ref`) capture at each viewport (default `1920×1080, 1024×768, 540×900, 390×844`):

For each `(source, viewport)`:

1. `mcp__playwright__browser_resize` to `{width, height}`.
2. `mcp__playwright__browser_navigate` to the URL.
3. Wait for `networkidle` (or 2s timeout fallback).
4. `mcp__playwright__browser_take_screenshot` → save to `.1t1scopy/<route-slug>/<source>__<viewport>.png` (create directory if missing).
5. `mcp__playwright__browser_snapshot` → capture accessibility tree (use this, not raw DOM, for structural diff — it's smaller and semantic).
6. `mcp__playwright__browser_evaluate` to extract a "layout fingerprint":
   ```js
   () => {
     const nodes = [...document.querySelectorAll('main *, header *, footer *')].slice(0, 400);
     return nodes.map(el => {
       const r = el.getBoundingClientRect();
       const cs = getComputedStyle(el);
       return {
         tag: el.tagName.toLowerCase(),
         cls: el.className?.toString?.() ?? '',
         id: el.id || null,
         box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
         text: (el.textContent || '').trim().slice(0, 80),
         style: {
           display: cs.display, position: cs.position,
           font: `${cs.fontFamily}/${cs.fontSize}/${cs.fontWeight}/${cs.lineHeight}`,
           color: cs.color, bg: cs.backgroundColor,
           margin: cs.margin, padding: cs.padding,
           border: cs.border, borderRadius: cs.borderRadius,
         },
       };
     });
   }
   ```
   Save to `.1t1scopy/<route-slug>/<source>__<viewport>.json`.
7. `mcp__playwright__browser_console_messages` → save errors/warnings (helps catch missing assets, CSP, hydration).

After capturing all sources, write a small `.1t1scopy/<route-slug>/index.md` index linking the artifacts so the user can browse.

> **Glyph trap** — if `ref` is from local `:4444` mirror, the webfont is missing (`[[reference_4444_font_artifact]]`). Treat text-bounding-box width/height diffs vs ours as expected; compare structural layout, not glyph metrics. For text comparisons, prefer the raw HTML from the reference file or the `orig` live capture.

---

## Step 2 — Diff

Produce a structured diff report at `.1t1scopy/<route-slug>/DIFF.md`. Compare in this priority order:

1. **Structural (high signal)** — accessibility-tree node sequences. List nodes present in `ref/orig` but missing in `ours`, and vice versa. Include their text content for grep.
2. **Layout (high signal)** — for the K=20 largest visible boxes per viewport, compute `(x, y, w, h)` deltas between `ours` and `ref` (or `orig`). Flag any delta > 8px on width/height or > 16px on position.
3. **Typography** — diff `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing` per matched node. Ignore `fontFamily` if `ref` is `:4444`.
4. **Color/decoration** — `color`, `backgroundColor`, `border`, `borderRadius`, `boxShadow`.
5. **Spacing** — `margin`, `padding`.
6. **Console** — errors only in `ours` are migration regressions; flag them.

For each finding, write one line: `[severity] <viewport> <selector> — <metric>: ours=<x> ref=<y>`. Severity: `block` (missing element, wrong color, broken layout > 20px), `warn` (spacing/font 4-20px off), `note` (sub-pixel).

End the diff with a **Parity score** = `1 - (block*1 + warn*0.3 + note*0.05) / nodes_compared`. Aim for ≥ 0.97 to declare parity.

---

## Step 3 — Plan migration

Read `DIFF.md` and produce `.1t1scopy/<route-slug>/PLAN.md`. The plan must be specific:

- **Components to create/modify**: list FSD slices (`widgets/<x>`, `views/<y>`) that own each missing or off element. Prefer reusing existing slices over new ones — `[[project_phase2_componentization]]` already mapped most body_html sections.
- **Styles to migrate**: for each off rule, name the source (legacy file + selector) and target (`<slice>/ui/<Component>.module.css` + class name). Follow `[[feedback_css_migration_pitfalls]]`:
   - **GREP CHECKLIST** — search `src/shared/styles/legacy-overrides.css`, `src/shared/styles/legacy-theme.css`, and `src/shared/styles/content-sections.css` for every BEM-ish class name found in the reference. Extractor doesn't see overrides — must grep.
   - **Cascade trap** — module-scoped rules win over `legacy-overrides` for the same specificity. When porting, also DELETE the old rule from overrides, or boost the module rule's specificity beyond it.
   - **Compound selectors** — if legacy uses `.parent .child--mod`, ensure the React tree still emits `parent` and `child--mod` BEM classes alongside CSS-module classes, or rewrite to module-only.
- **Legacy classes to remove**: list rules in `legacy-*.css` that become dead after migration (so we don't carry duplicates).
- **Risk notes**: anything the user should confirm before edits (e.g. "this class is also used on 12 other pages — confirm scope").

Show the plan, get user `ok` (unless `--no-migrate`).

---

## Step 4 — Apply changes

Execute the plan in small commits:

1. Create/edit `<Component>.module.css` with ported rules.
2. Wire `styles.<class>` into the JSX (preserve original BEM classes as data hooks if any compound selector still depends on them — see compound-selector trap above).
3. Remove dead rules from `legacy-overrides.css` / `legacy-theme.css`.
4. After each logical group of changes, run a fast quality probe:
   ```bash
   npm run typecheck && npm run lint
   ```
   (Skip full `npm run check` — too slow for iteration; user runs it before commit.)
5. Tests: only update co-located `*.test.tsx` if behavior actually changed. Remember `[[reference_vitest_css_false]]` — vitest strips CSS, never assert on `styles.*` class names; assert on `data-testid` / semantics.

Do not auto-commit. Stop after each iteration and let user inspect.

---

## Step 5 — Verify & loop

Re-capture only `ours` for all viewports (orig/ref capture stays). Re-run Step 2 diff. Append result to `DIFF.md` under `## Iteration N`.

- If Parity score ≥ 0.97 → declare done, show user the screenshots side-by-side and the final parity score.
- Else if iteration count < `--max-iters` (default 3) → return to Step 3 with the residual diff.
- Else → stop, list remaining gaps and explicitly ask user how to proceed (some gaps may be intentional / accepted).

---

## Output contract

By the end of a run, the following must exist:

```
.1t1scopy/<route-slug>/
  ours__1920.png  ours__1024.png  ours__540.png  ours__390.png
  orig__*.png     (if orig was used)
  ref__*.png      (if ref was used)
  ours__*.json    (layout fingerprints)
  orig__*.json    (...)
  ref__*.json     (...)
  index.md        (browseable index)
  DIFF.md         (initial + per-iteration diffs)
  PLAN.md         (migration plan)
```

`.1t1scopy/` is gitignored (add to `.gitignore` if missing — local working dir only).

The final user-facing message must include: parity score, screenshot paths, and a one-line summary of what changed in code.

---

## Hard rules

- **Don't trust :4444 fonts.** Layout diffs from `:4444` reference are real; glyph-metric diffs aren't. Use `orig` for text-metric truth when available.
- **Don't run `npm run check` mid-iteration** — it includes vitest and is too slow. Use `typecheck && lint` only.
- **Don't introduce new `content.ts`** or `dangerouslySetInnerHTML` (project rule, CLAUDE.md).
- **Don't auto-commit.** User commits when satisfied.
- **Don't rename `views/` → `pages/`.** It's deliberate (`[[project_phase2_componentization]]`).
- **All prose in Russian** per `[[feedback_respond_in_russian]]`. Code, file names, commit messages stay as-is.
- **One slice per content type, not per page** — when creating new components, reuse the type-level slice if the route shares it (city/country/blog-post/etc.).
