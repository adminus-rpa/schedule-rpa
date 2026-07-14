// =============================================================================
// Motion Engine v4 — Stagger
// -----------------------------------------------------------------------------
// Компоненты (island/lesson/slot) появляются каскадами. Здесь сосредоточена
// вся арифметика вычисления delay в зависимости от index/total и режима.
// =============================================================================

import type { MotionSpec } from './types';

/**
 * Вычислить delay для элемента с учётом stagger-настроек в MotionSpec.
 *
 * @param spec  — MotionSpec с полем stagger.
 * @param index — 0-based позиция элемента.
 * @param total — общее число элементов (для reverse/wave/distance).
 */
export function computeStagger(
  spec: MotionSpec | undefined,
  index: number = 0,
  total: number = 1,
): number {
  const st = spec?.stagger;
  if (!st) return 0;

  const step = Math.max(0, Number(st.step ?? 40));
  const max = Math.max(0, Number(st.max ?? 800));
  const n = Math.max(1, total);
  const i = Math.max(0, Math.min(index, n - 1));

  let raw = 0;
  switch (st.mode ?? 'index') {
    case 'reverse':
      raw = (n - 1 - i) * step;
      break;

    case 'distance': {
      // Каскад из середины — центральные элементы появляются первыми.
      const center = (n - 1) / 2;
      raw = Math.abs(i - center) * step;
      break;
    }

    case 'wave': {
      // Волна: треугольная функция вокруг центра, но с положительным bias.
      const norm = i / Math.max(1, n - 1); // 0..1
      raw = Math.abs(Math.sin(norm * Math.PI)) * step * n * 0.5;
      break;
    }

    case 'shuffle': {
      // Псевдослучайный, но детерминированный по индексу.
      const seed = ((i * 9301 + 49297) % 233280) / 233280;
      raw = seed * step * n;
      break;
    }

    case 'index':
    default:
      raw = i * step;
      break;
  }

  return Math.min(max, Math.round(raw));
}
