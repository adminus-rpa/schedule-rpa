# Motion Engine v4

Единая подсистема анимаций для Schedule-RPA. Заменяет разрозненные
`utils/transitions.ts` + `styles/legacy.css` v3 на конфигурируемый движок
с темами, пресетами, каскадами и Performance Guard.

---

## Быстрый старт

```svelte
<script lang="ts">
  import { motion, getFlip } from '$motion';
  import { flip } from 'svelte/animate';

  const flipCfg = getFlip('island');
</script>

{#each groups as g, i (g.name)}
  <div
    class="group-island"
    in:motion={{ target: 'island', phase: 'enter', index: i, total: groups.length }}
    out:motion={{ target: 'island', phase: 'exit', index: i }}
    animate:flip={{ duration: flipCfg.duration, easing: flipCfg.easing }}
  >
    …
  </div>
{/each}
```

`motion` — Svelte-совместимая transition-функция.
`getFlip('island')` — конфиг для `animate:flip`, зависящий от текущей темы и quality-level.

---

## API

### `motion(node, params: MotionParams)`
Основная точка использования из компонентов.

```ts
interface MotionParams {
  target: AnimTarget;
  phase: AnimPhase;
  index?: number;      // для stagger
  total?: number;      // общее число элементов (для reverse/distance/wave)
  kind?: 'college' | 'university';
  side?: 'left' | 'right';
  now?: boolean;
}
```

### `getMotion(target, phase, ctx?)`
Программный доступ. Возвращает `TransitionConfig`
(`{ duration, delay, easing, css }`), совместимый с Svelte.

### `getFlip(target, params?)`
Возвращает `FlipConfig` для директивы `animate:flip`.

### `resolveTheme(config)`
Свернуть текущий config.yaml → `ResolvedMotion`. Вызывается автоматически
из `stores/config.svelte.ts`, но можно позвать вручную в тестах.

### `capability`
Синглтон, отслеживающий FPS/reduced-motion/battery/visibility.
Уведомляет `engine` при деградации качества.

---

## Целевые элементы (`AnimTarget`)

