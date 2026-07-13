// =============================================================================
// Утилиты работы со временем и датами (RU-локаль, без сторонних либ).
// =============================================================================

export const RU_WEEKDAYS = [
  'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'
];
export const RU_MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

export function parseISO(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeekMonday(d: Date): Date {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - day);
  return r;
}

export function fmtDateLong(iso: string): string {
  const d = parseISO(iso);
  const wd = RU_WEEKDAYS[(d.getDay() + 6) % 7];
  return `${wd}, ${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]}`;
}

export function fmtDateShort(iso: string): string {
  const d = parseISO(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtRange(startIso: string | null | undefined, endIso: string | null | undefined): string {
  if (!startIso) return '—';
  if (!endIso || startIso === endIso) return fmtDateLong(startIso);
  return `${fmtDateShort(startIso)} — ${fmtDateShort(endIso)}, ${parseISO(endIso).getFullYear()}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export interface TimeRange {
  startH: number;
  startM: number;
  endH: number;
  endM: number;
}

export function parseTimeRange(str: string | null | undefined): TimeRange | null {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})[.:](\d{2})\s*[–\-]\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  return { startH: +m[1], startM: +m[2], endH: +m[3], endM: +m[4] };
}

/**
 * Возвращает true, если текущее время `now` попадает в диапазон слота `slotTime`.
 * `now` передаётся явно — так функция становится чистой и легко тестируется,
 * а компонент, зависящий от clock.now, реактивно перерендеривается через $derived.
 */
export function isSlotNow(slotTime: string | null | undefined, now: Date = new Date()): boolean {
  const t = parseTimeRange(slotTime);
  if (!t) return false;
  const nowM = now.getHours() * 60 + now.getMinutes();
  return nowM >= (t.startH * 60 + t.startM) && nowM <= (t.endH * 60 + t.endM);
}

export const PERIOD_DAYS: Record<string, number> = {
  day: 1, week: 7, '2weeks': 14, '3weeks': 21, month: 30
};
