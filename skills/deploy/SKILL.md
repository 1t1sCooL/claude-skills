---
name: deploy
description: Codified release for a Next.js app on Jenkins + Traefik + Kubernetes — runs pre-flight checks (clean tree, branch, build, lint/tests), triggers the Jenkins deploy, then post-deploy verifies HTTP 200 smoke + real gzip/br compression (the two-Ingress/Traefik compress gotcha). Use when user says "задеплой", "выкати релиз", "релиз на прод/стейдж", "deploy", "release", or types /deploy.
argument-hint: "[staging|prod] [tag|branch] (по умолчанию prod, текущая ветка)"
allowed-tools: Read Write Edit Bash(git *) Bash(curl *) Bash(npm *) WebFetch
---

# Deploy (Jenkins + Traefik + K8s)

Кодифицированный релиз: предполётные проверки → триггер Jenkins → пост-деплой smoke.
Включает **фирменный чек сжатия**: в топологии с двумя Ingress / Traefik
compress-middleware иногда применяется не туда и ответы реально НЕ сжимаются —
это проверяется отдельно после каждого деплоя.

⚠️ **Топология описана плейсхолдерами** (`<JENKINS_JOB>`, домены) — при первом запуске
в проекте настрой их под реальную инфру (см. блок «Настройка»).

## Что на входе (`$ARGUMENTS`)

- **Окружение** — `staging` / `prod` (по умолчанию `prod`).
- **Тег / ветка** — что выкатывать (по умолчанию текущая ветка / `HEAD`).
- Пусто → `prod` + текущая ветка; перед триггером подтвердить у пользователя.

## Настройка (плейсхолдеры проекта)

Определи и зафиксируй (можно из CI-конфига репо: `Jenkinsfile`, `.gitlab-ci`, k8s-манифесты, README):
- `<JENKINS_JOB>` — имя/URL Jenkins job (напр. `https://jenkins.example/job/app-deploy`).
- `<TRIGGER>` — способ запуска деплоя: web-trigger (`curl` с токеном) / Jenkins CLI / `git push` в деплой-ветку.
- `<DOMAIN_STAGING>`, `<DOMAIN_PROD>` — домены окружений.
- `<SMOKE_ROUTES>` — ключевые роуты для smoke (`/`, `/api/health`, ...).

Если не найдено — спроси у пользователя и предложи сохранить в проектный конфиг.

## Шаги

1. **Предполётные проверки.**
   ```bash
   git status --porcelain            # дерево чистое?
   git rev-parse --abbrev-ref HEAD   # та ли ветка?
   git fetch && git status -sb       # не отстаём от remote?
   ```
   - Сборка: задетектить менеджер (`package.json` scripts / lockfile) и прогнать `npm run build` (или `pnpm/yarn`).
   - Линт/тесты если есть: `npm run lint`, `npm test` — падение блокирует деплой.
   - Любая красная проверка → СТОП, не триггерить.

2. **Триггер деплоя через Jenkins** (по `<TRIGGER>`), с параметрами окружение+ref. Примеры:
   ```bash
   # web-trigger c токеном
   curl -fsSL -X POST "<JENKINS_JOB>/buildWithParameters?ENV=<env>&REF=<ref>&token=<TOKEN>"
   # либо git push в деплой-ветку, либо Jenkins CLI — по настройке проекта
   ```
   Дождаться завершения сборки/раската (поллить статус job или k8s rollout, если доступ есть). Зафиксировать номер билда.

3. **Пост-деплой: фирменный чек сжатия.** Для каждого ключевого URL проверить, что ответ реально сжат:
   ```bash
   curl -s -H 'Accept-Encoding: br, gzip' -D - -o /dev/null https://<DOMAIN>/<route>
   # смотреть заголовок: content-encoding: br | gzip
   ```
   - Нет `content-encoding` на HTML/JS/CSS → **compress-middleware не применился** (классика двух Ingress/Traefik: middleware висит не на том Ingress/роутере). Пометить как FAIL, дать наводку: проверить, на каком Ingress/Traefik-роутере висит compress-middleware и доходит ли он до реального ответа.
   - ⚠️ `curl -I` (HEAD) сжатие НЕ показывает — проверять GET'ом с заголовком Accept-Encoding.

4. **Smoke.** Каждый роут из `<SMOKE_ROUTES>` отдаёт `200`, нет `5xx`:
   ```bash
   for r in <routes>; do curl -s -o /dev/null -w "%{http_code} $r\n" "https://<DOMAIN>$r"; done
   ```
   Опционально WebFetch главной — проверить, что страница рендерится (нет пустого/ошибочного body).

## Выход

- **Пошаговый отчёт прогона**: предполёт (✓/✗ по каждой проверке) → номер Jenkins-билда → результат раската.
- **Чеклист пост-деплоя** с результатами:
  - HTTP-коды по роутам (200/прочее).
  - Сжатие по роутам (`content-encoding` найден да/нет) — с явным флагом, если сработал gotcha.
- Итоговый вердикт: релиз здоров / есть проблемы (+ что чинить).
