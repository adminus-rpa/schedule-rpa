// =============================================================================
// Motion Engine v4 — Preset Library
// -----------------------------------------------------------------------------
// Все пресеты держим в одном месте — их описания короткие, каждый пресет
// это ~2-6 строк спецификаций. Пресет одинаково применим к любому AnimTarget:
// engine.ts просто читает нужную фазу из MotionPreset.
//
// Категории (для читабельности):
//   ISLAND    — softRise, popIn, drift, fold3d, flare, slideCascade, dominoWave, tiltIn
//   LESSON    — fadeUp, fadeLeft, scaleIn, typewriter, curtain, lessonNone
//   PAGE      — cinematicSlide, pushStack, carousel3d, radialWipe, sectionSlide, elastic
//               + legacy: slide, fade, zoom, flip, cube, stack, reveal, swap, none
//   PANEL     — panelSlide, panelFadeUp, panelCrossfade
//   SLOT      — slotPop, slotFade
//   CLOCK     — clockTick, clockFade
//   NOW       — nowPulse, nowGlow
//   CONNECTOR — connectorDraw, connectorFade
//   BACKGROUND— bgDrift
// =============================================================================

import type { MotionPreset } from '../types';

/** Утилита создания пресета — короче в объявлении. */
function P(name: string, fields: Omit<MotionPreset, 'name'>): MotionPreset {
  return { name, ...fields };
}

// ---------- ISLAND ----------

const softRise = P('softRise', {
  enter: {
    duration: 520,
    easing: 'spring-soft',
    from: { opacity: 0, y: 14, scale: 0.985, blur: 2 },
    to: { opacity: 1, y: 0, scale: 1, blur: 0 },
    stagger: { mode: 'index', step: 45, max: 700 },
  },
  exit: {
    duration: 260,
    easing: 'ease-out-cubic',
    from: { opacity: 1, y: 0, scale: 1 },
    to: { opacity: 0, y: -8, scale: 0.99 },
  },
  move: { duration: 500, easing: 'ease-out-cubic' },
});

const popIn = P('popIn', {
  enter: {
    duration: 460,
    easing: 'ease-out-back',
    from: { opacity: 0, scale: 0.86 },
    to: { opacity: 1, scale: 1 },
    stagger: { mode: 'index', step: 55, max: 700 },
  },
  exit: {
    duration: 220,
    easing: 'ease-out-cubic',
    from: { opacity: 1, scale: 1 },
    to: { opacity: 0, scale: 0.94 },
  },
});

const drift = P('drift', {
  enter: {
    duration: 620,
    easing: 'ease-out-expo',
    from: { opacity: 0, x: -18, blur: 3 },
    to: { opacity: 1, x: 0, blur: 0 },
    stagger: { mode: 'index', step: 60, max: 900 },
  },
  exit: {
    duration: 240,
    easing: 'ease-out-cubic',
    from: { opacity: 1, x: 0 },
    to: { opacity: 0, x: 12 },
  },
});

const fold3d = P('fold3d', {
  enter: {
    duration: 620,
    easing: 'ease-out-cubic',
    from: { opacity: 0, rotateX: -22, y: 12 },
    to: { opacity: 1, rotateX: 0, y: 0 },
    stagger: { mode: 'index', step: 50, max: 700 },
  },
  exit: {
    duration: 260,
    easing: 'ease-out-cubic',
    from: { opacity: 1, rotateX: 0 },
    to: { opacity: 0, rotateX: 18 },
  },
});

const flare = P('flare', {
  enter: {
    duration: 700,
    easing: 'spring-soft',
    from: { opacity: 0, scale: 0.9, blur: 6, saturate: 0.6 },
    to: { opacity: 1, scale: 1, blur: 0, saturate: 1 },
    stagger: { mode: 'index', step: 60, max: 900 },
  },
  exit: {
    duration: 240,
    easing: 'ease-out-cubic',
    from: { opacity: 1, scale: 1 },
    to: { opacity: 0, scale: 0.96 },
  },
  idle: {
    duration: 2400,
    easing: 'ease-in-out-cubic',
    from: { opacity: 1 },
    to: { opacity: 0.92 },
  },
});

