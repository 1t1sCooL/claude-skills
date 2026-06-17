---
name: roadmap-builder
description: >
  Builds a complete technology learning roadmap: Obsidian Canvas visual map +
  detailed Daily Plan markdown with verified video and text resources.
  Input: a technology name (e.g. "Docker", "TypeScript", "React Native").
  Output: two files in $HOME/Documents/1t1sCooL/ —
    [Tech] roadmap.canvas  (visual roadmap)
    [Tech] - Daily Plan.md (day-by-day schedule with videos and tasks)
  Use when user says "построй роадмап по X", "сделай план изучения X",
  "roadmap X", or "учебный план X".
tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebSearch
  - WebFetch
  - Agent
---

# Roadmap Builder

You build a complete self-study roadmap for any technology. You produce two files:
1. **Obsidian Canvas** — visual mind-map of the learning path
2. **Daily Plan** — concrete day-by-day schedule with verified video links

---

## PHASE 0 — Parse input

Extract the technology name from the user's message.
Determine: beginner-friendly or advanced topic? Backend/frontend/devops/other?
Estimate total study time (e.g., Docker = 3 weeks, React = 8 weeks).

---

## PHASE 1 — Research resources

Run these searches IN PARALLEL:

1. `[Technology] full course tutorial YouTube 2024 2025`
2. `[Technology] tutorial Russian YouTube 2024 2025` (RU resources)
3. `[Technology] official documentation getting started`
4. `[Technology] roadmap topics beginner intermediate advanced`
5. `[Technology] best practices cheatsheet`

From results, collect:
- 15–25 YouTube video candidates (mix EN + RU)
- 3–5 official doc URLs
- 2–3 interactive practice resources (playgrounds, challenges)

---

## PHASE 2 — Verify videos

Check every video candidate with oEmbed. Run IN PARALLEL (15 at a time):

```bash
for id in ID1 ID2 ID3 ...; do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json")
  title=$(curl -s "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json" \
    | grep -o '"title":"[^"]*"' | head -1)
  echo "$code $id $title"
done
```

Keep only 200-status videos. Discard 404s immediately.
For playlists use: `https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=LIST_ID&format=json`

---

## PHASE 3 — Design curriculum

Design a week-by-week curriculum. Each week = 6 study days + 1 review day.
Structure:

```
Week 1: Foundations
  Day 1: [First concept]
  Day 2: [Second concept]
  ...
  Day 7: Review + mini-project

Week 2: Core features
  ...

Week N: Advanced topics + real project
```

For each day assign:
- **Topic name** (concise, e.g. "Containers и Images")
- **Theory link** (official docs or article)
- **Main video** (best verified EN video)
- **RU video** (best verified RU video, or a search link)
- **Practice task** (concrete, hands-on, 30–60 min)
- **Checklist item** (1 sentence: "I can now ___")

Rules:
- Day 1 is always: install + hello world + mental model
- Last day of each week: review + build something
- Final week: capstone project tying everything together
- Practice tasks must be CONCRETE — specific commands, not "practice X"
- Checklist items must be TESTABLE — can be verified by a real question

---

## PHASE 4 — Generate Canvas JSON

Use this Python script pattern to generate the canvas:

```python
import json, uuid, os

OBSIDIAN = "$HOME/Documents/1t1sCooL"
TECH = "[Technology]"  # replace

def nid():
    return uuid.uuid4().hex[:16]

# Canvas layout constants
HEADER_X, HEADER_Y = -424, -810
HEADER_W, HEADER_H = 300, 60
SECTION_X = -420
SECTION_W, SECTION_H = 280, 60
SECTION_STEP = 80          # vertical gap between sections
CHILD_X_LEFT = -1000       # children column (left)
CHILD_X_RIGHT = -340       # children column (right, alternating)
CHILD_W, CHILD_H = 200, 50
CHILD_STEP = 60

# ── Build nodes ──────────────────────────────────────────────────────────────

nodes = []
edges = []

def add_node(text, x, y, w, h, color=None):
    n = {"id": nid(), "type": "text", "text": text,
         "x": x, "y": y, "width": w, "height": h}
    if color:
        n["color"] = color
    nodes.append(n)
    return n["id"]

def add_edge(from_id, to_id):
    edges.append({"id": nid(), "fromNode": from_id, "toNode": to_id})

# Root header
root_id = add_node(f"# {TECH}", HEADER_X, HEADER_Y, HEADER_W, HEADER_H, "#471727")

# Sections and their children
# sections = list of (section_name, [child1, child2, ...])
sections = [
    ("## Основы",           ["### Установка", "### Концепции", "### Hello World"]),
    ("## Ядро",             ["### Topic A", "### Topic B"]),
    ("## Продвинутое",      ["### Advanced A"]),
    ("## Практика",         ["### Проект"]),
]

prev_section_id = None
prev_child_id = None
first_section_id = None

for sec_idx, (sec_name, children) in enumerate(sections):
    sec_y = HEADER_Y + (sec_idx + 1) * SECTION_STEP + 10
    # Alternate children columns
    child_x = CHILD_X_LEFT if sec_idx % 2 == 0 else CHILD_X_RIGHT
    # Children go ABOVE section (y decreasing)
    children_start_y = sec_y - len(children) * CHILD_STEP - 60

    sec_id = add_node(sec_name, SECTION_X, sec_y, SECTION_W, SECTION_H)
    if first_section_id is None:
        first_section_id = sec_id
        add_edge(root_id, sec_id)

    # Chain: section → first child → ... → last child → next section
    prev_cid = sec_id
    for i, child_text in enumerate(children):
        cy = children_start_y + i * CHILD_STEP
        cid = add_node(child_text, child_x, cy, CHILD_W, CHILD_H)
        add_edge(prev_cid, cid)
        prev_cid = cid

    if prev_section_id:
        add_edge(prev_cid, sec_id)  # last child of prev → this section (already done above for first)

    prev_section_id = sec_id
    # For continuity, store last child
    # (rebuild: last child of THIS section → NEXT section header)

canvas = {"nodes": nodes, "edges": edges}
out = os.path.join(OBSIDIAN, f"{TECH} roadmap.canvas")
with open(out, "w", encoding="utf-8") as f:
    json.dump(canvas, f, ensure_ascii=False, indent=2)
print(f"Canvas: {out}")
```

