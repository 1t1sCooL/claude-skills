---
name: frontend-audit
description: Run a productized frontend audit and generate cold-outreach for it. Given a niche/segment or explicit URLs, finds candidate sites, measures them with Lighthouse + security headers + real compression, and produces per-site mini-audits plus personalized outreach drafts. Use when user says "прогони сайты", "аудит фронтенда", "найди клиентов на аудит", "outreach по сайтам", "frontend audit", or names a niche to audit.
argument-hint: "[ниша | URL... | --compare before.json after.json]"
allowed-tools: Read Glob Grep Write Bash(node *) Bash(mkdir *) WebSearch WebFetch AskUserQuestion
---

# Frontend Audit & Outreach

Движок продуктизированных frontend-аудитов: берёт нишу или список сайтов,
замеряет (Lighthouse mobile/desktop + security-заголовки + реальное сжатие),
и выдаёт по каждому сайту **мини-аудит + персональный заход для cold outreach**.
Это верх воронки → outreach для услуги аудита (`mmalabugin.ru/audit`).

Цифры — публичный Lighthouse, не оценки. Подавать **конструктивно** (зона роста + как чинится), без злорадства.

## Что на входе (`$ARGUMENTS`)

Разобрать аргумент:
- **Ниша/сегмент** (`стартапы`, `онлайн-школы`, `e-commerce`, `локальный бизнес: клиники/юристы/авто`, или своя) [+ опц. регион, количество] → найти кандидатов.
- **Явные URL** (через пробел) → аудировать их.
- **`--compare before.json after.json`** → построить таблицу «было → стало» (Re-audit, допродажа).
- **Пусто** → спросить через AskUserQuestion: ниша или URL'ы? (одним вопросом, 3-4 опции ниш).

## Требования окружения
- Node 18+ и установленный **Google Chrome** (для Lighthouse). Скрипт сам ищет Chrome; при отсутствии — предупредить пользователя.
- Скрипты движка лежат рядом: `scripts/audit.mjs`, `scripts/compare.mjs`. Запускать их по абсолютному пути от этого SKILL.md.

## Шаги

1. **Резолв входа.** Если дана ниша — найди **5–10 реальных кандидатов** через WebSearch.
   - ⚠️ Цель — **реальные платящие клиенты**, НЕ гиганты. Avito/hh/Ozon годятся только как контент-демо, не как лиды. Бери средний бизнес / стартапы / школы / локальные компании.
   - Предпочитай сайты, у которых вероятно плохой mobile-перформанс: тяжёлые маркетинговые лендинги, много трекеров, конструкторы (Tilda/Webflow) с перегрузом, SPA.
   - Собери чистые URL (с https, рабочие).

2. **Прогон аудита.** Создай рабочую папку `./frontend-audit-output/` и запусти движок:
   ```bash
   node <путь>/scripts/audit.mjs <url1> <url2> ... \
     --device both --runs 2 \
     --out ./frontend-audit-output/audit.md \
     --json ./frontend-audit-output/snapshot.json
   ```
   - Прогон долгий (~1–1.5 мин на сайт×устройство×прогон). Для большого списка — предупреди, что займёт время; можно `--device mobile` для скорости.
   - Сайты за бот-защитой (Qrator/Cloudflare challenge) дадут все нули — пометь и исключи из outreach.

3. **Разбор по каждому сайту.** Из метрик `snapshot.json` выдели:
   - **Шок-цифру** для хука — худшее из: mobile Performance, LCP, Speed Index, TBT, CLS.
   - **2–3 конкретные проблемы** с цифрами (заблокированный main thread = TBT; долгий крупнейший контент = LCP; прыгающая верстка = CLS; нет security-заголовков; нет brotli при большом бандле).
   - **Что чинить первым** (1–2 строки, реалистично: «X → 80+ за 1–3 недели»).

4. **Сгенерируй артефакты** в `./frontend-audit-output/`:
   - `mini-audits.md` — по каждому сайту: таблица метрик + проблемы + «что чинить» + вывод одной строкой (формат — см. `references/outreach-templates.md`).
   - `outreach.md` — по каждому сайту **персональное** касание (имя сайта + его конкретные цифры) по шаблону из `references/outreach-templates.md`.

5. **Итог пользователю:** короткая сводная таблица (сайт · mobile Perf · главная боль · годится ли в outreach) + путь к файлам.

## Режим сравнения (`--compare`)
```bash
node <путь>/scripts/compare.mjs before.json after.json --out re-audit.md
```
Даёт таблицу «Было → Стало» с дельтами — артефакт допродажи Re-audit.

## Правила
- **Перед отправкой — перепрогнать свежим замером** (`--runs 3`): сайты меняются, цифры в письме должны быть актуальны.
- **Персонализация обязательна:** в каждом письме — имя сайта и ЕГО цифры, не шаблон-копипаст.
- **Тон:** конструктивно, value-first, без давления. Не «у вас плохо», а «нашёл 3 вещи, тормозящие загрузку, влияющие на конверсию».
- **Мягкий CTA** на `mmalabugin.ru/audit` — не в каждом письме, не клянчить.
- **HEAD не сжимается** — движок проверяет сжатие GET'ом (не путать с `curl -I`).
- Lighthouse/PSI шумят — движок берёт медиану из N прогонов; для важного отчёта `--runs 3`.

## Подсказки по нишам (для WebSearch)
- **Стартапы/SaaS:** «<вертикаль> SaaS Россия», product hunt РФ, акселераторы (ФРИИ-портфель).
- **Онлайн-школы/инфобиз:** «курсы <тема> онлайн-школа», лендинги на Tilda/GetCourse.
- **E-commerce:** нишевые магазины на Tilda/InSales/Shopify (не маркетплейсы).
- **Локальный бизнес:** клиники/юристы/автосервисы/стройка + город — у них дорогие лиды и медленные сайты.

См. `references/outreach-templates.md` — форматы мини-аудита и писем.