const slideCascade = P('slideCascade', {
  enter: {
    duration: 520,
    easing: 'ease-out-quart',
    from: { opacity: 0, y: 22 },
    to: { opacity: 1, y: 0 },
    stagger: { mode: 'index', step: 65, max: 900 },
  },
  exit: {
    duration: 220,
    easing: 'ease-out-cubic',
    from: { opacity: 1, y: 0 },
    to: { opacity: 0, y: -12 },
  },
});

const dominoWave = P('dominoWave', {
  enter: {
    duration: 560,
    easing: 'ease-out-back',
    from: { opacity: 0, y: 30, rotate: -3 },
    to: { opacity: 1, y: 0, rotate: 0 },
    stagger: { mode: 'wave', step: 60, max: 900 },
  },
  exit: {
    duration: 220,
    easing: 'ease-out-cubic',
    from: { opacity: 1, y: 0, rotate: 0 },
    to: { opacity: 0, y: -14, rotate: 2 },
  },
});

const tiltIn = P('tiltIn', {
  enter: {
    duration: 520,
    easing: 'ease-out-back',
    from: { opacity: 0, rotate: -2, y: 10, scale: 0.98 },
    to: { opacity: 1, rotate: 0, y: 0, scale: 1 },
    stagger: { mode: 'index', step: 50, max: 800 },
  },
  exit: {
    duration: 220,
    easing: 'ease-out-cubic',
    from: { opacity: 1, rotate: 0 },
    to: { opacity: 0, rotate: 2 },
  },
});

// ---------- LESSON ----------

const fadeUp = P('fadeUp', {
  enter: {
    duration: 360,
    easing: 'ease-out-quart',
    from: { opacity: 0, y: 8 },
    to: { opacity: 1, y: 0 },
    stagger: { mode: 'index', step: 25, max: 300 },
  },
  exit: {
    duration: 180,
    easing: 'ease-out-cubic',
    from: { opacity: 1, y: 0 },
    to: { opacity: 0, y: -6 },
  },
  dataChange: {
    duration: 280,
    easing: 'ease-out-cubic',
    from: { opacity: 0, y: 6 },
    to: { opacity: 1, y: 0 },
  },
});

const fadeLeft = P('fadeLeft', {
  enter: {
    duration: 360,
    easing: 'ease-out-quart',
    from: { opacity: 0, x: -10 },
    to: { opacity: 1, x: 0 },
    stagger: { mode: 'index', step: 25, max: 300 },
  },
  exit: {
    duration: 180,
    easing: 'ease-out-cubic',
    from: { opacity: 1, x: 0 },
    to: { opacity: 0, x: 8 },
  },
});

const scaleIn = P('scaleIn', {
  enter: {
    duration: 380,
    easing: 'ease-out-back',
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1 },
    stagger: { mode: 'index', step: 25, max: 300 },
  },
  exit: {
    duration: 180,
    easing: 'ease-out-cubic',
    from: { opacity: 1, scale: 1 },
    to: { opacity: 0, scale: 0.94 },
  },
});

const typewriter = P('typewriter', {
  enter: {
    duration: 420,
    easing: 'ease-out-cubic',
    from: { opacity: 0, clipInset: [0, 100, 0, 0] },
    to: { opacity: 1, clipInset: [0, 0, 0, 0] },
    stagger: { mode: 'index', step: 30, max: 400 },
  },
  exit: {
    duration: 200,
    easing: 'ease-out-cubic',
    from: { opacity: 1 },
    to: { opacity: 0 },
  },
});

const curtain = P('curtain', {
  enter: {
    duration: 480,
    easing: 'ease-out-quart',
    from: { opacity: 0, clipInset: [50, 0, 50, 0] },
    to: { opacity: 1, clipInset: [0, 0, 0, 0] },
    stagger: { mode: 'index', step: 30, max: 400 },
  },
  exit: {
    duration: 220,
    easing: 'ease-out-cubic',
    from: { opacity: 1 },
    to: { opacity: 0, clipInset: [50, 0, 50, 0] },
  },
});

