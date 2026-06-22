---
name: tg-content
description: Content plan and ready-to-post drafts for the author's personal Telegram channel — reads the channel's recent posts to match tone, proposes rubrics, and writes a period plan plus 3-5 finished Telegram posts with hooks and a soft CTA to mmalabugin.ru. Asks for the channel handle once and saves it to ./growth/config.json. Use when user says "контент-план для тг", "посты для канала", "что postить в телеграм", "telegram content", or types /tg-content.
argument-hint: "[тема | период, напр. неделя | тема: веб-перформанс]"
allowed-tools: Read Write Edit WebFetch WebSearch AskUserQuestion
---

# Telegram Content

Контент-план и готовые посты для **личного ТГ-канала** автора (тематика: фронтенд,
веб-перформанс, аудиты, dev-практики). Ловит tone-of-voice по последним постам и пишет
посты, которые ведут на `mmalabugin.ru` без впаривания.

## Что на входе (`$ARGUMENTS`)

- Опц. **тема** (`тема: веб-перформанс`) и/или **период** (`неделя`, `2 недели`). Пусто → план на неделю по миксу тем.

## Конфигурация (один раз)

Хэндл канала — из `./growth/config.json`:
```json
{ "tg_channel": "<@handle или t.me/...>", "site": "mmalabugin.ru" }
```
Если файла/хэндла нет — **спросить через AskUserQuestion** и предложить сохранить (не выдумывать хэндл).

## Шаги

1. **Хэндл канала** — прочитать из config или спросить и сохранить.
2. **Поймать голос** — по возможности через WebFetch глянуть публичную ленту `https://t.me/s/<handle>`: какие посты заходят (реакции/просмотры если видно), длина, стиль, темы.
3. **Рубрики** — предложить 4–6 под тематику: разбор кейса, мини-урок, до/после аудита, инструмент дня, личный опыт/факап, разбор чужого сайта.
4. **Контент-план** на период — таблица: день / рубрика / тема / хук.
5. **3–5 готовых постов** под формат Telegram: цепляющий первый абзац, по делу, абзацы с воздухом, эмодзи в меру, мягкий CTA (на `mmalabugin.ru`, услугу аудита или обсуждение в комментах).

## Выход

- `./growth/tg-content-<date>.md` — рубрики + контент-план + готовые посты.
- При первом запуске — созданный/обновлённый `./growth/config.json`.
