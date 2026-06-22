---
name: news-filter
description: Generate a ready-to-post Telegram news digest that filters signal from hype — scans fresh news across the stock market, crypto, AI and tech, labels each item 🟢 important / 🟡 watch / 🔴 noise, and writes a finished post in your channel's voice (no hype, practical lens). Powers a recurring «📡 Filter» rubric. Use when user says "сделай фильтр", "новостной дайджест", "пост про новости", "what's signal vs hype", "news filter", or types /news-filter.
argument-hint: "[focus: stocks | crypto | ai | tech | a specific story/topic]"
allowed-tools: Read Write Edit WebFetch WebSearch AskUserQuestion Bash
---

# 📡 News Filter — signal-vs-hype digest for a Telegram channel

Engine for a recurring **«📡 Filter»** rubric. Pulls fresh news from four worlds,
**separates signal from hype**, and writes a ready-to-post digest in the channel's
voice. The rubric's value: readers get not a headline feed but a curator's verdict —
*what matters, what's noise, what it means in practice*.

## Config (once)

Channel handle + optional project paths from `./growth/config.json`:
```json
{ "tg_channel": "<@handle или t.me/...>", "post_dir": "<dir for finished posts>" }
```
If missing — **ask via AskUserQuestion** and offer to save (do not invent a handle).
Optional: read a local `rubric.md` / `post-template.md` if the project has one, to match tone.

## Что на входе (`$ARGUMENTS`)

- Опц. **фокус**: `stocks` / `crypto` / `ai` / `tech` — сузить дайджест до одного мира.
- Опц. **конкретная новость/тема** (`тема: rate cut`) — собрать вокруг неё.
- Пусто → просканировать все четыре мира и собрать смешанный выпуск из 2–3 лучших новостей.

## Источники (искать свежее — окно ~7–14 дней)

- 📈 **Stock market:** exchange newsroom, Reuters/Bloomberg, broker research. Signals: central-bank rate, dividends of blue chips, key earnings, IPO/delisting, market infrastructure. *(Localize to your market — e.g. MOEX for RU, NYSE/NASDAQ for US.)*
- 🪙 **Crypto:** CoinDesk, The Block, CoinShares fund-flow reports; regulation (SEC, ETF flows), major BTC/ETH moves, on-chain. Отсекать памп альтов и «X взлетел на 300%».
- 🤖 **AI:** model releases (Anthropic / OpenAI / Google / Meta), benchmarks, API pricing, developer tools, regulation. Угол — *что меняет работу инженера*.
- 💻 **Tech:** framework releases (React / Next.js / TypeScript / Node), browsers, devtools, big industry shifts.

WebSearch для свежих заголовков, WebFetch — чтобы дойти до первоисточника (не пересказывать
чужой пересказ). Дату «сегодня» брать из окружения, не выдумывать. Числа/версии — проверять.

## Шаги

1. **Config + tone** — прочитать `config.json`; при наличии — локальные `rubric.md`/`post-template.md`.
2. **Определить фокус** из `$ARGUMENTS` (или все четыре мира).
3. **Собрать свежак** — WebSearch по каждому миру, окно ~7–14 дней. Для каждого кандидата дойти до первоисточника (WebFetch).
4. **Фильтр сигнал/шум** — главный шаг. Отбросить «заголовок ради заголовка». Оставить только то, что **реально меняет картину**. Лучше 1 сильная новость, чем 3 проходных. **Не гнаться за каждым инфоповодом.**
5. **Оценить каждую** ярлыком + одной фразой «что это значит на практике»:
   - 🟢 **important** — меняет решения/картину;
   - 🟡 **watch** — потенциал есть, но рано судить;
   - 🔴 **noise/hype** — раздуто, на практике ничего не меняет (показываем как пример того, что отфильтровали).
6. **Написать пост** по скелету ниже, в голосе канала.
7. **Самопроверка**: один смысл-вектор, хук в первых 2 строках, длина 1500–3000 знаков (≤4096), теги, тон без хайпа.
8. **Сохранить** файл (см. «Выход»).

## Скелет поста (Telegram, 1500–3000 знаков)

```
[ХУК] — 1–2 строки. Рамка: «за неделю три новости реально стоили внимания — остальное шум».

📈/🪙/🤖/💻 **[Новость 1 — суть в 1–2 строки своими словами]**
🟢/🟡/🔴 [Оценка: почему важно / почему шум + что это значит на практике]

📈/🪙/🤖/💻 **[Новость 2 …]**
🟢/🟡/🔴 [Оценка …]

(опц. Новость 3)

**Вывод:** один сигнал навынос — на что реально смотреть, а на что забить.

[CTA — мягкий]

#фильтр #тег_столпа
```

## Правила (тон рубрики)

- **Сигнал, а не лента.** Ценность — в фильтре и оценке, а не в пересказе заголовков.
- **Честно, без хайпа.** Можно «пока непонятно» / «рынок переоценил». Это и есть бренд.
- **Своими словами + первоисточник.** Не копипастить пресс-релизы; дать ссылку на источник.
- **Практический угол.** Каждая новость — через «что это значит на практике».
- **Не каждую неделю.** Вставлять разово под инфоповод (вне жёсткой сетки), чтобы не было беговой дорожки и протухания.
- **Никаких инвестрекомендаций** — оценка важности ≠ совет покупать. При новостях про активы добавлять «не инвестрекомендация».

## Выход

- Файл `<post_dir>/Filter — <YYYY-MM-DD>.md`: заголовок, строка-мета (рубрика/столп/формат/теги/статус), блок «## Текст поста» с готовым постом, и список ссылок на источники в конце.
- В ответе пользователю — сам текст поста (готов к копипасте) + ярлыки оценок + откуда новости.
- Не постит в Telegram сам — только готовит текст; публикует пользователь (отложка/вручную).
