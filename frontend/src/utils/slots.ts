// =============================================================================
// Построение полного набора слотов расписания для панели.
// Объединяет расписание звонков из конфига + фактические UR из данных.
// =============================================================================

import type { BellSlot, BellsConfig, ConfigResponse, GroupData, PanelKind } from '$types/api';

export interface Slot extends BellSlot {
  ur: number;
  time: string;
  shift: 1 | 2;
}

export function slotsForKind(kind: PanelKind, cfg: ConfigResponse | null): Slot[] {
  const bells: BellsConfig = cfg?.bells || {};
  const grp = bells[kind] || {};
  const shift1 = (grp.shift1 || []).map((s) => ({ ...s, shift: 1 as const, time: s.time || '' }));
  const shift2 = (grp.shift2 || []).map((s) => ({ ...s, shift: 2 as const, time: s.time || '' }));
  return [...shift1, ...shift2];
}

/**
 * Целевое (фиксированное) количество пар для панели.
 * Колледж — всегда 6 пар, вуз — всегда 7 пар (независимо от факт. данных).
 */
export function desiredSlotCount(kind: PanelKind): number {
  return kind === 'college' ? 6 : 7;
}

/**
 * Возвращает объединённый набор слотов: из конфига + дополнительные UR,
 * которые встретились в данных, но отсутствуют в bells.
 * Всегда возвращает не менее 7 слотов (пустые добавляются в конец).
 */
export function buildAllSlots(kind: PanelKind, groups: GroupData[], cfg: ConfigResponse | null): Slot[] {
  const cfgSlots = slotsForKind(kind, cfg);
  const slotByUr = new Map<number, Slot>(cfgSlots.map((s) => [s.ur, s]));

  for (const g of groups) {
    for (const dISO in g.days) {
      const gd = g.days[dISO];
      for (const urKey in gd) {
        const ur = parseInt(urKey, 10);
        if (!slotByUr.has(ur)) {
          const t = (gd[urKey][0] || {}).time || '';
          const shift: 1 | 2 = (kind === 'university' ? ur <= 4 : ur <= 3) ? 1 : 2;
          slotByUr.set(ur, { ur, time: t, shift });
        }
      }
    }
  }

  const slots = Array.from(slotByUr.values()).sort((a, b) => a.ur - b.ur);

  // Фиксированное количество пар по типу панели: колледж = 6, вуз = 7.
  const desiredCount = desiredSlotCount(kind);
  while (slots.length < desiredCount) {
    const nextUr = (slots.length ? slots[slots.length - 1].ur : 0) + 1;
    const lateThreshold = kind === 'university' ? 4 : 3;
    slots.push({ ur: nextUr, time: '', shift: nextUr <= lateThreshold ? 1 : 2 });
  }
  // Если факт. данных больше желаемого количества — не отсекаем (реальные пары важнее),
  // но при точном совпадении с bells-конфигом длина будет равна desiredCount.
  return slots;
}

export interface GroupsLayoutParams {
  availWidth: number;
  slotColW?: number;
  gap?: number;
  outerPad?: number;
  minCol?: number;
  explicit?: number;
}

/**
 * Считает количество групп на страницу. Идентично старому computeGroupsPerPage.
 */
export function computeGroupsPerPage(params: GroupsLayoutParams): number {
  const { availWidth, explicit = 0 } = params;
  if (explicit > 0) return Math.max(1, Math.floor(explicit));

  const slotColW = params.slotColW ?? 74;
  const gap = params.gap ?? 14;
  const outerPad = params.outerPad ?? 24;
  const minCol = Math.max(180, params.minCol ?? 220);

  let n = 1;
  for (let candidate = 12; candidate >= 1; candidate--) {
    const totalGap = gap * (candidate - 1);
    const colWidth = (availWidth - slotColW - gap - outerPad - totalGap) / candidate;
    if (colWidth >= minCol) { n = candidate; break; }
  }
  if (n < 1) n = 1;
  if (n > 12) n = 12;
  return n;
}
