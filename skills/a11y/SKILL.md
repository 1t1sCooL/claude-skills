---
name: a11y
description: Accessibility audit of a page against WCAG — runs axe-core via Playwright when available (static HTML fallback), plus a manual checklist (keyboard, focus, contrast, ARIA, landmarks, headings, alt, labels), and reports findings grouped by severity with WCAG Success Criterion references and concrete fixes. Use when user says "аудит доступности", "проверь a11y", "WCAG", "доступность сайта", "accessibility audit", or types /a11y.
argument-hint: "<url | локальный роут> [--level A|AA|AAA] (по умолчанию AA)"
allowed-tools: Read Write Edit Bash(npx *) WebFetch
---

# Accessibility Audit (WCAG)

Аудит доступности страницы по WCAG: автоматическая проверка axe-core + ручной чеклист
того, что автоматика не ловит. Находки — с уровнем серьёзности, ссылкой на конкретный
Success Criterion и понятным фиксом. По умолчанию целевой уровень **AA**.

## Что на входе (`$ARGUMENTS`)

- **URL** или **локальный роут** для аудита.
- **`--level A|AA|AAA`** — целевой уровень соответствия (по умолчанию `AA`).

## Требования окружения

- Для axe-core нужен **Playwright** (`npx playwright`) + браузер. ⚠️ Браузерная автоматизация
  работает **только из главной сессии** (сабагентам пермишены автоматически отклоняются).
- Если Playwright недоступен — деградировать на статический разбор HTML через WebFetch
  (поймает часть: alt, label, lang, заголовки, ARIA в разметке), пометив, что динамику не проверяли.

## Шаги

1. **Автоматика (axe-core).** Через Playwright открыть страницу, заинжектить axe-core, прогнать:
   ```bash
   npx playwright ... # открыть URL, inject https://cdn.jsdelivr.net/npm/axe-core/axe.min.js, axe.run()
   ```
   Собрать violations: id, impact, описание, узлы, ссылка на правило. Фолбэк — WebFetch + статический разбор.

2. **Ручной чеклист** (то, что axe не покрывает полностью):
   - **Клавиатура** — все интерактивные элементы достижимы Tab, нет ловушек фокуса, логичный порядок.
   - **Видимый фокус** — focus-ring не убран без замены.
   - **Контраст** — текст vs фон ≥ 4.5:1 (крупный ≥ 3:1); привести конкретные проблемные пары.
   - **alt** у смысловых изображений; декоративные — `alt=""`.
   - **Формы** — каждое поле с `<label>`/`aria-label`; ошибки доступно объявлены.
   - **ARIA/landmarks** — корректные роли, есть `main/nav/header/footer`, нет «ARIA ради ARIA».
   - **Заголовки** — один `h1`, иерархия без скачков.
   - **lang** у `<html>`; **таргеты тапа** ≥ 24–44px.

3. **Оформить находки.** Каждая: проблема → ссылка на WCAG SC (напр. `1.4.3 Contrast`, `2.1.1 Keyboard`, `4.1.2 Name, Role, Value`) → severity (`critical/serious/moderate/minor`) → как чинить (конкретно, по коду).

## Выход

- `./a11y-output/report.md` — находки, сгруппированные по severity, с WCAG SC и фиксами; в шапке — чем мерили (axe через Playwright / статически) и целевой уровень.
- Короткое резюме: сколько critical/serious, что чинить первым.