| target       | Где                                | Типовое поведение                              |
|--------------|-------------------------------------|------------------------------------------------|
| `island`     | `GroupIsland.svelte`                | Каскадное появление + FLIP-перестановка        |
| `lesson`     | `LessonNode.svelte`                 | enter/exit + плавная dataChange                |
| `slot`       | `SlotsColumn.svelte`                | Каскадное появление номеров пары               |
| `panelTitle` | `PanelHeader.svelte`                | Slide/fade заголовка между вузом и колледжем   |
| `page`       | `Panel.svelte` (страница расписания)| enter/exit при переключении страниц групп      |
| `clock`      | `TopBar/Clock.svelte`               | dataChange для тиковых обновлений времени      |
| `now`        | подсветка текущей пары              | idle-пульсация                                 |
| `connector`  | линия между уроками                 | Отрисовка/фейд                                 |
| `background` | `.bg-layer`                         | Медленный дрейф                                |
| `overlay`    | overlays/*                          | Fade с blur                                    |

---

## Фазы (`AnimPhase`)

- `enter` — появление
- `exit` — исчезновение
- `move` — FLIP (перестановка)
- `idle` — постоянные фоновые эффекты (пульс, glow, drift)
- `emphasis` — одноразовое привлечение внимания
- `dataChange` — плавная смена содержимого (число, слово)

---

## Темы

| Название       | Стиль                                                     | Длительность |
|----------------|-----------------------------------------------------------|--------------|
| `default`      | Совместимость с v3 (islandAppear + swap)                  | 400–500ms    |
| `apple-tv`     | Мягкие springs, blur, glow                                | 400–700ms    |
| `linear-crisp` | Быстрый ease-out-quart, без blur                          | 180–320ms    |
| `paper`        | Fade + soft slide, 2D-only                                | 250–400ms    |
| `neon`         | Glow-пульсации, spring, saturate                          | 400–700ms    |
| `minimal`      | Только opacity, для слабых устройств                      | 150–200ms    |
| `kinetic`      | Ease-out-back/elastic, лёгкие вращения                    | 400–500ms    |
| `editorial`    | Reveal через clip-path                                    | 700–900ms    |

Смена темы — в `config.yaml`:

```yaml
motion:
  theme: "apple-tv"
```

---

## Приоритет разрешения

При вычислении спецификации для (target, phase) движок последовательно
проверяет источники и берёт первый существующий:

1. **`motion.overrides.<target>.<phase>`** — явное переопределение
2. **`motion.presets.<target>`** — пресет для target-а
3. **`motion.targets.<target>.preset`** — пресет через профиль
4. **`motion.theme`** → выбранная тема
5. **Тема-родитель** (для тем с `extends`)
6. **Fallback: `default`-тема**

---

## Performance Guard

`capability.ts` каждые ~1000ms замеряет FPS. При устойчивом падении
уровень качества `QualityLevel` понижается автоматически:

| FPS      | Level      | Эффекты                                    |
|----------|------------|--------------------------------------------|
| ≥ 55     | `full`     | Полное качество (blur, glow, 3D, filter)   |
| 40–54    | `balanced` | Без blur/saturate/brightness               |
| 25–39    | `low`      | Только opacity + translate (без 3D/filter) |
| < 25     | `off`      | Мгновенные переходы (`duration: 0`)        |

`prefers-reduced-motion: reduce` и низкий заряд батареи (`<20%` при отсутствии
зарядки) немедленно переводят в `off` / `low`.

Отключить: `motion.performance_guard: "off"`.

---

## Пресеты (`motion/presets/index.ts`)

Все пресеты — Named `MotionPreset` объекты. Одна и та же спецификация
может использоваться разными темами.

### Пресеты по категориям:

- **Island**: `softRise`, `popIn`, `drift`, `fold3d`, `flare`, `slideCascade`,
  `dominoWave`, `tiltIn`
- **Lesson**: `fadeUp`, `fadeLeft`, `scaleIn`, `typewriter`, `curtain`, `lessonNone`
- **Page (modern)**: `cinematicSlide`, `pushStack`, `carousel3d`, `radialWipe`,
  `sectionSlide`, `elastic`
- **Page (legacy)**: `slide`, `fade`, `zoom`, `flip`, `cube`, `stack`, `reveal`,
  `swap`, `none`
- **Panel**: `panelSlide`, `panelFadeUp`, `panelCrossfade`
- **Slot**: `slotPop`, `slotFade`
- **Clock**: `clockTick`, `clockFade`
- **Now**: `nowPulse`, `nowGlow`, `nowNone`
- **Connector**: `connectorDraw`, `connectorFade`
- **Background**: `bgDrift`, `bgStatic`
- **Overlay**: `overlayFade`

---

## Easings (`motion/easings.ts`)

Стандартные: `linear`, `ease-in-cubic`, `ease-out-cubic`, `ease-in-out-cubic`,
`ease-out-quart`, `ease-out-quint`, `ease-out-expo`, `ease-in-out-expo`,
`ease-in-back`, `ease-out-back`, `ease-in-out-back`, `ease-out-elastic`,
`ease-out-bounce`.

Дополнительно: `spring`, `spring-soft`, `spring-snappy`, `cubicBezier(x1,y1,x2,y2)`.

---

## Каскады (`motion/stagger.ts`)

Режимы:

- `index` — линейно от 0 до N (по умолчанию)
- `reverse` — от N до 0
- `distance` — из центра наружу
- `wave` — синусоидальная волна
- `shuffle` — детерминированный шафл

Параметры: `step_ms`, `max_ms`.

```yaml
motion:
  targets:
    island:
      stagger:
        mode: "wave"
        step_ms: 60
        max_ms: 900
```

---

## FLIP (`motion/flip.ts`)

`getFlip(target)` возвращает конфиг с длительностью/easing/delay,
адаптированный под текущий quality-level. Ниже `low` длительность режется
до 220ms; на `off` — 0ms.

---

## Хореография страниц (`motion/choreography.ts`)

Для страничных переходов используется `planPageTransition(total_ms, overlap)`.
`overlap=0.5` — стандартный «полу-нахлёст», при котором старая страница
уходит одновременно с приходом новой.

---

## Тесты

Smoke-тесты — `motion/__tests__/engine.spec.ts` (vitest-совместимо).
Проверяют: resolveTheme, приоритет разрешения, стажировку, spring-функцию,
план хореографии.

---

## Расширение

**Добавить пресет:** в `motion/presets/index.ts` создайте `P('myPreset', {…})`
и добавьте в `PRESETS` map.

**Добавить тему:** в `motion/themes/index.ts` создайте `MotionTheme` и
зарегистрируйте в `THEMES`.

**Добавить target:** в `motion/types.ts` расширьте union `AnimTarget`,
добавьте пресеты во все существующие темы + `default`.
