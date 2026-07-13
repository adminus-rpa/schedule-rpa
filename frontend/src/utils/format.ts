// =============================================================================
// Утилиты форматирования: разбор кабинета, обрезка предмета, цвет по этажу.
// =============================================================================

import type { ConfigResponse } from '$types/api';

const ROOM_SPLIT_RULES: Array<{ re: RegExp; tail: string }> = [
  { re: /^(.*?)\s*(КЮ)\s*$/iu,             tail: 'КЮ' },
  { re: /^(.*?Акт\.?)\s*(зал)\s*$/iu,      tail: 'зал' },
  { re: /^(.*?)\s*(зал)\s*$/iu,            tail: 'зал' },
  { re: /^(.*?)\s*(Ст\.\s*с\.?)\s*$/iu,    tail: 'Ст.с' },
  { re: /^(.*?)\s*\((Ст\.\s*с\.?)\)\s*$/iu, tail: 'Ст.с' }
];

export interface SplitRoom { main: string; tail: string; }

export function splitRoom(room: string | null | undefined): SplitRoom {
  if (!room) return { main: '', tail: '' };
  const s = String(room).trim();
  for (const rule of ROOM_SPLIT_RULES) {
    const m = s.match(rule.re);
    if (m && m[1] !== undefined) {
      const main = m[1].trim();
      if (main) return { main, tail: rule.tail };
    }
  }
  return { main: s, tail: '' };
}

export function truncateSubject(text: string | null | undefined, maxChars: number): string {
  if (!maxChars || maxChars <= 0) return String(text ?? '');
  const s = String(text ?? '');
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
}

export function floorColor(room: string | null | undefined, cfg: ConfigResponse | null): string {
  const map = (cfg?.theme?.floor_colors) || {};
  const def = map.default || '#64748b';
  if (!room) return def;
  const m = String(room).match(/\d/);
  if (!m) return def;
  return map[m[0]] || def;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