const lessonNone = P('lessonNone', {
  enter: { duration: 0, from: { opacity: 1 }, to: { opacity: 1 } },
  exit: { duration: 0, from: { opacity: 1 }, to: { opacity: 1 } },
});

// ---------- PAGE ----------

const cinematicSlide = P('cinematicSlide', {
  enter: {
    duration: 640,
    easing: 'ease-out-expo',
    from: { opacity: 0, x: 60, scale: 0.98 },
    to: { opacity: 1, x: 0, scale: 1 },
  },
  exit: {
    duration: 460,
    easing: 'ease-out-cubic',
    from: { opacity: 1, x: 0, scale: 1 },
    to: { opacity: 0, x: -40, scale: 0.98 },
  },
});

const pushStack = P('pushStack', {
  enter: {
    duration: 620,
    easing: 'ease-out-quart',
    from: { opacity: 0, y: 40, scale: 0.97 },
    to: { opacity: 1, y: 0, scale: 1 },
  },
  exit: {
    duration: 420,
    easing: 'ease-out-cubic',
    from: { opacity: 1, y: 0, scale: 1 },
    to: { opacity: 0, y: -24, scale: 0.98 },
  },
});

const carousel3d = P('carousel3d', {
  enter: {
    duration: 760,
    easing: 'ease-out-cubic',
    from: { opacity: 0, rotateY: 42, x: 60 },
    to: { opacity: 1, rotateY: 0, x: 0 },
  },
  exit: {
    duration: 480,
    easing: 'ease-out-cubic',
    from: { opacity: 1, rotateY: 0, x: 0 },
    to: { opacity: 0, rotateY: -42, x: -60 },
  },
});

const radialWipe = P('radialWipe', {
  enter: {
    duration: 700,
    easing: 'ease-out-cubic',
    from: { opacity: 0, clipInset: [50, 50, 50, 50], scale: 1.02 },
    to: { opacity: 1, clipInset: [0, 0, 0, 0], scale: 1 },
  },
  exit: {
    duration: 420,
    easing: 'ease-out-cubic',
    from: { opacity: 1, clipInset: [0, 0, 0, 0] },
    to: { opacity: 0, clipInset: [50, 50, 50, 50] },
  },
});

const sectionSlide = P('sectionSlide', {
  enter: {
    duration: 540,
    easing: 'ease-out-quart',
    from: { opacity: 0, x: 36 },
    to: { opacity: 1, x: 0 },
  },
  exit: {
    duration: 360,
    easing: 'ease-out-cubic',
    from: { opacity: 1, x: 0 },
    to: { opacity: 0, x: -24 },
  },
});

const elastic = P('elastic', {
  enter: {
    duration: 820,
    easing: 'ease-out-elastic',
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1 },
  },
  exit: {
    duration: 380,
    easing: 'ease-out-cubic',
    from: { opacity: 1, scale: 1 },
    to: { opacity: 0, scale: 0.96 },
  },
});

// ---- Legacy page presets ----

const legacySlide = P('slide', {
  enter: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 0, x: 24 },
    to: { opacity: 1, x: 0 },
  },
  exit: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 1, x: 0 },
    to: { opacity: 0, x: -24 },
  },
});

const legacyFade = P('fade', {
  enter: { duration: 500, easing: 'ease-out-cubic', from: { opacity: 0 }, to: { opacity: 1 } },
  exit: { duration: 500, easing: 'ease-out-cubic', from: { opacity: 1 }, to: { opacity: 0 } },
});

const legacyZoom = P('zoom', {
  enter: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 0, scale: 0.94 },
    to: { opacity: 1, scale: 1 },
  },
  exit: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 1, scale: 1 },
    to: { opacity: 0, scale: 0.94 },
  },
});

