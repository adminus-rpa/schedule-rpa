// =============================================================================
// Motion Engine v4 — FLIP animation helper
// -----------------------------------------------------------------------------
// Обёртка над Svelte {animate:flip} с учётом темы и quality-guard.
// Также экспортируется низкоуровневый helper flipMove для ручных случаев.
// =============================================================================

import { flip as svelteFlip } from 'svelte/animate';
import { capability } from './capability';
import { resolveEasing } from './easings';
import type { AnimTarget, EasingSpec, FlipConfig } from './types';

interface FlipParams {
  delay?: number;
  duration?: number;
  easing?: EasingSpec;
}

/**
 * Возвращает функцию для animate:flip с учётом текущей темы и quality-level.
 * Использование:
 *   <div animate:flip={{ target: 'island', duration: 500 }}>
 */
export function motionFlip(target: AnimTarget, params: FlipParams = {}) {
  const level = capability.current.level;
  const durBase = params.duration ?? defaultDurationFor(target);
  const duration = level === 'off' ? 0 : level === 'low' ? Math.min(durBase, 220) : durBase;
  const easing = resolveEasing(params.easing ?? 'ease-out-cubic');
  const delay = params.delay ?? 0;

  return (node: Element, args: { from: DOMRect; to: DOMRect }) =>
    svelteFlip(node, args, { delay, duration, easing });
}

/**
 * Публичный getFlip — соответствует контракту ТЗ.
 * Возвращает FlipConfig, пригодный к передаче в animate:flip напрямую.
 */
export function getFlip(target: AnimTarget, params: FlipParams = {}): FlipConfig {
  const level = capability.current.level;
  const durBase = params.duration ?? defaultDurationFor(target);
  const duration = level === 'off' ? 0 : level === 'low' ? Math.min(durBase, 220) : durBase;
  return {
    duration,
    delay: params.delay ?? 0,
    easing: resolveEasing(params.easing ?? 'ease-out-cubic'),
  };
}

function defaultDurationFor(target: AnimTarget): number {
  switch (target) {
    case 'island':
      return 500;
    case 'lesson':
      return 380;
    case 'slot':
      return 300;
    default:
      return 400;
  }
}
