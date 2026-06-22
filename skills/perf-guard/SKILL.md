---
name: perf-guard
description: Measure REAL web performance with a budget and regression diff — runs Lighthouse CLI (mobile + desktop) or PageSpeed Insights API against a production URL, checks metrics against a perf-budget, and diffs runs. Never trusts chrome-devtools MCP traces (falsely optimistic). Use when user says "замерь перформанс", "проверь скорость сайта", "lighthouse", "core web vitals", "perf budget", "регрессия скорости", or types /perf-guard.
argument-hint: "<url> [url2 ...] | --compare <runA.json> <runB.json> [--budget perf-budget.json]"
allowed-tools: Read Write Edit Bash(node *) Bash(npx *) Bash(curl *) WebFetch
---

# Perf Guard

Измерение **реального** перформанса с бюджетом и диффом регрессий.

> ⚠️ **Главное правило скилла.** MCP `chrome-devtools` performance-trace даёт
> **ложно-оптимистичные** цифры (быстрый локальный прогон без троттлинга/сети).
> Для вердикта используем ТОЛЬКО реальный Lighthouse (CLI) или Google PageSpeed
> Insights API против **прод-URL**. Никогда не выноси вердикт по chrome-devtools trace.

## Что на входе (`$ARGUMENTS`)

- **URL** (один или несколько) — прогнать аудит.
- **`--compare <runA.json> <runB.json>`** — таблица «было→стало» по сохранённым прогонам.
- **`--budget <path>`** — файл бюджета (по умолчанию `./perf-budget.json`; если нет — создать дефолтный).

## Требования окружения

- **Node 18+**.
- Для CLI-режима — установленный **Google Chrome** + `lighthouse` (используется через `npx lighthouse`).
- Фолбэк — **PSI API** (ключ опционален, без ключа есть лимиты): `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`.
- Скрипт движка: `scripts/perf.mjs` рядом с этим SKILL.md — запускать по абсолютному пути.

## Шаги

1. **Прогнать реальный замер** через движок (CLI Lighthouse, фолбэк PSI), mobile + desktop:
   ```bash
   node <путь>/scripts/perf.mjs <url> --device both --out ./perf-guard-output/run.json
   ```
   JSON прогонов складывать в `./perf-guard-output/`.

2. **Вытащить метрики:** Performance score, LCP, CLS, TBT, FCP, TTI, Speed Index, общий вес (transfer size).

3. **Сверить с бюджетом** (`perf-budget.json`). Если файла нет — создать дефолтный (разумные пороги mobile) и сообщить:
   ```json
   { "performance": 0.9, "lcp_ms": 2500, "cls": 0.1, "tbt_ms": 200, "fcp_ms": 1800, "weight_kb": 1500 }
   ```
   По каждой метрике — **pass/fail** относительно порога.

4. **`--compare`** — таблица «было→стало» с дельтами; пометить регрессии (стало хуже порога чувствительности).

## Выход

- `./perf-guard-output/report.md` — метрики mobile/desktop, статус по бюджету (✓/✗), дельты при сравнении, краткие рекомендации.
- Сырые JSON прогонов в `./perf-guard-output/`.
- Явная пометка, каким движком измерено (Lighthouse CLI / PSI) — и напоминание, что chrome-devtools trace не использовался.