const legacyFlip = P('flip', {
  enter: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 0, rotateY: -22 },
    to: { opacity: 1, rotateY: 0 },
  },
  exit: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 1, rotateY: 0 },
    to: { opacity: 0, rotateY: 22 },
  },
});

const legacyCube = P('cube', {
  enter: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 0.4, rotateY: -60 },
    to: { opacity: 1, rotateY: 0 },
  },
  exit: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 1, rotateY: 0 },
    to: { opacity: 0.4, rotateY: 60 },
  },
});

const legacyStack = P('stack', {
  enter: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 0, y: 20, scale: 0.96 },
    to: { opacity: 1, y: 0, scale: 1 },
  },
  exit: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 1, y: 0, scale: 1 },
    to: { opacity: 0, y: -20, scale: 0.96 },
  },
});

const legacyReveal = P('reveal', {
  enter: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 0, clipInset: [0, 100, 0, 0] },
    to: { opacity: 1, clipInset: [0, 0, 0, 0] },
  },
  exit: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 1, clipInset: [0, 0, 0, 0] },
    to: { opacity: 0, clipInset: [0, 100, 0, 0] },
  },
});

const legacySwap = P('swap', {
  enter: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 0, y: 12, scale: 0.98 },
    to: { opacity: 1, y: 0, scale: 1 },
  },
  exit: {
    duration: 500,
    easing: 'ease-out-cubic',
    from: { opacity: 1, y: 0, scale: 1 },
    to: { opacity: 0, y: -12, scale: 0.98 },
  },
});

const legacyNone = P('none', {
  enter: { duration: 0, from: { opacity: 1 }, to: { opacity: 1 } },
  exit: { duration: 0, from: { opacity: 1 }, to: { opacity: 1 } },
});

// ---------- PANEL TITLE ----------

const panelSlide = P('panelSlide', {
  enter: {
    duration: 420,
    easing: 'ease-out-cubic',
    from: { opacity: 0, x: 30 },
    to: { opacity: 1, x: 0 },
  },
  exit: {
    duration: 420,
    easing: 'ease-out-cubic',
    from: { opacity: 1, x: 0 },
    to: { opacity: 0, x: -30 },
  },
});

const panelFadeUp = P('panelFadeUp', {
  enter: {
    duration: 380,
    easing: 'ease-out-quart',
    from: { opacity: 0, y: 8 },
    to: { opacity: 1, y: 0 },
  },
  exit: {
    duration: 260,
    easing: 'ease-out-cubic',
    from: { opacity: 1, y: 0 },
    to: { opacity: 0, y: -6 },
  },
});

const panelCrossfade = P('panelCrossfade', {
  enter: { duration: 380, easing: 'ease-out-cubic', from: { opacity: 0 }, to: { opacity: 1 } },
  exit: { duration: 260, easing: 'ease-out-cubic', from: { opacity: 1 }, to: { opacity: 0 } },
});

// ---------- SLOT ----------

const slotPop = P('slotPop', {
  enter: {
    duration: 380,
    easing: 'ease-out-back',
    from: { opacity: 0, y: 6, scale: 0.94 },
    to: { opacity: 1, y: 0, scale: 1 },
    stagger: { mode: 'index', step: 40, max: 400 },
  },
  exit: {
    duration: 180,
    easing: 'ease-out-cubic',
    from: { opacity: 1 },
    to: { opacity: 0 },
  },
  emphasis: {
    duration: 900,
    easing: 'ease-in-out-cubic',
    from: { scale: 1 },
    to: { scale: 1.03 },
  },
});

const slotFade = P('slotFade', {
  enter: {
    duration: 300,
    easing: 'ease-out-cubic',
    from: { opacity: 0 },
    to: { opacity: 1 },
    stagger: { mode: 'index', step: 30, max: 300 },
  },
  exit: { duration: 180, easing: 'ease-out-cubic', from: { opacity: 1 }, to: { opacity: 0 } },
});

// ---------- CLOCK ----------

const clockTick = P('clockTick', {
  dataChange: {
    duration: 320,
    easing: 'ease-out-back',
    from: { opacity: 0, y: 8 },
    to: { opacity: 1, y: 0 },
  },
});