**Adapt** this script with the real sections and children from your curriculum.
The structure must mirror the existing `Frontend Senior roadmap.canvas`:
- `# Tech` at top (with color `#471727`)
- `## Section` headers in a vertical column at x=-420
- `### Topic` leaves in alternating columns at x=-1000 (left) and x=-340 (right)
- Chain: root → first section → children chain → next section → ...
- Add overview node: a big text node at x=-1360 with the full tree ASCII art

Run the script with `Bash` to generate the file.

---

## PHASE 5 — Generate Daily Plan

Write `$HOME/Documents/1t1sCooL/[Tech] - Daily Plan.md` following
**exactly** this format (copy from the existing plan's structure):

```markdown
# [Technology] — Daily Study Plan

> **Цель:** [one sentence — what you'll be able to do after completing this plan]
> **Длительность:** N недель (~N часов/день)
> **Уровень:** Начинающий → Продвинутый

---

## Неделя 1 — [Week theme]

### День 1 — [Topic name]
- [ ] **Теория:** [Description](https://official-docs-url)
- [ ] **Видео:** ChannelName — [«Title»](https://www.youtube.com/watch?v=VERIFIED_ID)
- [ ] **Доп. видео (RU):** [«Title»](https://www.youtube.com/watch?v=VERIFIED_RU_ID)
- [ ] **Практика:** [Concrete task with specific commands/files/goals]
- [ ] **Чеклист:** [Testable knowledge statement]

### День 2 — [Topic name]
...

### День 7 — Review + мини-проект
- [ ] **Практика (2 ч):** [Mini-project combining week's topics]
- [ ] **Чеклист:** [Week mastery statement]

---

## Неделя 2 — [Week theme]
...
```

Rules for the plan:
- Every video link must be VERIFIED (200 from oEmbed check)
- If no good RU video found, use: `[YouTube search «[topic in Russian]»](https://www.youtube.com/results?search_query=...)`
- Theory links must be official docs or high-quality articles (MDN, official site, web.dev)
- Practice tasks must be EXECUTABLE — specific, not vague
- Each day should take 1.5–2.5 hours total

---

## PHASE 6 — Report to user

After creating both files, report:
```
✓ Canvas: [Tech] roadmap.canvas — N nodes, M edges
✓ Plan:   [Tech] - Daily Plan.md — N weeks, M days

📍 Открой в Obsidian:
  - Канвас: для визуального обзора
  - Daily Plan: для ежедневной работы

Структура роадмапа:
  Week 1: [theme]
  Week 2: [theme]
  ...
  Week N: [theme] + финальный проект
```

---

## Quality checklist before writing files

- [ ] All video IDs return HTTP 200 from oEmbed
- [ ] Canvas has at least 30 nodes and correct edge chain (no orphans)
- [ ] Daily plan has complete entries for every day (no empty fields)
- [ ] Practice tasks are specific (contain commands, file names, or URLs)
- [ ] Checklist items start with "могу", "знаю", "понимаю" or similar
- [ ] Both EN and RU resources present for each week
- [ ] Capstone project in the final week

---

## Handling edge cases

- **Unknown/niche tech**: Spend more time on WebSearch (5–7 queries)
- **Very broad topic** (e.g. "backend development"): Scope it — ask user to confirm a sub-scope first
- **Very narrow topic** (e.g. "git rebase"): Make it a 1-week plan instead of N-week
- **Russian-specific ecosystem** (e.g. "1C"): Prioritize RU resources, use EN only as supplement
