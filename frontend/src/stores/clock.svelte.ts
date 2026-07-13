// =============================================================================
// Store часов: реактивный now (обновляется раз в 30 сек), midnight-guard.
// isSlotNow — чистая функция из utils/time.ts, вызываемая с этим now.
// BUG-4 (querySelectorAll каждые 30 сек) и BUG-5 (утечка midnightTimer) устранены
// на уровне store: cleanup происходит естественным образом через $effect в
// компонентах-потребителях. Здесь же — просто реактивный тик и midnight-guard.
// =============================================================================

import { todayISO } from '$utils/time';

class ClockStore {
  now = $state<Date>(new Date());
  today = $state<string>(todayISO());

  private _tickTimer: number | null = null;
  private _midnightTimer: number | null = null;
  private _dayGuardTimer: number | null = null;
  private _onMidnight: (() => void) | null = null;

  /** Запускает регулярный tick и midnight-guard. Возвращает cleanup. */
  start(onMidnight?: () => void): () => void {
    this._onMidnight = onMidnight ?? null;

    // Тик каждые 30 сек — этого достаточно и для подсветки «текущей пары»,
    // и для отображения часов в шапке.
    const tick = () => { this.now = new Date(); };
    tick();
    this._tickTimer = window.setInterval(tick, 30 * 1000);

    // Midnight-guard: раз в минуту сверяем todayISO с сохранённым значением.
    // Плюс отдельный таймер, срабатывающий строго в 00:00:05.
    this._dayGuardTimer = window.setInterval(() => {
      const t = todayISO();
      if (t !== this.today) {
        this.today = t;
        this._onMidnight?.();
      }
    }, 60 * 1000);

    this._scheduleMidnight();
    return () => this.stop();
  }

  private _scheduleMidnight(): void {
    if (this._midnightTimer != null) window.clearTimeout(this._midnightTimer);
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5
    );
    const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());
    this._midnightTimer = window.setTimeout(() => {
      const t = todayISO();
      if (t !== this.today) {
        this.today = t;
        this._onMidnight?.();
      }
      this._scheduleMidnight();
    }, delay);
  }

  stop(): void {
    if (this._tickTimer != null) { window.clearInterval(this._tickTimer); this._tickTimer = null; }
    if (this._midnightTimer != null) { window.clearTimeout(this._midnightTimer); this._midnightTimer = null; }
    if (this._dayGuardTimer != null) { window.clearInterval(this._dayGuardTimer); this._dayGuardTimer = null; }
  }
}

export const clock = new ClockStore();