const clockFade = P('clockFade', {
  dataChange: {
    duration: 240,
    easing: 'ease-out-cubic',
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
});

// ---------- NOW ----------

const nowPulse = P('nowPulse', {
  idle: {
    duration: 1800,
    easing: 'ease-in-out-cubic',
    from: { scale: 1, opacity: 1 },
    to: { scale: 1.02, opacity: 0.94 },
  },
  emphasis: {
    duration: 900,
    easing: 'ease-out-back',
    from: { scale: 0.98, opacity: 0.9 },
    to: { scale: 1, opacity: 1 },
  },
});

const nowGlow = P('nowGlow', {
  idle: {
    duration: 2200,
    easing: 'ease-in-out-cubic',
    from: { brightness: 1 },
    to: { brightness: 1.08 },
  },
});

const nowNone = P('nowNone', {
  idle: { duration: 0, from: { opacity: 1 }, to: { opacity: 1 } },
});

// ---------- CONNECTOR ----------

const connectorDraw = P('connectorDraw', {
  enter: {
    duration: 480,
    easing: 'ease-out-cubic',
    from: { opacity: 0, scaleY: 0 },
    to: { opacity: 1, scaleY: 1 },
    stagger: { mode: 'index', step: 40, max: 320 },
  },
  exit: {
    duration: 180,
    easing: 'ease-out-cubic',
    from: { opacity: 1, scaleY: 1 },
    to: { opacity: 0, scaleY: 0 },
  },
});

const connectorFade = P('connectorFade', {
  enter: {
    duration: 300,
    easing: 'ease-out-cubic',
    from: { opacity: 0 },
    to: { opacity: 1 },
    stagger: { mode: 'index', step: 30, max: 240 },
  },
  exit: { duration: 180, easing: 'ease-out-cubic', from: { opacity: 1 }, to: { opacity: 0 } },
});

// ---------- BACKGROUND ----------

const bgDrift = P('bgDrift', {
  idle: {
    duration: 12000,
    easing: 'ease-in-out-cubic',
    from: { x: -10, y: -10 },
    to: { x: 10, y: 10 },
  },
});

const bgStatic = P('bgStatic', {
  idle: { duration: 0, from: { opacity: 1 }, to: { opacity: 1 } },
});

// ---------- OVERLAY ----------

const overlayFade = P('overlayFade', {
  enter: {
    duration: 260,
    easing: 'ease-out-cubic',
    from: { opacity: 0, blur: 8 },
    to: { opacity: 1, blur: 0 },
  },
  exit: {
    duration: 200,
    easing: 'ease-out-cubic',
    from: { opacity: 1 },
    to: { opacity: 0 },
  },
});

// ---------- EXPORT ----------

export const PRESETS: Record<string, MotionPreset> = {
  // Island
  softRise,
  popIn,
  drift,
  fold3d,
  flare,
  slideCascade,
  dominoWave,
  tiltIn,
  // Lesson
  fadeUp,
  fadeLeft,
  scaleIn,
  typewriter,
  curtain,
  lessonNone,
  // Page (modern)
  cinematicSlide,
  pushStack,
  carousel3d,
  radialWipe,
  sectionSlide,
  elastic,
  // Page (legacy — for backward compatibility)
  slide: legacySlide,
  fade: legacyFade,
  zoom: legacyZoom,
  flip: legacyFlip,
  cube: legacyCube,
  stack: legacyStack,
  reveal: legacyReveal,
  swap: legacySwap,
  none: legacyNone,
  // Panel
  panelSlide,
  panelFadeUp,
  panelCrossfade,
  // Slot
  slotPop,
  slotFade,
  // Clock
  clockTick,
  clockFade,
  // Now
  nowPulse,
  nowGlow,
  nowNone,
  // Connector
  connectorDraw,
  connectorFade,
  // Background
  bgDrift,
  bgStatic,
  // Overlay
  overlayFade,
};
