# Расписание — фронтенд (Svelte 5 + Vite + TypeScript)

Клиентская часть приложения `schedule_app` v3.
Собирается в `../app/static/dist/` и раздаётся Flask'ом.
На проде **Node.js не требуется** — Flask отдаёт готовую статику.

## Стек

- Svelte 5 (runes mode: `$state`, `$derived`, `$effect`)
- Vite 5
- TypeScript 5 (strict)
- Без runtime-зависимостей (Intl.DateTimeFormat, EventSource — встроенные)

## Команды

```bash
# Установка зависимостей
npm install

# Разработка: dev-сервер Vite на :5173, проксирует /api/* -> Flask (:9090)
npm run dev

# Продакшн-сборка (проверка типов + Vite build)
npm run build

# Продакшн-сборка БЕЗ svelte-check (быстрее)
npm run build:nocheck

# Проверка типов и .svelte-файлов
npm run check
```

## Структура

```
src/
├── App.svelte              — корневой компонент, bootstrap, глобальные эффекты
├── main.ts                 — точка входа
├── stores/                 — реактивные stores через $state в .svelte.ts
│   ├── config.svelte.ts        — /api/config + применение CSS-переменных
│   ├── schedule.svelte.ts      — /api/schedule + навигация по датам
│   ├── sse.svelte.ts           — EventSource + polling fallback + status
│   ├── clock.svelte.ts         — now (30s tick), midnight-guard
│   ├── layout.svelte.ts        — activePanel, pageIndex, groupsPerPage
│   └── fullscreen.svelte.ts    — Fullscreen API + cursor auto-hide
├── components/
│   ├── Icon.svelte             — <use href="/static/img/icons.svg#i-{name}">
│   ├── TopBar/                 — шапка (бренд, DateNav, часы, статус, F11)
│   ├── Board/                  — расписание (Panel × 2, Page, SlotsColumn,
│   │                             GroupIsland, LessonNode, PanelHeader)
│   └── overlays/               — LoadingOverlay, ErrorOverlay
├── utils/
│   ├── time.ts                 — parseISO, toISO, fmtDateLong, isSlotNow, ...
│   ├── format.ts               — splitRoom, truncateSubject, floorColor
│   ├── slots.ts                — buildAllSlots, computeGroupsPerPage
│   ├── transitions.ts          — swapTransition: 9 типов (swap/slide/fade/…)
│   └── keyboard.ts             — F11 / M / T / R / стрелки (RU-раскладка)
├── types/
│   └── api.ts                  — TS-типы ответов /api/schedule, /api/config
└── styles/
    ├── main.css                — CSS-переменные :root по умолчанию
    └── legacy.css              — унаследованный style.css (визуал 1-в-1)
```

## Что было исправлено при миграции

| Bug     | Что было                          | Как исправлено                              |
|---------|-----------------------------------|---------------------------------------------|
| BUG-1   | Иконка F11 не отображается        | `Icon.svelte` — прямая ссылка на спрайт     |
| BUG-2   | Утечка `setTimeout` в `pollStatus`| `$effect` с cleanup в `sse.svelte.ts`       |
| BUG-3   | Race condition polling fallback   | Guard-флаг + `AbortController`              |
| BUG-4   | `querySelectorAll` каждые 30 сек  | `$derived(isSlotNow(slot.time, clock.now))` |
| BUG-5   | Утечка midnight-таймера           | `clock.start()` возвращает cleanup          |
| BUG-6   | Нет ARIA-атрибутов                | `aria-label`, `aria-live="polite"` на `<section>` |
| BUG-7   | Ручное `escapeHTML` + `innerHTML` | Svelte экранирует `{expression}` по умолчанию (нигде нет `{@html}`) |
| BUG-8   | SSE не закрывается на hidden      | `$effect` на `visibilitychange` → `sse.close/open` |
| BUG-9   | `cache: 'no-store'` для `/api/config` | Убрано — SSE `config_updated` триггерит `config.load()` |
| BUG-10  | Ghost-sweeper (костыль)           | Удалён — `{#key}` + `in:/out:` Svelte-transitions |

## Bundle size

Ориентир после сборки:

- `assets/app.[hash].js`  ≈ 26 KB gzip (лимит ТЗ: ≤ 40 KB) ✓
- `assets/app.[hash].css` ≈ 5 KB gzip  (лимит ТЗ: ≤ 15 KB) ✓
