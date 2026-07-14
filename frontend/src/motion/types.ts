// =============================================================================
// Motion Engine v4 — Type Definitions
// -----------------------------------------------------------------------------
// Публичные типы движка анимаций. Здесь описан контракт для всех остальных
// файлов подсистемы motion/: engine.ts, presets/*, themes/*, capability.ts.
// =============================================================================

// -------------------------- Общие свойства --------------------------

/**
 * Все именованные визуальные цели анимаций.
 * Один AnimTarget = одна логическая роль элемента в UI.
 */
export type AnimTarget =
  | 'island'        // Островок группы (Board/GroupIsland.svelte)
  | 'lesson'        // Клетка урока (Board/LessonNode.svelte)
  | 'slot'          // Ячейка номера пары / времени (Board/SlotsColumn.svelte)
  | 'panelTitle'    // Заголовок панели «Колледж / Высшее» (PanelHeader.svelte)
  | 'page'          // Страница групп в панели (Board/Panel.svelte)
  | 'clock'         // Часы (TopBar/Clock.svelte)
  | 'now'           // Подсветка текущей пары (idle-emphasis)
  | 'connector'     // Соединительная линия между уроками
  | 'background'    // Фоновый слой (bg-layer)
  | 'overlay';      // Оверлеи (loading/error)

/**
 * Фазы анимации для одной цели.
 * Одна и та же цель может иметь разные пресеты в разных фазах.
 */
export type AnimPhase =
  | 'enter'         // Появление элемента
  | 'exit'          // Исчезновение элемента
  | 'move'          // FLIP-перестановка (First-Last-Invert-Play)
  | 'idle'          // Постоянные фоновые эффекты (пульс, glow)
  | 'emphasis'      // Одноразовое привлечение внимания (now-highlight)
  | 'dataChange';   // Плавная смена контента (типа NumberTicker)

export type PanelKind = 'college' | 'university';

// -------------------------- Easing --------------------------

/** Функция плавности вида (t: 0..1) => 0..1 */
export type EasingFn = (t: number) => number;

/** Имя easing или самостоятельная функция. */
export type EasingSpec =
  | EasingFn
  | 'linear'
  | 'ease-in-cubic'
  | 'ease-out-cubic'
  | 'ease-in-out-cubic'
  | 'ease-out-quart'
  | 'ease-out-quint'
  | 'ease-out-expo'
  | 'ease-in-out-expo'
  | 'ease-out-back'
  | 'ease-in-back'
  | 'ease-in-out-back'
  | 'ease-out-elastic'
  | 'ease-out-bounce'
  | 'spring'
  | 'spring-soft'
  | 'spring-snappy';

// -------------------------- Спецификация анимации --------------------------

/**
 * Единая спецификация одной анимации, независимая от Svelte-конкретики.
 * Через engine.ts она превращается в TransitionConfig (совместимый с in:/out:).
 */
export interface MotionSpec {
  /** Основная длительность анимации (ms). */
  duration?: number;
  /** Задержка старта (ms). */
  delay?: number;
  /** Функция плавности. */
  easing?: EasingSpec;

  /** Каскадный сдвиг задержки по index/total (см. stagger.ts). */
  stagger?: {
    mode?: 'index' | 'reverse' | 'distance' | 'wave' | 'shuffle';
    /** Множитель на позицию (ms). */
    step?: number;
    /** Максимальная суммарная задержка (ms). */
    max?: number;
  };

  /** Начальные значения (t=0 → это состояние). */
  from?: MotionState;
  /** Конечные значения (t=1 → это состояние). */
  to?: MotionState;

  /**
   * GPU-composited only. Если false — движок деградирует эффекты
   * (blur/filter/rotate3d) до простого opacity+translate.
   */
  gpuOnly?: boolean;
}

/**
 * Состояние элемента в конкретной точке анимации.
 * Все свойства — GPU-композитные (transform/opacity/filter/clip-path).
 */
