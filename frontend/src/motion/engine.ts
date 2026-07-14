// =============================================================================
// Motion Engine v4 — Core
// -----------------------------------------------------------------------------
// Задачи файла:
//   1. resolveTheme(config)  — свернуть глобальный AppConfig → ResolvedMotion.
//   2. getMotion(target,phase,ctx) — вернуть Svelte TransitionConfig,
//      учитывающий тему, override, quality-level и stagger.
//   3. motion(node, params) — Svelte-совместимая транзишен-функция,
//      которую можно использовать как in:motion / out:motion.
//
// Приоритет разрешения (сверху вниз):
//   1. Явное переопределение (motion.overrides.<target>.<phase>)
//   2. profile.overrides.<phase> (то же по сути, но подготовленное)
//   3. Пресет элемента (motion.presets[target] или profile.preset)
//   4. Пресет активной темы
//   5. Пресет темы-родителя (extends)
//   6. Fallback: default-тема
// =============================================================================

import { capability, applyQualityFilter } from './capability';
import { resolveEasing, easeOutCubic } from './easings';
import { computeStagger } from './stagger';
import { PRESETS } from './presets';
import { THEMES } from './themes';
import type {
  AnimPhase,
  AnimTarget,
  ElementProfile,
  MotionContext,
  MotionSpec,
  MotionState,
  MotionTheme,
  QualityLevel,
  ResolvedMotion,
  TransitionConfig,
} from './types';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let RESOLVED: ResolvedMotion = buildDefaultResolved();

function buildDefaultResolved(): ResolvedMotion {
  return {
    enabled: true,
    themeName: 'default',
    speed: 1,
    respectReducedMotion: true,
    performanceGuard: 'auto',
    fpsThresholds: { full: 55, balanced: 40, low: 25 },
    profiles: {},
    presets: { ...PRESETS },
  };
}

// ---------------------------------------------------------------------------
// resolveTheme
// ---------------------------------------------------------------------------

interface AppMotionSection {
  enabled?: boolean;
  theme?: string;
  speed?: number;
  respect_reduced_motion?: boolean;
  performance_guard?: 'off' | 'auto' | 'aggressive';
  fps_thresholds?: { full?: number; balanced?: number; low?: number };
  /** { target: presetName } */
  presets?: Partial<Record<AnimTarget, string>>;
  /** { target: { phase: MotionSpec } } */
  overrides?: Partial<Record<AnimTarget, Partial<Record<AnimPhase, MotionSpec>>>>;
  /** Пер-целевые блоки типа { island: { preset, duration, stagger } } */
  targets?: Partial<Record<AnimTarget, ElementProfile>>;
}

