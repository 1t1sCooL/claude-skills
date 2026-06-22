---
name: flashcards
description: Generate Anki flashcards from a devlog, note, topic or the current session — extracts the concepts worth remembering (APIs, patterns, gotchas, commands) and exports tab-separated CSV (Q→A and cloze), with optional .apkg via genanki. Use when user says "сделай карточки", "anki из сессии", "флешкарты", "карточки для запоминания", "flashcards", or types /flashcards.
argument-hint: "[путь к заметке | тема | пусто=текущая сессия/последний девлог]"
allowed-tools: Read Write Edit Bash(python3 *)
---

# Flashcards (Anki)

Генератор карточек для интервального повторения из devlog / заметки / темы / текущей сессии.
Берёт то, что реально стоит запомнить (не тривиальщину), и отдаёт CSV для импорта в Anki.

## Что на входе (`$ARGUMENTS`)

- **Путь к заметке** (devlog/конспект), ИЛИ **тема**, ИЛИ **пусто** → текущая сессия / последний devlog (`~/Documents/1t1sCooL/Dev Diary/`).

## Шаги

1. **Извлечь концепты** из источника: технологии, API, паттерны, гетчи, команды, неочевидные выводы. Отсеять тривиальное.

2. **Сгенерировать карточки** двух типов:
   - **Q→A** — вопрос → ответ (для «что/зачем/как работает»).
   - **Cloze** — пропуски `{{c1::...}}` для определений, синтаксиса, команд.
   Формулировки активные: вопрос проверяет понимание, ответ короткий и точный.

3. **Экспорт в Anki:**
   - **CSV (tab-separated)** — основной формат. Базовые карточки: `front<TAB>back`. Cloze — отдельным файлом с шапкой `#notetype:Cloze` и колонкой `text`. Экранировать переносы/табы.
   - Опционально **`.apkg`** через `genanki` (если доступен `python3` + пакет); фолбэк — только CSV.

4. **Инструкция импорта** — как залить в Anki (File → Import, разделитель Tab, выбрать notetype Basic / Cloze).

## Выход

- `./flashcards/<topic-or-date>.csv` (Basic) + при наличии cloze — `./flashcards/<topic-or-date>-cloze.csv`.
- Опц. `./flashcards/<topic-or-date>.apkg`.
- Короткая инструкция импорта + сколько карточек сгенерировано.
