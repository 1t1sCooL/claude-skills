---
name: invoice
description: Generate an invoice / счёт / акт from a deal scope (a proposal file or free-text line items), with auto-numbering and requisites from a billing profile — outputs a markdown invoice plus a standalone printable HTML (print-to-PDF). Defaults to RF self-employed/ИП, no VAT. Use when user says "выстави счёт", "сделай инвойс", "счёт клиенту", "акт", "invoice", or types /invoice.
argument-hint: "[путь к proposal.md | описание позиций и сумм]"
allowed-tools: Read Write Edit AskUserQuestion Bash
---

# Invoice / Счёт

Генератор счёта/акта из scope сделки. Реквизиты исполнителя — из профиля биллинга,
нумерация — автоинкремент. По умолчанию контекст РФ: самозанятый/ИП, **без НДС**
(настраивается). Выдаёт markdown + автономный HTML для печати в PDF.

## Что на входе (`$ARGUMENTS`)

Один из:
- **Путь к `proposal.md`** → взять позиции и суммы из выбранного тарифа.
- **Свободное описание** позиций и сумм.
- **Пусто** → спросить позиции и заказчика через AskUserQuestion.

## Конфигурация (один раз)

Реквизиты исполнителя — из `./billing/profile.json`; если файла нет — создать шаблон и попросить заполнить:
```json
{
  "executor": { "name": "<ФИО / ИП>", "status": "самозанятый | ИП", "inn": "<ИНН>", "phone": "", "email": "" },
  "payment": { "bank": "", "account": "", "bik": "", "card": "" },
  "vat": false,
  "currency": "RUB"
}
```
> Секреты (токены и т.п.) — в `~/.claude/secrets.env`, в счёт не попадают. В `profile.json` только платёжные реквизиты.

## Шаги

1. **Реквизиты.** Прочитать `./billing/profile.json` (или создать шаблон и остановиться, попросив заполнить).
2. **Номер.** Прочитать `./billing/counter` (целое), инкрементировать, записать обратно. Формат номера — напр. `2026-007`.
3. **Позиции.** Собрать строки: наименование работы, кол-во, цена, сумма. Посчитать итого. НДС по умолчанию нет (если `vat:true` — добавить расчёт).
4. **Заказчик.** Имя/реквизиты заказчика (спросить, если не даны).
5. **Сформировать документ:** номер, дата (системная), исполнитель, заказчик, таблица позиций, итого прописью, реквизиты для оплаты, основание (договор/оферта — плейсхолдер).

## Выход

- `./billing/invoices/<number>.md` — счёт в markdown.
- `./billing/invoices/<number>.html` — автономный одностраничный HTML (инлайн-стили, A4, печать → PDF из браузера).
- Обновлённый `./billing/counter`.
- Напоминание: проверить реквизиты в `profile.json` перед отправкой.
