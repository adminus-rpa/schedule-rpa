// =============================================================================
// Store SSE: EventSource + экспоненциальный reconnect + polling fallback.
// BUG-2 / BUG-3 / BUG-8 устранены: единый жизненный цикл через open()/close(),
// AbortController для in-flight fetch'ей, guard-флаг polling.
// =============================================================================

import { config } from './config.svelte';
import { schedule } from './schedule.svelte';

export type SseStatus = 'connecting' | 'ok' | 'polling' | 'warn' | 'error';

class SseStore {
  status = $state<SseStatus>('connecting');
  statusText = $state<string>('…');
  connected = $state<boolean>(false);

  private _es: EventSource | null = null;
  private _reconnectAttempt = 0;
  private _reconnectTimer: number | null = null;
  private _pollingTimer: number | null = null;
  private _pollingEnabled = false;
  private _pollingAbort: AbortController | null = null;
  private _statusPollTimer: number | null = null;
  private _statusPollAbort: AbortController | null = null;
  private _clientRefreshSec = 60;

  configure(clientRefreshSec: number): void {
    this._clientRefreshSec = Math.max(15, clientRefreshSec || 60);
  }

  open(): void {
    if (this._es) return;
    if (typeof EventSource === 'undefined') {
      this._startPolling();
      return;
    }
    this._setStatus('connecting', 'подключение…');
    try {
      const es = new EventSource('/api/events');
      this._es = es;

      es.addEventListener('hello', () => {
        this._setStatus('ok', 'подключено');
        this.connected = true;
        this._reconnectAttempt = 0;
        this._stopPolling();
      });
      es.addEventListener('data_updated', () => { void schedule.load({ silent: true }); });
      es.addEventListener('config_updated', () => { void config.load(); });
      es.addEventListener('sync_error', () => this._setStatus('warn', 'БД: кэш'));
      es.addEventListener('ping', () => { /* noop */ });
      es.onerror = () => {
        console.warn('SSE error — reconnect scheduled');
        this._closeSource();
        this._setStatus('warn', 'переподключение…');
        this._startPolling();
        this._scheduleReconnect();
      };
    } catch (e) {
      console.warn('SSE unavailable, using polling', e);
      this._startPolling();
    }
  }

  close(): void {
    this._closeSource();
    this._stopPolling();
    if (this._reconnectTimer != null) {
      window.clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this.connected = false;
  }

  private _closeSource(): void {
    if (this._es) {
      try { this._es.close(); } catch { /* noop */ }
      this._es = null;
    }
    this.connected = false;
  }

  private _scheduleReconnect(): void {
    this._reconnectAttempt++;
    const delay = Math.min(60000, 1500 * Math.pow(1.7, this._reconnectAttempt));
    if (this._reconnectTimer != null) window.clearTimeout(this._reconnectTimer);
    this._reconnectTimer = window.setTimeout(() => {
      this._reconnectTimer = null;
      // Реконнект только если ещё не закрыт извне
      if (!this._es) this.open();
    }, delay);
  }

  // ---- Polling fallback -------------------------------------------------
  private _startPolling(): void {
    if (this._pollingEnabled) return;
    this._pollingEnabled = true;
    const ms = this._clientRefreshSec * 1000;
    const tick = async () => {
      if (!this._pollingEnabled) return;
      this._pollingAbort = new AbortController();
      try {
        await config.load();
        await schedule.load({ silent: true });
      } catch { /* logged inside */ }
      if (!this._pollingEnabled) return;
      this._pollingTimer = window.setTimeout(tick, ms);
    };
    this._pollingTimer = window.setTimeout(tick, ms);
  }

  private _stopPolling(): void {
    this._pollingEnabled = false;
    if (this._pollingTimer != null) {
      window.clearTimeout(this._pollingTimer);
      this._pollingTimer = null;
    }
    if (this._pollingAbort) {
      try { this._pollingAbort.abort(); } catch { /* noop */ }
      this._pollingAbort = null;
    }
  }

  // ---- Status polling (/api/status раз в 15 сек) ------------------------
  startStatusPolling(): void {
    if (this._statusPollTimer != null) return;
    const poll = async () => {
      this._statusPollAbort = new AbortController();
      const timer = window.setTimeout(() => this._statusPollAbort?.abort(), 15000);
      try {
        const r = await fetch('/api/status', { signal: this._statusPollAbort.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const st = await r.json() as { healthy?: boolean };
        if (st.healthy) {
          if (this._es) this._setStatus('ok', 'онлайн');
          else          this._setStatus('polling', 'polling');
        } else if (schedule.data) {
          this._setStatus('warn', 'БД: кэш');
        } else {
          this._setStatus('error', 'нет данных');
        }
      } catch {
        // AbortError или сеть
        if (this._statusPollAbort?.signal.aborted && !this._pollingEnabled && !this._es) {
          // ничего: закрылись
        } else {
          this._setStatus('error', 'сервер?');
        }
      } finally {
        clearTimeout(timer);
        this._statusPollAbort = null;
      }
      this._statusPollTimer = window.setTimeout(poll, 15000);
    };
    this._statusPollTimer = window.setTimeout(poll, 15000);
  }

  stopStatusPolling(): void {
    if (this._statusPollTimer != null) {
      window.clearTimeout(this._statusPollTimer);
      this._statusPollTimer = null;
    }
    if (this._statusPollAbort) {
      try { this._statusPollAbort.abort(); } catch { /* noop */ }
      this._statusPollAbort = null;
    }
  }

  private _setStatus(kind: SseStatus, message: string): void {
    this.status = kind;
    this.statusText = message;
  }
}

export const sse = new SseStore();
