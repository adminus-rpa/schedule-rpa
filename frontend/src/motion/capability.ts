// =============================================================================
// Motion Engine v4 — Capability & Performance Guard
// -----------------------------------------------------------------------------
// Отслеживает окружение (reduced-motion, FPS, battery, hidden tab) и
// поддерживает актуальный QualityState. Компоненты подписываются на изменения
// через subscribe() (без внешних зависимостей).
// =============================================================================

import type { QualityLevel, QualityState, ResolvedMotion } from './types';

type Listener = (state: QualityState) => void;

class CapabilityService {
  state: QualityState = {
    level: 'full',
    fps: 60,
    reducedMotion: false,
    batteryLow: false,
    hidden: false,
  };

  private listeners = new Set<Listener>();
  private fpsThresholds = { full: 55, balanced: 40, low: 25 };
  private guard: 'off' | 'auto' | 'aggressive' = 'auto';
  private respectReducedMotion = true;
  /** true, пока FPS-семплер не накопил хотя бы 1 надёжный замер. */
  private fpsWarming = true;
  private started = false;
  private lastFrameTs = 0;
  private frameCount = 0;
  private lastSampleTs = 0;
  private rafHandle = 0;
  private motionQueryList: MediaQueryList | null = null;
  private mmHandler: ((e: MediaQueryListEvent) => void) | null = null;
  private visHandler: (() => void) | null = null;
  private batteryHandler: (() => void) | null = null;
  private batteryRef: unknown = null;

  /** Инициализация из ResolvedMotion. Идемпотентно. */
  configure(resolved: ResolvedMotion): void {
    this.fpsThresholds = { ...resolved.fpsThresholds };
    this.guard = resolved.performanceGuard;
    this.respectReducedMotion = resolved.respectReducedMotion;
    // Если motion отключён глобально — форсим off.
    if (!resolved.enabled) {
      this.setState({ ...this.state, level: 'off' });
      this.stop();
      return;
    }
    if (!this.started) this.start();
    this.recomputeLevel();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  /** Мгновенное состояние. */
  get current(): QualityState {
    return this.state;
  }

  // ---------- lifecycle ----------

  private start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    // prefers-reduced-motion (в старых kiosk-браузерах может отсутствовать).
    try {
      if (typeof window.matchMedia === 'function') {
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.motionQueryList = mql;
        this.state.reducedMotion = mql.matches;
        this.mmHandler = (e) => {
          this.state.reducedMotion = e.matches;
          this.recomputeLevel();
        };
        if (typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', this.mmHandler);
        } else if (typeof (mql as unknown as { addListener?: (h: (e: MediaQueryListEvent) => void) => void }).addListener === 'function') {
          (mql as unknown as { addListener: (h: (e: MediaQueryListEvent) => void) => void }).addListener(this.mmHandler);
        }
      } else {
        this.state.reducedMotion = false;
      }
    } catch (_e) {
      this.state.reducedMotion = false;
    }

    // visibility
    this.visHandler = () => {
      this.state.hidden = document.hidden;
      if (document.hidden) {
        // На скрытой вкладке приостанавливаем FPS-замер (rAF всё равно замирает).
        this.frameCount = 0;
        this.lastSampleTs = 0;
      }
      this.recomputeLevel();
    };
    document.addEventListener('visibilitychange', this.visHandler);
    this.state.hidden = document.hidden;

    // battery
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<unknown>;
    };
    if (typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((batt) => {
          const b = batt as {
            level?: number;
            charging?: boolean;
            addEventListener?: (n: string, h: () => void) => void;
          };
          this.batteryRef = b;
          const update = () => {
            const level = typeof b.level === 'number' ? b.level : 1;
            const charging = b.charging !== false;
            this.state.batteryLow = !charging && level < 0.2;
            this.recomputeLevel();
          };
          this.batteryHandler = update;
          update();
          b.addEventListener?.('levelchange', update);
          b.addEventListener?.('chargingchange', update);
        })
        .catch(() => {
          /* not supported */
        });
    }

