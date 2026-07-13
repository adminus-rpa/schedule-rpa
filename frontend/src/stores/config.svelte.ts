// =============================================================================
// Store конфига: /api/config, реактивный snapshot.
// Применение CSS-переменных темы к <html>.
// =============================================================================

import type { ConfigResponse } from '$types/api';

class ConfigStore {
  cfg = $state<ConfigResponse | null>(null);
  version = $state<number>(-1);
  loadedOnce = $state<boolean>(false);
  loadError = $state<string | null>(null);

  async load(): Promise<void> {
    try {
      // BUG-9: перестали дёргать `cache: 'no-store'` — сервер SSE сам присылает config_updated.
      const resp = await fetch('/api/config', { cache: 'default' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as ConfigResponse;
      if (data.version !== this.version) {
        this.version = data.version;
        this.cfg = data;
        this.applyToDocument(data);
      }
      this.loadedOnce = true;
      this.loadError = null;
    } catch (e) {
      console.warn('config.load failed', e);
      this.loadError = String((e as Error)?.message ?? e);
    }
  }

  /** Применение CSS-переменных и data-атрибутов body из конфига. */
  applyToDocument(cfg: ConfigResponse): void {
    const p = cfg.theme?.palette ?? ({} as ConfigResponse['theme']['palette']);
    const root = document.documentElement.style;
    const set = (name: string, value: string | undefined) => {
      if (value != null) root.setProperty(name, value);
    };

    set('--bg',            p.background);
    set('--surface',       p.surface);
    set('--surface-2',     p.surface_2 || p.header_bg);
    set('--text',          p.text);
    set('--text-muted',    p.text_muted);
    set('--accent-college',    p.accent_college);
    set('--accent-university', p.accent_university);
    set('--accent-now',    p.accent_now || '#b39ddb');
    set('--lesson-bg',     p.lesson_bg);
    set('--lesson-border', p.lesson_border);
    set('--grid-line',     p.grid_line);
    set('--header-bg',     p.header_bg);

    const typ = cfg.typography;
    if (typ) {
      set('--font-family', typ.font_family);
      set('--cell-fs',    typ.cell_font_size + 'rem');
      set('--header-fs',  typ.header_font_size + 'rem');
      set('--title-fs',   typ.title_font_size + 'rem');
    }

    const bg = (cfg.theme?.background_image || '').trim();
    root.setProperty('--bg-image', bg ? `url("${bg}")` : 'none');
    root.setProperty('--bg-image-opacity', String(cfg.theme?.background_opacity ?? 0.1));

    const disp = cfg.display || {};
    root.setProperty('--anim-ms',        (disp.page_animation_ms ?? 500) + 'ms');
    root.setProperty('--micro-anim-ms',  (disp.micro_anim_ms ?? 420) + 'ms');
    root.setProperty('--island-glow-radius',  (disp.island_glow_radius ?? 40) + 'px');
    root.setProperty('--island-glow-opacity', String(disp.island_glow_opacity ?? 0.35));
    if (disp.island_glow_color) {
      root.setProperty('--accent-college', disp.island_glow_color);
    }

    document.body.dataset.layout = disp.layout || 'alternate';
    document.body.dataset.fancy  = (disp.fancy_animations === false) ? 'off' : 'on';
    document.body.dataset.glow   = disp.island_glow_enabled ? 'on' : 'off';
    document.body.dataset.glowPulse = disp.island_glow_pulse ? 'on' : 'off';
    document.body.dataset.progress = (disp.progress_bar_enabled === false) ? 'off' : 'on';
  }
}

export const config = new ConfigStore();