interface AppConfigLike {
  motion?: AppMotionSection;
  display?: {
    /** Legacy — page_animation используется если motion.theme не задан. */
    page_animation?: string;
    page_animation_ms?: number;
    micro_anim_ms?: number;
    fancy_animations?: boolean;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/**
 * Собрать финальную ResolvedMotion.
 *
 * Возвращаемый объект также сохраняется в модульном состоянии — все
 * последующие вызовы getMotion/getFlip будут использовать его.
 */
export function resolveTheme(config: AppConfigLike | null | undefined): ResolvedMotion {
  const motionCfg: AppMotionSection = (config?.motion ?? {}) as AppMotionSection;
  const displayCfg = config?.display ?? {};

  // Определяем базовую тему.
  const themeName = motionCfg.theme && THEMES[motionCfg.theme] ? motionCfg.theme : 'default';
  const theme = THEMES[themeName] ?? THEMES.default;

  // Наследование
  const parentName = theme.extends;
  const parent = parentName && THEMES[parentName] ? THEMES[parentName] : null;

  const enabled = motionCfg.enabled !== false && displayCfg.fancy_animations !== false;
  const speed = clamp(Number(motionCfg.speed ?? theme.speed ?? 1), 0.25, 4);
  const respect = motionCfg.respect_reduced_motion !== false;
  const guard = motionCfg.performance_guard ?? 'auto';

  const fpsThresholds = {
    full: Number(motionCfg.fps_thresholds?.full ?? 55),
    balanced: Number(motionCfg.fps_thresholds?.balanced ?? 40),
    low: Number(motionCfg.fps_thresholds?.low ?? 25),
  };

  // Собираем per-target profile.
  const profiles: Partial<Record<AnimTarget, ElementProfile>> = {};

  const allTargets: AnimTarget[] = [
    'island',
    'lesson',
    'slot',
    'panelTitle',
    'page',
    'clock',
    'now',
    'connector',
    'background',
    'overlay',
  ];

  for (const target of allTargets) {
    const themePreset = theme.targets[target];
    const parentPreset = parent?.targets[target];
    const defaultPreset = THEMES.default.targets[target];

    // Приоритет пресета: motion.presets.<target> > profile из motion.targets.<target>.preset >
    //                    theme > parent > default
    const explicit = motionCfg.presets?.[target];
    const profile = motionCfg.targets?.[target] ?? {};

    // Legacy для page: если пользователь оставил старое поле display.page_animation
    // и не задал motion.theme — используем именно его.
    let legacyPagePreset: string | undefined;
    if (target === 'page' && !motionCfg.theme && typeof displayCfg.page_animation === 'string') {
      legacyPagePreset = displayCfg.page_animation;
    }

    const preset =
      explicit ??
      profile.preset ??
      themePreset ??
      legacyPagePreset ??
      parentPreset ??
      defaultPreset ??
      'fade';

    // Legacy для page: длительность из display.page_animation_ms
    let legacyDuration: number | undefined;
    if (target === 'page' && !profile.duration && typeof displayCfg.page_animation_ms === 'number') {
      legacyDuration = displayCfg.page_animation_ms;
    }

    profiles[target] = {
      preset,
      duration: profile.duration ?? legacyDuration,
      delay: profile.delay,
      easing: profile.easing,
      stagger: profile.stagger,
      overrides: motionCfg.overrides?.[target],
    };
  }

  RESOLVED = {
    enabled,
    themeName,
    speed,
    respectReducedMotion: respect,
    performanceGuard: guard,
    fpsThresholds,
    profiles,
    presets: { ...PRESETS }, // на будущее — сюда можно вливать пользовательские пресеты
  };

  // Подписываем capability
  capability.configure(RESOLVED);

  // Диагностика — однократно при каждом resolveTheme. Помогает понять на киоске, подхватилась ли тема.
  try {
    if (typeof console !== 'undefined' && typeof console.info === 'function') {
      console.info(
        `[motion] theme="${themeName}" enabled=${enabled} speed=${speed} guard=${guard} ` +
        `fps={full:${fpsThresholds.full},bal:${fpsThresholds.balanced},low:${fpsThresholds.low}}`,
      );
    }
  } catch (_e) {
    /* no-op */
  }

  return RESOLVED;
}

/** Экспортируется для тестов и devtools. */
export function currentResolved(): ResolvedMotion {
  return RESOLVED;
}

// ---------------------------------------------------------------------------
// getMotion — публичный API
// ---------------------------------------------------------------------------

/**
 * Основная функция — возвращает Svelte TransitionConfig.
 *
 * @param target — какая цель (island, lesson, page…)
 * @param phase  — enter/exit/move/idle/emphasis/dataChange
 * @param ctx    — контекст (index/total/kind/side/now)
 */
export function getMotion(
  target: AnimTarget,
  phase: AnimPhase,
  ctx: MotionContext = {},
): TransitionConfig {
  const resolved = RESOLVED;
  const quality: QualityLevel = capability.current.level;

  // Motion выключен глобально → мгновенный переход.
  if (!resolved.enabled || quality === 'off') {
    return { duration: 0, easing: easeOutCubic, css: () => '' };
  }

  const spec = pickSpec(target, phase, ctx);
  if (!spec) {
    warnMissing(target, phase);
    return { duration: 0, easing: easeOutCubic, css: () => '' };
  }

  // Применяем quality-фильтр (blur/3D деградация)
  const filtered = applyQualityFilter(spec, quality) ?? spec;

  // Вычисляем эффективную длительность/задержку.
  const speed = Math.max(0.001, resolved.speed);
  const duration = Math.max(0, Math.round((filtered.duration ?? 400) / speed));
  const staggerDelay = computeStagger(filtered, ctx.index ?? 0, ctx.total ?? 1);
  const delay = Math.max(0, Math.round((filtered.delay ?? 0) + staggerDelay));

  const easing = resolveEasing(filtered.easing);
  const from = filtered.from ?? {};
  const to = filtered.to ?? {};

  return {
    delay,
    duration,
    easing,
    css: (t: number) => interpolateCss(from, to, t, ctx),
  };
}

// ---------------------------------------------------------------------------
// Разрешение спецификации
// ---------------------------------------------------------------------------

function pickSpec(
  target: AnimTarget,
  phase: AnimPhase,
  ctx: MotionContext,
): MotionSpec | null {
  const profile = RESOLVED.profiles[target];

  // 1. Явные overrides (наивысший приоритет)
  const explicit = profile?.overrides?.[phase];
  if (explicit) return mergeSpec(explicit, profile, ctx);

  // 2. Пресет профиля
  const presetName = profile?.preset;
  const preset = presetName ? RESOLVED.presets[presetName] : undefined;
  const fromPreset = preset?.[phase];
  if (fromPreset) return mergeSpec(fromPreset, profile, ctx);

  // 3. Тема
  const themeName = RESOLVED.themeName;
  const theme: MotionTheme | undefined = THEMES[themeName];
  const themePresetName = theme?.targets[target];
  const themePreset = themePresetName ? RESOLVED.presets[themePresetName] : undefined;
  const fromTheme = themePreset?.[phase];
  if (fromTheme) return mergeSpec(fromTheme, profile, ctx);

  // 4. Наследование
  if (theme?.extends) {
    const parent = THEMES[theme.extends];
    const parentPresetName = parent?.targets[target];
    const parentPreset = parentPresetName ? RESOLVED.presets[parentPresetName] : undefined;
    const fromParent = parentPreset?.[phase];
    if (fromParent) return mergeSpec(fromParent, profile, ctx);
  }

  // 5. Default-тема как fallback
  if (themeName !== 'default') {
    const def = THEMES.default;
    const defPresetName = def.targets[target];
    const defPreset = defPresetName ? RESOLVED.presets[defPresetName] : undefined;
    const fromDef = defPreset?.[phase];
    if (fromDef) return mergeSpec(fromDef, profile, ctx);
  }

  return null;
}

function mergeSpec(
  base: MotionSpec,
  profile: ElementProfile | undefined,
  _ctx: MotionContext,
): MotionSpec {
  if (!profile) return base;
  const out: MotionSpec = { ...base };
  if (typeof profile.duration === 'number') out.duration = profile.duration;
  if (typeof profile.delay === 'number') out.delay = profile.delay;
  if (profile.easing) out.easing = profile.easing;
  if (profile.stagger) out.stagger = { ...(base.stagger ?? {}), ...profile.stagger };
  return out;
}

// ---------------------------------------------------------------------------
// Интерполяция состояния → CSS
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Интерполяция двух MotionState → CSS transform+opacity+filter.
 * Замечание: направление in/out учитывается вызывающим кодом. Мы получаем
 * t: 0→1 в обе стороны (Svelte для out тоже подаёт 1→0, а мы читаем как u).
 *
 * ВАЖНО: css-функция вызывается на каждом кадре, поэтому она максимально
 * плоская — минимум аллокаций строк.
 */
function interpolateCss(
  from: MotionState,
  to: MotionState,
  t: number,
  ctx: MotionContext,
): string {
  const parts: string[] = [];

  // ---- transform ----
  const trParts: string[] = [];
  const x = maybeLerp(from.x, to.x, t);
  const y = maybeLerp(from.y, to.y, t);
  const z = maybeLerp(from.z, to.z, t);
  if (x != null || y != null || z != null) {
    if (z != null) {
      trParts.push(`translate3d(${x ?? 0}px, ${y ?? 0}px, ${z}px)`);
    } else if (x != null && y != null) {
      trParts.push(`translate(${x}px, ${y}px)`);
    } else if (x != null) {
      trParts.push(`translateX(${x}px)`);
    } else if (y != null) {
      trParts.push(`translateY(${y}px)`);
    }
  }

  const rx = maybeLerp(from.rotateX, to.rotateX, t);
  const ry = maybeLerp(from.rotateY, to.rotateY, t);
  if (rx != null || ry != null) {
    // Perspective нужен для 3D.
    parts.push('transform-style: preserve-3d');
    if (rx != null) trParts.unshift('perspective(1000px)');
    if (rx != null) trParts.push(`rotateX(${rx}deg)`);
    if (ry != null) trParts.push(`rotateY(${ry}deg)`);
  }

  const rot = maybeLerp(from.rotate, to.rotate, t);
  if (rot != null) trParts.push(`rotate(${rot}deg)`);

  const skewX = maybeLerp(from.skewX, to.skewX, t);
  if (skewX != null) trParts.push(`skewX(${skewX}deg)`);
  const skewY = maybeLerp(from.skewY, to.skewY, t);
  if (skewY != null) trParts.push(`skewY(${skewY}deg)`);

  const scale = maybeLerp(from.scale, to.scale, t);
  const sx = maybeLerp(from.scaleX, to.scaleX, t);
  const sy = maybeLerp(from.scaleY, to.scaleY, t);
  if (scale != null) trParts.push(`scale(${scale})`);
  else if (sx != null || sy != null) {
    trParts.push(`scale(${sx ?? 1}, ${sy ?? 1})`);
  }

  if (trParts.length) parts.push(`transform: ${trParts.join(' ')}`);

  // ---- opacity ----
  const op = maybeLerp(from.opacity, to.opacity, t);
  if (op != null) parts.push(`opacity: ${op}`);

  // ---- filter ----
  const blur = maybeLerp(from.blur, to.blur, t);
  const sat = maybeLerp(from.saturate, to.saturate, t);
  const bri = maybeLerp(from.brightness, to.brightness, t);
  const filterParts: string[] = [];
  if (blur != null && blur > 0.01) filterParts.push(`blur(${blur}px)`);
  if (sat != null) filterParts.push(`saturate(${sat})`);
  if (bri != null) filterParts.push(`brightness(${bri})`);
  if (filterParts.length) parts.push(`filter: ${filterParts.join(' ')}`);

  // ---- clip-path ----
  const clip = maybeLerpVec4(from.clipInset, to.clipInset, t);
  if (clip) {
    parts.push(`clip-path: inset(${clip[0]}% ${clip[1]}% ${clip[2]}% ${clip[3]}%)`);
  }

  // ---- side direction hint (для panelTitle) ----
  if (ctx.side && (x == null && y == null)) {
    // Автоматический сдвиг ±20px если не задан явный x/y
    const sign = ctx.side === 'right' ? 1 : -1;
    const dx = sign * (1 - t) * 20;
    parts.push(`transform: translateX(${dx}px)`);
  }

  // ---- raw override ----
  if (to.raw) parts.push(to.raw);

  return parts.join('; ');
}

function maybeLerp(a: number | undefined, b: number | undefined, t: number): number | null {
  if (a == null && b == null) return null;
  const av = a ?? b ?? 0;
  const bv = b ?? a ?? 0;
  return lerp(av, bv, t);
}

function maybeLerpVec4(
  a: [number, number, number, number] | undefined,
  b: [number, number, number, number] | undefined,
  t: number,
): [number, number, number, number] | null {
  if (!a && !b) return null;
  const av = a ?? b ?? [0, 0, 0, 0];
  const bv = b ?? a ?? [0, 0, 0, 0];
  return [lerp(av[0], bv[0], t), lerp(av[1], bv[1], t), lerp(av[2], bv[2], t), lerp(av[3], bv[3], t)];
}

// ---------------------------------------------------------------------------
// Svelte-совместимая transition-функция
// ---------------------------------------------------------------------------

export interface MotionParams {
  target: AnimTarget;
  phase: AnimPhase;
  index?: number;
  total?: number;
  kind?: MotionContext['kind'];
  side?: MotionContext['side'];
  now?: boolean;
  /** Полный override поверх всего. */
  spec?: MotionSpec;
}

/**
 * Использование:
 *   <div in:motion={{ target: 'island', phase: 'enter', index }}>
 *   <div out:motion={{ target: 'island', phase: 'exit', index }}>
 */
export function motion(_node: Element, params: MotionParams): TransitionConfig {
  const cfg = getMotion(params.target, params.phase, {
    index: params.index,
    total: params.total,
    kind: params.kind,
    now: params.now,
    side: params.side,
  });
  return cfg;
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

// -----------------------------------------------------------------------------
// warnMissing (одноразово на каждую (target,phase)) — упрощает отладку.
// -----------------------------------------------------------------------------
const _warned = new Set<string>();
function warnMissing(target: AnimTarget, phase: AnimPhase): void {
  const key = `${target}:${phase}`;
  if (_warned.has(key)) return;
  _warned.add(key);
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(
      `[motion] no preset for target="${target}" phase="${phase}" ` +
      `(theme="${RESOLVED.themeName}") — transition will be instant`,
    );
  }
}

// Инициализация: применяем capability под defaults, чтобы reduced-motion учитывался
// даже до первого resolveTheme.
capability.configure(RESOLVED);
