// =============================================================================
// Кастомные Svelte transitions — покрывают 9 типов старой анимации swap.
// Возвращают TransitionConfig совместимый с in:/out:
// =============================================================================

import { cubicOut } from 'svelte/easing';

export type SwapName =
  | 'swap' | 'slide' | 'fade' | 'zoom' | 'flip'
  | 'cube' | 'stack' | 'reveal' | 'none';

interface SwapParams {
  name?: SwapName;
  duration?: number;
  direction?: 'in' | 'out';
}

interface TransitionConfig {
  duration?: number;
  easing?: (t: number) => number;
  css?: (t: number, u: number) => string;
  tick?: (t: number, u: number) => void;
}

/**
 * Универсальная swap-transition. Используется как в in:, так и в out:.
 * `t` идёт 0 → 1 для in, и 1 → 0 для out; `u = 1 - t`.
 */
export function swapTransition(
  _node: Element,
  { name = 'swap', duration = 500, direction = 'in' }: SwapParams = {}
): TransitionConfig {
  const dur = Math.max(80, duration);
  const easing = cubicOut;

  switch (name) {
    case 'none':
      return { duration: 0, easing, css: () => '' };

    case 'fade':
      return {
        duration: dur, easing,
        css: (t) => `opacity: ${t};`
      };

    case 'slide':
      return {
        duration: dur, easing,
        css: (t, u) => {
          const sign = direction === 'in' ? 1 : -1;
          return `opacity: ${t}; transform: translateX(${sign * u * 24}px);`;
        }
      };

    case 'zoom':
      return {
        duration: dur, easing,
        css: (t) => `opacity: ${t}; transform: scale(${0.94 + 0.06 * t});`
      };

    case 'flip':
      return {
        duration: dur, easing,
        css: (t, u) => {
          const deg = direction === 'in' ? u * -22 : u * 22;
          return `opacity: ${t}; transform: perspective(800px) rotateY(${deg}deg);`;
        }
      };

    case 'cube':
      return {
        duration: dur, easing,
        css: (t, u) => {
          const deg = direction === 'in' ? u * -60 : u * 60;
          return `opacity: ${0.4 + 0.6 * t}; transform-origin: ${direction === 'in' ? 'left' : 'right'} center; transform: perspective(1000px) rotateY(${deg}deg);`;
        }
      };

    case 'stack':
      return {
        duration: dur, easing,
        css: (t, u) => `opacity: ${t}; transform: translateY(${direction === 'in' ? u * 20 : -u * 20}px) scale(${0.96 + 0.04 * t});`
      };

    case 'reveal':
      return {
        duration: dur, easing,
        css: (t, u) => `opacity: ${t}; clip-path: inset(0 ${u * 100}% 0 0);`
      };

    case 'swap':
    default:
      return {
        duration: dur, easing,
        css: (t, u) => {
          // Apple-style: небольшой translate + fade.
          const sign = direction === 'in' ? 1 : -1;
          return `opacity: ${t}; transform: translateY(${sign * u * 12}px) scale(${0.98 + 0.02 * t});`;
        }
      };
  }
}

/** Мини-transition для смены заголовков панелей (Колледж ↔ Высшее). */
export function titleSlide(
  _node: Element,
  { duration = 420, direction = 'in', side = 'right' }: { duration?: number; direction?: 'in' | 'out'; side?: 'left' | 'right' } = {}
): TransitionConfig {
  const dur = Math.max(80, duration);
  const sign = side === 'right' ? 1 : -1;
  return {
    duration: dur,
    easing: cubicOut,
    css: (t, u) => {
      const dx = direction === 'in' ? sign * u * 30 : -sign * u * 30;
      return `opacity: ${t}; transform: translateX(${dx}px);`;
    }
  };
}
