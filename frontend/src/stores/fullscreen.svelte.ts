// =============================================================================
// Fullscreen API + auto-hide курсора.
// Приложение Б из ТЗ.
// =============================================================================

class FullscreenStore {
  isFullscreen = $state<boolean>(false);

  private _cursorHideTimer: number | null = null;
  private _bound = false;

  constructor() {
    const update = () => {
      this.isFullscreen = !!(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
        (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
      );
      document.body.classList.toggle('is-fullscreen', this.isFullscreen);
    };
    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];
    events.forEach((e) => document.addEventListener(e, update));
    update();
  }

  async toggle(): Promise<void> {
    if (this.isFullscreen) {
      await this._exit();
    } else {
      await this._request();
    }
  }

  async _request(): Promise<void> {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    try {
      if (el.requestFullscreen) return await el.requestFullscreen();
      if (el.webkitRequestFullscreen) return await el.webkitRequestFullscreen();
      if (el.mozRequestFullScreen) return await el.mozRequestFullScreen();
      if (el.msRequestFullscreen) return await el.msRequestFullscreen();
    } catch (e) { console.warn('requestFullscreen failed', e); }
  }

  async _exit(): Promise<void> {
    const d = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };
    try {
      if (d.exitFullscreen) return await d.exitFullscreen();
      if (d.webkitExitFullscreen) return await d.webkitExitFullscreen();
      if (d.mozCancelFullScreen) return await d.mozCancelFullScreen();
      if (d.msExitFullscreen) return await d.msExitFullscreen();
    } catch (e) { console.warn('exitFullscreen failed', e); }
  }

  /** Автоскрытие курсора после бездействия в fullscreen. Возвращает cleanup. */
  armCursorAutoHide(): () => void {
    if (this._bound) return () => { /* already bound */ };
    this._bound = true;
    const onMove = () => {
      document.body.classList.remove('cursor-hidden');
      if (this._cursorHideTimer != null) window.clearTimeout(this._cursorHideTimer);
      if (this.isFullscreen) {
        this._cursorHideTimer = window.setTimeout(() => {
          document.body.classList.add('cursor-hidden');
        }, 3500);
      }
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      document.removeEventListener('mousemove', onMove);
      if (this._cursorHideTimer != null) window.clearTimeout(this._cursorHideTimer);
      this._cursorHideTimer = null;
      this._bound = false;
    };
  }
}

export const fullscreen = new FullscreenStore();