    // FPS-цикл
    if (this.guard !== 'off') {
      this.startFpsSampling();
    }
  }

  private stop(): void {
    if (!this.started) return;
    if (this.rafHandle && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = 0;
    }
    if (this.motionQueryList && this.mmHandler) {
      if (typeof this.motionQueryList.removeEventListener === 'function') {
        this.motionQueryList.removeEventListener('change', this.mmHandler);
      }
    }
    if (this.visHandler) {
      document.removeEventListener('visibilitychange', this.visHandler);
    }
    const b = this.batteryRef as {
      removeEventListener?: (n: string, h: () => void) => void;
    } | null;
    if (b && this.batteryHandler) {
      b.removeEventListener?.('levelchange', this.batteryHandler);
      b.removeEventListener?.('chargingchange', this.batteryHandler);
    }
    this.started = false;
  }

  // ---------- FPS ----------

  private startFpsSampling(): void {
    // Замер каждые 1000ms (усреднение по последним кадрам). Порог активной
    // деградации срабатывает если 5 подряд замеров < balanced.
    let lowStreak = 0;
    const step = (ts: number) => {
      this.rafHandle = requestAnimationFrame(step);
      if (this.state.hidden) return;
      if (!this.lastSampleTs) {
        this.lastSampleTs = ts;
        this.lastFrameTs = ts;
        return;
      }
      this.frameCount += 1;
      this.lastFrameTs = ts;
      if (ts - this.lastSampleTs >= 1000) {
        const fps = (this.frameCount * 1000) / (ts - this.lastSampleTs);
        // Экспоненциальное сглаживание
        this.state.fps = 0.7 * this.state.fps + 0.3 * fps;
        this.frameCount = 0;
        this.lastSampleTs = ts;
        // Первый реальный замер получен.
        this.fpsWarming = false;

        // Streak для устойчивой деградации
        if (this.state.fps < this.fpsThresholds.balanced) {
          lowStreak += 1;
        } else {
          lowStreak = 0;
        }
        // На aggressive режиме — деградация после 2 замеров, на auto — после 3.
        const needStreak = this.guard === 'aggressive' ? 2 : 3;
        if (lowStreak >= needStreak || lowStreak === 0) {
          this.recomputeLevel();
        }
      }
    };
    this.rafHandle = requestAnimationFrame(step);
  }

  // ---------- Level ----------

  private recomputeLevel(): void {
    const prev = this.state.level;
    let level: QualityLevel;

    if (this.state.reducedMotion && this.respectReducedMotion) {
      level = 'off';
    } else if (this.state.hidden) {
      // На скрытой вкладке рисовать бессмысленно — сохраняем level, но
      // не тратим на новые анимации.
      level = prev;
    } else if (this.guard === 'off') {
      level = 'full';
    } else if (this.fpsWarming) {
      // Пока не получен первый реальный замер FPS — оптимистично считаем full.
      // Иначе на холодном старте (когда rAF ещё не оттикал) можем ошибочно впасть в low/off.
      level = 'full';
    } else if (this.state.batteryLow) {
      level = 'low';
    } else if (this.state.fps >= this.fpsThresholds.full) {
      level = 'full';
    } else if (this.state.fps >= this.fpsThresholds.balanced) {
      level = 'balanced';
    } else if (this.state.fps >= this.fpsThresholds.low) {
      level = 'low';
    } else {
      level = 'off';
    }

    if (level !== prev) {
      this.setState({ ...this.state, level });
    } else {
      // Всё равно уведомляем подписчиков только если что-то изменилось значимо.
    }
  }

  private setState(next: QualityState): void {
    this.state = next;
    for (const fn of this.listeners) {
      try {
        fn(next);
      } catch (e) {
        console.warn('capability listener failed', e);
      }
    }
  }
}

/** Синглтон для всего клиента. */
export const capability = new CapabilityService();

/**
 * Фильтр MotionSpec под текущий QualityLevel. Удаляет тяжёлые эффекты.
 * Возвращает новый объект (без мутации входа).
 */
export function applyQualityFilter<T extends { from?: unknown; to?: unknown; duration?: number }>(
  spec: T | undefined,
  level: QualityLevel,
): T | undefined {
  if (!spec) return spec;
  if (level === 'full') return spec;
  if (level === 'off') {
    // Мгновенно (нулевая длительность).
    return { ...spec, duration: 0 } as T;
  }
  const clean = (s: unknown): unknown => {
    if (!s || typeof s !== 'object') return s;
    const obj = { ...(s as Record<string, unknown>) };
    if (level === 'balanced' || level === 'low') {
      // На balanced/low убираем blur.
      obj.blur = undefined;
      obj.saturate = undefined;
      obj.brightness = undefined;
    }
    if (level === 'low') {
      // На low убираем 3D.
      obj.rotateX = undefined;
      obj.rotateY = undefined;
      obj.z = undefined;
      obj.skewX = undefined;
      obj.skewY = undefined;
      obj.clipInset = undefined;
    }
    return obj;
  };
  return {
    ...spec,
    from: clean(spec.from),
    to: clean(spec.to),
  } as T;
}
