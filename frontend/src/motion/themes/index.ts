// =============================================================================
// Motion Engine v4 — Theme Library
// -----------------------------------------------------------------------------
// 7 фирменных motion-тем + default (fallback). Каждая тема — карта
// { AnimTarget → имя пресета }. Пресеты живут в motion/presets/.
// =============================================================================

import type { MotionTheme } from '../types';

// ---------- default: обратная совместимость с v3 ----------

const defaultTheme: MotionTheme = {
  name: 'default',
  description: 'Стандартный набор, максимально близкий к поведению v3 (islandAppear + swap).',
  speed: 1,
  targets: {
    island: 'softRise',
    lesson: 'fadeUp',
    slot: 'slotFade',
    panelTitle: 'panelSlide',
    page: 'swap',
    clock: 'clockFade',
    now: 'nowPulse',
    connector: 'connectorFade',
    background: 'bgStatic',
    overlay: 'overlayFade',
  },
};

// ---------- apple-tv: мягкие пружины, blur, glow ----------

const appleTv: MotionTheme = {
  name: 'apple-tv',
  description: 'Мягкие springs, blur и субтильный glow. 400–700ms.',
  speed: 1,
  targets: {
    island: 'softRise',
    lesson: 'fadeUp',
    slot: 'slotPop',
    panelTitle: 'panelFadeUp',
    page: 'cinematicSlide',
    clock: 'clockTick',
    now: 'nowGlow',
    connector: 'connectorFade',
    background: 'bgDrift',
    overlay: 'overlayFade',
  },
};

// ---------- linear-crisp: быстрая, чёткая линеарность ----------

const linearCrisp: MotionTheme = {
  name: 'linear-crisp',
  description: 'Быстрый ease-out-quart, 180–320ms, без blur и 3D.',
  speed: 1.05,
  targets: {
    island: 'slideCascade',
    lesson: 'fadeLeft',
    slot: 'slotFade',
    panelTitle: 'panelCrossfade',
    page: 'sectionSlide',
    clock: 'clockFade',
    now: 'nowPulse',
    connector: 'connectorFade',
    background: 'bgStatic',
    overlay: 'overlayFade',
  },
};

// ---------- paper: fade + soft slide, 2D-only ----------

const paper: MotionTheme = {
  name: 'paper',
  description: 'Спокойный fade и soft-slide, 250–400ms, только 2D.',
  speed: 1,
  targets: {
    island: 'drift',
    lesson: 'fadeUp',
    slot: 'slotFade',
    panelTitle: 'panelCrossfade',
    page: 'fade',
    clock: 'clockFade',
    now: 'nowPulse',
    connector: 'connectorFade',
    background: 'bgStatic',
    overlay: 'overlayFade',
  },
};

// ---------- neon: glow-пульсация, spring, blur, saturate ----------

const neon: MotionTheme = {
  name: 'neon',
  description: 'Glow-пульсации, spring, blur и saturate-filter.',
  speed: 1,
  targets: {
    island: 'flare',
    lesson: 'scaleIn',
    slot: 'slotPop',
    panelTitle: 'panelSlide',
    page: 'radialWipe',
    clock: 'clockTick',
    now: 'nowGlow',
    connector: 'connectorDraw',
    background: 'bgDrift',
    overlay: 'overlayFade',
  },
};

// ---------- minimal: только opacity ----------

const minimal: MotionTheme = {
  name: 'minimal',
  description: 'Только opacity, 150–200ms. Идеально для e-ink/слабых устройств.',
  speed: 1,
  targets: {
    island: 'fadeUp',
    lesson: 'lessonNone',
    slot: 'slotFade',
    panelTitle: 'panelCrossfade',
    page: 'fade',
    clock: 'clockFade',
    now: 'nowNone',
    connector: 'connectorFade',
    background: 'bgStatic',
    overlay: 'overlayFade',
  },
};

// ---------- kinetic: back/elastic, лёгкие вращения ----------

const kinetic: MotionTheme = {
  name: 'kinetic',
  description: 'Ease-out-back/elastic, лёгкие вращения ±3°, ~500ms.',
  speed: 1,
  targets: {
    island: 'dominoWave',
    lesson: 'scaleIn',
    slot: 'slotPop',
    panelTitle: 'panelSlide',
    page: 'elastic',
    clock: 'clockTick',
    now: 'nowPulse',
    connector: 'connectorDraw',
    background: 'bgDrift',
    overlay: 'overlayFade',
  },
};

// ---------- editorial: reveal через clip-path ----------

const editorial: MotionTheme = {
  name: 'editorial',
  description: 'Reveal через clip-path, 700–900ms. Книжный, journal-стиль.',
  speed: 0.9,
  targets: {
    island: 'tiltIn',
    lesson: 'curtain',
    slot: 'slotFade',
    panelTitle: 'panelFadeUp',
    page: 'reveal',
    clock: 'clockFade',
    now: 'nowPulse',
    connector: 'connectorDraw',
    background: 'bgStatic',
    overlay: 'overlayFade',
  },
};

// ---------- Registry ----------

export const THEMES: Record<string, MotionTheme> = {
  default: defaultTheme,
  'apple-tv': appleTv,
  'linear-crisp': linearCrisp,
  paper,
  neon,
  minimal,
  kinetic,
  editorial,
};

/** Список имён — экспортируется для отладки/тестов/UI. */
export const THEME_NAMES = Object.keys(THEMES);
