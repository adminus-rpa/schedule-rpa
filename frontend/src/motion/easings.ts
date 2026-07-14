// =============================================================================
// Motion Engine v4 — Easings
// -----------------------------------------------------------------------------
// Полный набор easing-функций, необходимый для тем apple-tv, linear-crisp,
// paper, neon, kinetic, editorial, minimal. Все функции — pure и cheap
// (без выделения памяти), пригодны для 60/120 fps-цикла Svelte transitions.
// =============================================================================

import type { EasingFn, EasingSpec } from './types';

// ---- Базовые ----

export const linear: EasingFn = (t) => t;

export const easeInCubic: EasingFn = (t) => t * t * t;
export const easeOutCubic: EasingFn = (t) => {
  const u = 1 - t;
  return 1 - u * u * u;
};
export const easeInOutCubic: EasingFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutQuart: EasingFn = (t) => 1 - Math.pow(1 - t, 4);
export const easeOutQuint: EasingFn = (t) => 1 - Math.pow(1 - t, 5);

export const easeOutExpo: EasingFn = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutExpo: EasingFn = (t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
};

// ---- Back (лёгкий overshoot) ----

const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;

export const easeInBack: EasingFn = (t) => c3 * t * t * t - c1 * t * t;
export const easeOutBack: EasingFn = (t) =>
  1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
export const easeInOutBack: EasingFn = (t) =>
  t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;

// ---- Elastic ----

export const easeOutElastic: EasingFn = (t) => {
  const c4 = (2 * Math.PI) / 3;
  if (t === 0) return 0;
  if (t === 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

// ---- Bounce ----

export const easeOutBounce: EasingFn = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) {
    const u = t - 1.5 / d1;
    return n1 * u * u + 0.75;
  }
  if (t < 2.5 / d1) {
    const u = t - 2.25 / d1;
    return n1 * u * u + 0.9375;
  }
  const u = t - 2.625 / d1;
  return n1 * u * u + 0.984375;
};

// ---- Cubic-bezier (произвольная) ----

/**
 * Cubic Bezier с точками (x1,y1) и (x2,y2). Обе координаты X монотонно
 * растут — поэтому решаем через Ньютона + бисекцию за <=8 итераций.
 * Возвращает функцию (t) => y.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton (быстрая часть)
    let t = x;
    for (let i = 0; i < 6; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-5) return sampleY(t);
      const d = sampleDerivX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    // Бисекция (запасной путь)
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 12; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-4) return sampleY(t);
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

// ---- Spring ----

/**
 * Аналитическая функция затухающего осциллятора.
 * stiffness = ω0² (жёсткость), damping = ζ (0..∞), mass = m.
 *
 * Возвращает функцию t → нормализованное значение 0..1, где 1 = положение покоя.
 */
export function spring(
  stiffness: number = 170,
  damping: number = 26,
  mass: number = 1,
): EasingFn {
  // Угловая частота собственных колебаний
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  if (zeta < 1) {
    // Underdamped — колебательный
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return (t) => {
      if (t >= 1) return 1;
      const decay = Math.exp(-zeta * w0 * t);
      return 1 - decay * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    };
  }
  // Critically or over-damped — без колебаний
  return (t) => {
    if (t >= 1) return 1;
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
}

/** Мягкая spring — apple-tv style */
export const springSoft: EasingFn = spring(120, 20, 1);
/** Резкая — linear/kinetic style */
export const springSnappy: EasingFn = spring(220, 26, 1);
/** Дефолтная spring */
export const springDefault: EasingFn = spring(170, 24, 1);

// ---- Реестр по имени ----

const REGISTRY: Record<string, EasingFn> = {
  linear,
  'ease-in-cubic': easeInCubic,
  'ease-out-cubic': easeOutCubic,
  'ease-in-out-cubic': easeInOutCubic,
  'ease-out-quart': easeOutQuart,
  'ease-out-quint': easeOutQuint,
  'ease-out-expo': easeOutExpo,
  'ease-in-out-expo': easeInOutExpo,
  'ease-in-back': easeInBack,
  'ease-out-back': easeOutBack,
  'ease-in-out-back': easeInOutBack,
  'ease-out-elastic': easeOutElastic,
  'ease-out-bounce': easeOutBounce,
  spring: springDefault,
  'spring-soft': springSoft,
  'spring-snappy': springSnappy,
};

/**
 * Разрешает EasingSpec (строку или функцию) в EasingFn.
 * Неизвестные имена → easeOutCubic.
 */
export function resolveEasing(spec: EasingSpec | undefined): EasingFn {
  if (!spec) return easeOutCubic;
  if (typeof spec === 'function') return spec;
  const fn = REGISTRY[spec];
  return fn ?? easeOutCubic;
}
