// =============================================================================
// Motion Engine v4 — Smoke Tests (Vitest-совместимо)
// -----------------------------------------------------------------------------
// Тесты не входят в production-бандл, они только валидируют, что API
// движка ведёт себя предсказуемо.
//
// Запуск (при подключении vitest):
//   npx vitest run src/motion/__tests__/engine.spec.ts
// =============================================================================

/* eslint-disable */
// @ts-nocheck
// Этот файл не подключается к рантайму, поэтому TS-ошибки игнорируем —
// он ориентирован на CI с vitest, который сам предоставляет describe/it/expect.

import { describe, it, expect } from 'vitest';
import { getMotion, resolveTheme, currentResolved, THEMES } from '../index';
import { computeStagger } from '../stagger';
import { planPageTransition } from '../choreography';
import { resolveEasing, spring } from '../easings';

describe('resolveTheme()', () => {
  it('default → default theme', () => {
    const r = resolveTheme({});
    expect(r.themeName).toBe('default');
    expect(r.enabled).toBe(true);
  });

  it('picks apple-tv when specified', () => {
    resolveTheme({ motion: { theme: 'apple-tv' } });
    expect(currentResolved().themeName).toBe('apple-tv');
  });

  it('legacy display.page_animation is respected when no motion.theme', () => {
    resolveTheme({ display: { page_animation: 'cube' } });
    const r = currentResolved();
    expect(r.profiles.page?.preset).toBe('cube');
  });

  it('motion.presets overrides theme selection', () => {
    resolveTheme({
      motion: { theme: 'apple-tv', presets: { island: 'flare' } },
    });
    expect(currentResolved().profiles.island?.preset).toBe('flare');
  });
});

describe('getMotion()', () => {
  it('returns zero-duration when motion disabled', () => {
    resolveTheme({ motion: { enabled: false } });
    const cfg = getMotion('island', 'enter');
    expect(cfg.duration).toBe(0);
  });

  it('has non-zero duration on default theme', () => {
    resolveTheme({});
    const cfg = getMotion('island', 'enter');
    expect(cfg.duration).toBeGreaterThan(0);
  });

  it('respects speed multiplier', () => {
    resolveTheme({ motion: { theme: 'apple-tv', speed: 1 } });
    const base = getMotion('island', 'enter').duration ?? 0;

    resolveTheme({ motion: { theme: 'apple-tv', speed: 2 } });
    const fast = getMotion('island', 'enter').duration ?? 0;

    expect(fast).toBeLessThan(base);
  });

  it('index-based stagger adds delay', () => {
    resolveTheme({ motion: { theme: 'apple-tv' } });
    const first = getMotion('island', 'enter', { index: 0, total: 5 });
    const fifth = getMotion('island', 'enter', { index: 4, total: 5 });
    expect(fifth.delay ?? 0).toBeGreaterThan(first.delay ?? 0);
  });
});

describe('computeStagger()', () => {
  it('index mode is linear', () => {
    const spec = { stagger: { mode: 'index' as const, step: 50, max: 1000 } };
    expect(computeStagger(spec, 0, 10)).toBe(0);
    expect(computeStagger(spec, 2, 10)).toBe(100);
    expect(computeStagger(spec, 4, 10)).toBe(200);
  });

  it('reverse mode inverts', () => {
    const spec = { stagger: { mode: 'reverse' as const, step: 50, max: 1000 } };
    expect(computeStagger(spec, 0, 5)).toBe(200);
    expect(computeStagger(spec, 4, 5)).toBe(0);
  });

  it('respects max cap', () => {
    const spec = { stagger: { mode: 'index' as const, step: 200, max: 300 } };
    expect(computeStagger(spec, 10, 20)).toBeLessThanOrEqual(300);
  });
});

describe('planPageTransition()', () => {
  it('overlap=0 sums exit+enter to total', () => {
    const p = planPageTransition(1000, 0);
    // enter starts after exit completes; total should be ≈ 2×d = 1000 → d=500
    expect(p.exitDuration + p.enterDelay).toBeCloseTo(1000, 0);
  });

  it('overlap=1 makes them fully parallel', () => {
    const p = planPageTransition(1000, 1);
    expect(p.enterDelay).toBe(0);
    expect(p.exitDuration).toBe(1000);
  });
});

describe('easings', () => {
  it('resolveEasing returns easeOutCubic by default', () => {
    const fn = resolveEasing(undefined);
    expect(fn(0)).toBeCloseTo(0);
    expect(fn(1)).toBeCloseTo(1);
    expect(fn(0.5)).toBeGreaterThan(0.5); // out-cubic > linear at t=0.5
  });

  it('spring converges to 1 at t=1', () => {
    const s = spring(170, 26, 1);
    expect(s(1)).toBeCloseTo(1, 2);
    expect(s(0)).toBeCloseTo(0, 2);
  });
});

describe('THEMES catalogue', () => {
  it('has all 8 themes registered', () => {
    for (const name of ['default', 'apple-tv', 'linear-crisp', 'paper', 'neon', 'minimal', 'kinetic', 'editorial']) {
      expect(THEMES[name]).toBeDefined();
    }
  });
});
