---
name: news-filter
description: Two-phase news engine for a recurring «📡 Filter» rubric. Phase 1 — pull a POOL of fresh news candidates across the stock market, crypto, AI and tech (one-liner + provisional 🟢/🟡/🔴 each) and let the user pick one + add their angle. Phase 2 — write ONE full Telegram post (~1500–3000 chars) on that single story in the channel's voice (no hype, practical lens). Use when user says "сделай фильтр", "пул новостей", "новости на пост", "news filter", or types /news-filter.
argument-hint: "[focus: stocks | crypto | ai | tech | empty = all worlds]"
allowed-tools: Read Write Edit WebFetch WebSearch AskUserQuestion Bash
---

# 📡 News Filter — signal-vs-hype engine for a Telegram channel

Engine for a recurring **«📡 Filter»** rubric. Works in **two phases**: first it hands the
user a **pool of fresh news** from four worlds (stocks / crypto / AI / tech), the user
**picks one** and adds their angle; then it writes **one full post** (~1500–3000 chars) on
that single story. The rubric's value: not a headline feed but a curator's verdict —
*what matters, what's noise, what it means in practice*.

> ⚠️ **One post = one story.** Never glue several mini-blurbs into a digest — the user picks
> a topic from the pool and it's expanded into a full post. The pool is only for choosing.

## Config (once)

Channel handle + optional post dir from `./growth/config.json`:
```json
{ "tg_channel": "<@handle или t.me/...>", "post_dir": "<dir for finished posts>" }
```
If missing — **ask via AskUserQuestion** and offer to save (do not invent a handle).
Optional: read a local `rubric.md` / `post-template.md` if the project has one, to match tone.

## Что на входе (`$ARGUMENTS`)

- Опц. **фокус**: `stocks` / `crypto` / `ai` / `tech` — сузить пул до одного мира.
- Пусто → собрать пул по всем четырём мирам.

## Источники (искать свежее — окно ~7–14 дней)

- 📈 **Stocks:** exchange newsroom, Reuters/Bloomberg, broker research. Signals: central-bank rate, dividends, key earnings, IPO/delisting, market infrastructure. *(Localize to your market.)*
- 🪙 **Crypto:** CoinDesk, The Block, CoinShares fund-flow reports; regulation (SEC, ETF flows), major BTC/ETH moves. Отсекать памп альтов.
- 🤖 **AI:** model releases (Anthropic / OpenAI / Google / Meta), benchmarks, API pricing, dev tools, regulation. Угол — *что меняет работу инженера*.
- 💻 **Tech:** framework releases (React / Next.js / TypeScript / Node), browsers, devtools, big shifts.

## Шаги

### Фаза 1 — Пул новостей (выдать и ОСТАНОВИТЬСЯ)

1. **Config + tone** — прочитать `config.json`; при наличии — локальные `rubric.md`/`post-template.md`.
2. **Определить фокус** из `$ARGUMENTS` (или все четыре мира).
3. **Собрать свежак** — WebSearch по каждому миру, окно ~7–14 дней. Первоисточник тут можно не открывать (это для фазы 2).
4. **Предварительный фильтр** — отсеять явный мусор. Оставить **8–12 кандидатов**, достойных внимания.
5. **Выдать пул** нумерованным списком, сгруппировав по 📈/🪙/🤖/💻. Каждый:
   `N. <emoji> <суть в одну строку> — <предв. 🟢/🟡/🔴> · <источник>`.
6. **СТОП. Спросить пользователя:** какую новость берём + какой угол/идеи вложить
   (AskUserQuestion с топ-кандидатами + «Other», либо ждать ответа). **Не писать пост до выбора.**

### Фаза 2 — Один пост (после выбора)

7. **Проверить факты** выбранной новости по **первоисточнику** (WebFetch): числа, версии, даты. Расхождение с заголовком — берём первоисточник.
8. **Написать ОДИН полноценный пост** (~1500–3000 знаков) по скелету ниже, раскрывая одну новость на всю глубину и **вплетая идеи пользователя**.
9. **Самопроверка**: одна мысль, хук в первых 2 строках, практика > рассуждений, длина, теги, тон без хайпа.
10. **Сохранить** файл (см. «Выход») + выдать чистый текст для копипасты.

## Скелет поста (Telegram, ОДНА новость, 1500–3000 знаков)

```
[ХУК] — 1–2 строки. Контринтуитив или рамка вокруг этой новости. Не «сегодня вышла новость…».

[ЧТО СЛУЧИЛОСЬ] — 2–3 строки своими словами: суть события без воды.

🟢/🟡/🔴 [ВЕРДИКТ] — сигнал это или шум, и почему именно так.

[ЧТО ЭТО ЗНАЧИТ НА ПРАКТИКЕ] — мясо. Разбор/список/цифры через практическую призму.
Сюда вплетаются идеи и угол, которые накидал пользователь.
• пункт
• пункт

[ВЫВОД] — один инсайт навынос.

[CTA — мягкий]

#фильтр #тег_столпа
```

## Правила (тон рубрики)

- **Сигнал, а не лента.** Ценность — в фильтре и оценке, а не в пересказе заголовков.
- **Честно, без хайпа.** Можно «пока непонятно» / «рынок переоценил».
- **Своими словами + первоисточник.** Не копипастить пресс-релизы; дать ссылку.
- **Практический угол.** Новость — через «что это значит на практике».
- **Не каждую неделю.** Вставлять разово под инфоповод, чтобы не было беговой дорожки.
- **Никаких инвестрекомендаций** — оценка важности ≠ совет покупать. При новостях про активы добавлять «не инвестрекомендация».

## Выход

- Файл `<post_dir>/Filter — <YYYY-MM-DD>.md`: заголовок, строка-мета, блок «## Текст поста», ссылки на источники.
- В ответе — чистый текст поста для копипасты + откуда новость.
- Не постит в Telegram сам — публикует пользователь.
