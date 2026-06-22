---
name: changelog
description: Generate release notes from git history — parses Conventional Commits over a range (default last tag..HEAD), groups by type into human sections (Features/Fixes/Performance/...), drops noise (chore/merge), and outputs a markdown CHANGELOG section that can be prepended to CHANGELOG.md. Use when user says "сгенерируй чейнджлог", "релиз-ноты", "что изменилось с прошлого релиза", "changelog", "release notes", or types /changelog.
argument-hint: "[v1.2.0..HEAD | --since <tag>] [--write] (по умолчанию с последнего тега до HEAD)"
allowed-tools: Read Write Edit Bash(git *)
---

# Changelog / Release Notes

Собирает релиз-ноты из git-истории: парсит Conventional Commits, группирует по типам
в человекочитаемые секции, отбрасывает шум. Умеет печатать текст и допендивать новую
секцию сверху в существующий `CHANGELOG.md`.

## Что на входе (`$ARGUMENTS`)

- **Диапазон** `v1.2.0..HEAD` — явный git-range.
- **`--since <tag>`** — от тега до `HEAD`.
- **Пусто** → автоматически последний тег → `HEAD`:
  ```bash
  git describe --tags --abbrev=0   # последний тег; если тегов нет — взять всю историю
  ```
- Опц. `--write` — допендить в `CHANGELOG.md` (иначе только напечатать).

## Шаги

1. **Собрать коммиты** по диапазону (subject + body для footer'ов):
   ```bash
   git log <range> --no-merges --pretty=format:'%H%x09%s%x09%b%x1e'
   ```

2. **Распарсить Conventional Commits** `type(scope)!: subject` и сгруппировать:
   - `feat` → **Features**
   - `fix` → **Bug Fixes**
   - `perf` → **Performance**
   - `refactor` → **Refactoring**
   - `docs` → **Documentation**
   - прочие типы (`build`, `ci`, `test`, `style`) → **Other** (по желанию).
   - **Пропустить шум:** `chore`, merge-коммиты, бамп версий, мелочь без смысла для читателя.
   - **Breaking changes** (`!` после типа или `BREAKING CHANGE:` в body) → отдельная верхняя секция **⚠ BREAKING CHANGES**.
   - В строке пункта: subject, scope в скобках если есть, короткий хеш. Группировать одинаковые/дублирующиеся.

3. **Сформировать markdown-секцию:**
   ```markdown
   ## <version> — YYYY-MM-DD

   ### ⚠ BREAKING CHANGES
   - ...

   ### Features
   - **scope:** описание (`abc1234`)

   ### Bug Fixes
   - ...
   ```
   - **version**: из аргумента/целевого тега; иначе предложить по semver (feat → minor, fix-only → patch, breaking → major) или взять из `package.json`.
   - **дата**: сегодняшняя (или дата тега).

4. **Вывод/запись.**
   - Всегда напечатать готовую секцию пользователю.
   - При `--write`: вставить секцию **сверху** в `CHANGELOG.md` (после возможного заголовка `# Changelog`), не трогая старые записи; создать файл с заголовком, если его нет.

## Выход

- Текст релиз-нот (markdown-секция, готовая к вставке).
- При `--write` — обновлённый `CHANGELOG.md` (новая секция сверху) + путь к файлу.
- Короткая сводка: диапазон, сколько коммитов учтено / отброшено как шум.
