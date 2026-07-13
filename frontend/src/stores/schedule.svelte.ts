// =============================================================================
// Store расписания: /api/schedule, кэш по (start, end, period).
// =============================================================================

import type { PeriodKind, ScheduleResponse } from '$types/api';
import { addDays, parseISO, startOfWeekMonday, toISO, todayISO, PERIOD_DAYS } from '$utils/time';

interface RangeState {
  start: string | null;
  end: string | null;
  period: PeriodKind;
}

class ScheduleStore {
  data = $state<ScheduleResponse | null>(null);
  range = $state<RangeState>({ start: null, end: null, period: 'day' });
  loading = $state<boolean>(false);
  error = $state<string | null>(null);

  private _inFlight: AbortController | null = null;

  async load(opts: { silent?: boolean } = {}): Promise<void> {
    // BUG-3-подобная защита: отменяем предыдущий запрос
    if (this._inFlight) {
      try { this._inFlight.abort(); } catch { /* noop */ }
    }
    const ctrl = new AbortController();
    this._inFlight = ctrl;

    if (!opts.silent) this.loading = true;

    const params = new URLSearchParams();
    if (this.range.start)  params.set('start',  this.range.start);
    if (this.range.period) params.set('period', this.range.period);

    try {
      // Используем AbortSignal.any для объединения отмены вручную и таймаута
      const signal = AbortSignal.any ? AbortSignal.any([ctrl.signal, AbortSignal.timeout(25000)]) : ctrl.signal;
      const resp = await fetch('/api/schedule?' + params.toString(), { signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as ScheduleResponse;
      this.data = data;
      this.range.start = data.start;
      this.range.end = data.end;
      this.error = null;
      this.writeURL();
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' || (e as Error)?.name === 'TimeoutError') return;
      console.warn('schedule.load failed', e);
      if (!this.data) this.error = 'Не удалось загрузить расписание. Повторная попытка…';
    } finally {
      if (this._inFlight === ctrl) this._inFlight = null;
      if (!opts.silent) this.loading = false;
    }
  }

  // ---- Навигация по периодам --------------------------------------------
  shiftBy(deltaSign: number): void {
    if (!this.range.start) return;
    const len = PERIOD_DAYS[this.range.period] || 7;
    const startD = parseISO(this.range.start);
    const newStart = addDays(startD, deltaSign * len);
    if (['week', '2weeks', '3weeks'].includes(this.range.period)) {
      this.range.start = toISO(startOfWeekMonday(newStart));
    } else {
      this.range.start = toISO(newStart);
    }
    void this.load();
  }

  jumpToToday(): void {
    const t = new Date();
    if (['week', '2weeks', '3weeks'].includes(this.range.period)) {
      this.range.start = toISO(startOfWeekMonday(t));
    } else {
      this.range.start = toISO(t);
    }
    void this.load();
  }

  pickDate(iso: string): void {
    if (!iso) return;
    if (['week', '2weeks', '3weeks'].includes(this.range.period)) {
      this.range.start = toISO(startOfWeekMonday(parseISO(iso)));
    } else {
      this.range.start = iso;
    }
    void this.load();
  }

  // ---- URL <-> state ----------------------------------------------------
  readURL(): { start: string | null; end: string | null; period: string | null } {
    const p = new URLSearchParams(location.search);
    return { start: p.get('start'), end: p.get('end'), period: p.get('period') };
  }

  writeURL(): void {
    const p = new URLSearchParams();
    if (this.range.start)  p.set('start', this.range.start);
    if (this.range.period) p.set('period', this.range.period);
    const s = p.toString();
    history.replaceState(null, '', s ? `${location.pathname}?${s}` : location.pathname);
  }

  todayISO(): string { return todayISO(); }
}

export const schedule = new ScheduleStore();