export interface MotionState {
  opacity?: number;
  x?: number;              // translateX (px)
  y?: number;              // translateY (px)
  z?: number;              // translateZ (px)
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;         // rotateZ (deg)
  rotateX?: number;        // deg
  rotateY?: number;        // deg
  skewX?: number;          // deg
  skewY?: number;          // deg
  blur?: number;           // filter blur (px)
  saturate?: number;       // filter saturate (0..N)
  brightness?: number;     // filter brightness (0..N)
  clipInset?: [number, number, number, number]; // top,right,bottom,left в %
  /** Дополнительные raw-стили (в исключительных случаях). */
  raw?: string;
}

// -------------------------- Пресеты --------------------------

/**
 * Пресет — именованная спецификация анимации для конкретного (target, phase).
 * Одинаковые пресеты могут переиспользоваться между темами.
 */
export interface MotionPreset {
  name: string;
  /** Опциональные фазы. Если фазы нет — используется default-тема. */
  enter?: MotionSpec;
  exit?: MotionSpec;
  move?: MotionSpec;
  idle?: MotionSpec;
  emphasis?: MotionSpec;
  dataChange?: MotionSpec;
}

// -------------------------- Профиль элемента --------------------------

/**
 * Профиль конкретной цели: какой пресет использовать и опциональные
 * override-параметры (duration/delay/easing).
 */
export interface ElementProfile {
  preset?: string;
  duration?: number;
  delay?: number;
  easing?: EasingSpec;
  stagger?: MotionSpec['stagger'];
  /** Полное явное переопределение (наивысший приоритет). */
  overrides?: Partial<Record<AnimPhase, MotionSpec>>;
}

// -------------------------- Тема --------------------------

/**
 * Тема — именованный набор пресетов для всех целей.
 * default-тема должна покрывать все (target,phase) — она fallback.
 */
export interface MotionTheme {
  name: string;
  description?: string;
  /** Глобальный множитель скорости для этой темы. */
  speed?: number;
  /** Ссылка на другую тему-родитель (наследование). */
  extends?: string;
  /** Пресеты по target — по имени пресета. */
  targets: Partial<Record<AnimTarget, string>>;
}

// -------------------------- Разрешённая конфигурация --------------------------

/**
 * Итоговая, полностью разрешённая конфигурация movement runtime-a.
 * Формируется resolveTheme() из user config.yaml + defaults.
 */
export interface ResolvedMotion {
  enabled: boolean;
  themeName: string;
  speed: number;
  respectReducedMotion: boolean;
  performanceGuard: 'off' | 'auto' | 'aggressive';
  /** Пороговые значения FPS для деградации. */
  fpsThresholds: {
    full: number;      // >= full → full quality
    balanced: number;  // >= balanced → без blur
    low: number;       // >= low → только opacity/translate
                       // < low → motion disabled
  };
  /** По target — пресет и переопределения. */
  profiles: Partial<Record<AnimTarget, ElementProfile>>;
  /** Разрешённые пресеты (из тем + user presets). */
  presets: Record<string, MotionPreset>;
}

// -------------------------- Svelte transition --------------------------

/** Совместим с Svelte transition (in:/out:) — то, что возвращает getMotion. */
export interface TransitionConfig {
  delay?: number;
  duration?: number;
  easing?: EasingFn;
  css?: (t: number, u: number) => string;
  tick?: (t: number, u: number) => void;
}

/** Конфиг для animate:flip директивы. */
export interface FlipConfig {
  delay?: number;
  duration?: number | ((d: number) => number);
  easing?: EasingFn;
}

// -------------------------- Контекст вызова getMotion --------------------------

export interface MotionContext {
  index?: number;
  total?: number;
  kind?: PanelKind;
  now?: boolean;
  /** Направление для in/out (для двусторонних transitions). */
  side?: 'left' | 'right';
  /** Дополнительный ключ для группировки stagger. */
  group?: string;
}

// -------------------------- Уровень качества (динамический) --------------------------

/**
 * Runtime-quality: пересчитывается из capability.ts.
 * Каждый MotionSpec применяется через фильтр QualityLevel.
 */
export type QualityLevel = 'full' | 'balanced' | 'low' | 'off';

/** Runtime-состояние качества. */
export interface QualityState {
  level: QualityLevel;
  fps: number;
  reducedMotion: boolean;
  batteryLow: boolean;
  hidden: boolean;
}
