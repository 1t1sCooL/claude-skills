---
name: growth-audit
description: One-off growth audit of the author's site (mmalabugin.ru) and/or Telegram channel — walks the funnel (entry → offer clarity → CTA → conversion), spots where audience drops off, and returns a prioritized fix list (impact × effort) with a top-5. Use when user says "аудит роста", "где теряю аудиторию", "почему нет заявок", "воронка сайта/канала", "growth audit", or types /growth-audit.
argument-hint: "[site | channel | both (по умолчанию both)]"
allowed-tools: Read Write Edit WebFetch WebSearch AskUserQuestion
---

# Growth Audit

Разовый аудит роста личных активов: где сайт/канал теряет аудиторию и что чинить первым.
Сайт — `mmalabugin.ru`, канал — личный ТГ (хэндл из `./growth/config.json` или спросить).

## Что на входе (`$ARGUMENTS`)

- `site` | `channel` | `both` (по умолчанию `both`).

## Шаги

1. **Сайт (mmalabugin.ru).** Через WebFetch пройти воронку глазами посетителя:
   - **Точки входа** и ясность оффера на первом экране (за 5 сек понятно, кто и чем помогает?).
   - **CTA** — есть, заметен, ведёт к заявке/аудиту? Сколько шагов до контакта.
   - **Скорость как фактор отказов** — сослаться на `perf-guard` для замера.
   - **Мобильная версия**, доверие (кейсы, соцдоказательство, отзывы).
2. **Канал (ТГ).** Через `https://t.me/s/<handle>`:
   - Регулярность постинга, какие типы постов заходят (реакции/просмотры если видны).
   - Есть ли воронка из канала на сайт/услугу.
3. **Точки потери.** Где именно отваливается аудитория (пришёл → не понял оффер → ушёл; читает канал → не переходит на сайт).
4. **Приоритизация.** Список фиксов по **impact × усилие**; вынести **топ-5 первоочередных**.

## Выход

- `./growth/growth-audit-<date>.md` — разбор воронки сайта и канала, точки потери, приоритизированные фиксы, топ-5.
- При необходимости — `./growth/config.json` с хэндлом канала (если спрашивали).
