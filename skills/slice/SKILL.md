---
name: slice
description: Scaffold a Feature-Sliced Design slice (layer + name) in the current Next.js/FSD project — detects the repo's real conventions (TS/JS, CSS Modules, barrel format, naming) and generates the folder, segments, component stub and index.ts. Use when user says "создай слайс", "заскаффоль фичу", "новый widget/entity/feature", "scaffold slice", "new FSD slice", or types /slice.
argument-hint: "<layer> <name> (напр. feature complaint-form | entity user | widget photo-gallery)"
allowed-tools: Read Write Edit Glob Grep Bash
---

# FSD Slice Scaffolder

Скаффолдер слайса по Feature-Sliced Design: создаёт папку в нужном слое с сегментами,
компонентом-заготовкой и barrel-реэкспортом. Проектно-зависимый скилл — **конвенции
детектятся из текущего репозитория**, ничего не навязывается. Подстраивается под TS/JS,
CSS Modules, формат barrel и нейминг конкретного проекта.

## Что на входе (`$ARGUMENTS`)

`<layer> <name>` — два токена через пробел:
- **layer** — один из слоёв FSD: `app` / `processes` / `pages` / `widgets` / `features` / `entities` / `shared`.
  Принимай и единственное число (`feature`, `entity`, `widget`) → нормализуй в реальное имя папки слоя в репо.
- **name** — имя слайса (как ввёл пользователь, напр. `complaint-form`, `user`, `photo-gallery`).

Если аргументов нет или непонятен слой — спроси одним вопросом слой + имя.

## Шаги

1. **Корень проекта и слой.** Найди корень FSD: где лежат слои (`src/`, корень, или иное).
   ```bash
   find . -maxdepth 3 -type d \( -name features -o -name entities -o -name widgets -o -name shared -o -name pages \) -not -path '*/node_modules/*'
   ```
   Определи фактический путь и точное имя папки слоя (мн. число как в репо). Если слоя ещё нет — создай по аналогии с соседними.

2. **Детект конвенций (главное!).** Прочитай 2–3 существующих слайса в том же или соседнем слое (Glob + Read) и зафиксируй:
   - **TS или JS** — расширения `.tsx/.ts` vs `.jsx/.js` (смотри tsconfig / реальные файлы).
   - **CSS Modules?** — есть ли `*.module.css` рядом с компонентами; как импортируется (`import styles from './X.module.css'`).
   - **Сегменты** — какие используют (`ui/ model/ lib/ api/`), плоско или с под-папками на компонент.
   - **Barrel** — формат `index.ts`: что и как реэкспортит (`export { X } from './ui/X'`, `export * from ...`, named vs default).
   - **Нейминг** — компоненты PascalCase, папки kebab-case (или иначе — следуй репо).
   - **'use client'** — ставят ли директиву в ui-компонентах (App Router / React 19).

3. **Создай структуру** строго по найденной конвенции, минимально-достаточно:
   - `<root>/<layer>/<name>/`
   - `ui/<Component>.tsx` — заготовка компонента (PascalCase из `name`); `'use client'` если так принято; разметка-плейсхолдер.
   - `ui/<Component>.module.css` — если в проекте CSS Modules (корневой класс по имени компонента).
   - `model/` — только если слою это свойственно (стор/типы/хуки); иначе не создавать пустые сегменты.
   - `index.ts` — barrel в формате репо, реэкспортит публичный API слайса (обычно компонент).

4. **Не ломать существующее.** Если слайс уже есть — не перезаписывать: сообщить и предложить дополнить недостающие сегменты. Следовать реальному стилю, а не «каноничному» FSD из учебника.

## Выход

- Список созданных файлов (абсолютные пути).
- Кратко: какие конвенции задетектил (TS/JS, CSS Modules да/нет, формат barrel, `'use client'`).
- Подсказка по следующему шагу: где подключить слайс (импорт через barrel выше по слоям, соблюдая правило зависимостей FSD — вышестоящий слой импортирует нижестоящий, не наоборот).
