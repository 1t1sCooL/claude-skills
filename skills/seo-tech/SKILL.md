---
name: seo-tech
description: Technical SEO audit of a page — checks title/meta description, OG & Twitter cards, JSON-LD structured data, canonical, robots meta + robots.txt, sitemap.xml, hreflang, heading hierarchy, image alt, HTTP status/redirects, https and viewport. Defaults to mmalabugin.ru. Content/keyword SEO is the separate seo-content skill. Use when user says "технический SEO", "проверь мету", "structured data", "robots/sitemap", "SEO аудит страницы", "technical SEO", or types /seo-tech.
argument-hint: "[url] (по умолчанию mmalabugin.ru)"
allowed-tools: Read Write Edit Bash(curl *) WebFetch WebSearch
---

# Technical SEO Audit

Технический SEO-аудит страницы: метаданные, разметка, индексируемость, корректность
для поисковиков. Это **техническая** половина SEO — контентная/ключевая вынесена
в отдельный скилл `seo-content`. Сайт по умолчанию — `mmalabugin.ru`.

## Что на входе (`$ARGUMENTS`)

- **URL** страницы (по умолчанию `https://mmalabugin.ru`).

## Шаги

Получить HTML (`curl`/WebFetch) и проверить по чеклисту, для каждого пункта — статус ✓/✗ и фикс:

1. **Title & meta description** — наличие, длина (`<title>` ≤ ~60, description ≤ ~155), не пустые, не дублируются между страницами, осмысленные.
2. **Open Graph & Twitter Card** — `og:title/description/image/url/type`, `twitter:card` и пара — для корректных превью в соцсетях/мессенджерах.
3. **Structured data (JSON-LD)** — есть ли `<script type="application/ld+json">`; валидные типы (`Organization`, `Person`, `WebSite`, `BreadcrumbList`, `Article` и т.п.).
4. **Canonical** — `<link rel="canonical">` корректный, абсолютный, без дублей.
5. **robots** — meta `robots` (не `noindex` по ошибке) + `/robots.txt` (доступен, не блокирует нужное, ссылается на sitemap).
6. **sitemap.xml** — `/sitemap.xml` существует, валиден, актуальные URL, отдаёт 200.
7. **hreflang** — если многоязычность: корректные пары `rel="alternate" hreflang`.
8. **Заголовки** — ровно один `h1`, иерархия h1→h2→h3 без скачков.
9. **Изображения** — `alt` у смысловых; крупные без `loading`/размеров — отметить.
10. **HTTP** — статус 200, разумные редиректы (нет цепочек/циклов), `https`, HSTS, наличие `<meta viewport>`.

```bash
curl -sSL -D - -o /tmp/page.html "<url>"        # заголовки + тело
curl -s -o /dev/null -w "%{http_code}" "<url>/robots.txt"
curl -s -o /dev/null -w "%{http_code}" "<url>/sitemap.xml"
```

## Выход

- `./seo-tech-output/report.md` — чеклист с ✓/✗, найденными значениями и конкретными фиксами, **приоритизированный** (сначала то, что бьёт по индексации/выдаче).
- Короткое резюме: критичные техпроблемы + что отдать в `seo-content` для контентной части.
