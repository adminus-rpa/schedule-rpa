// =============================================================================
// Типы ответов /api/schedule, /api/config, /api/status
// Составлены по фактическому JSON, отдаваемому Flask-бэкендом v2.
// =============================================================================

export type PanelKind = 'college' | 'university';
export type LayoutMode = 'alternate' | 'college_only' | 'university_only' | 'both';
export type PeriodKind = 'day' | 'week' | '2weeks' | '3weeks' | 'month';

export type AnimationType =
  | 'swap' | 'slide' | 'fade' | 'zoom' | 'flip'
  | 'cube' | 'stack' | 'reveal' | 'none';

export interface BellSlot {
  ur: number;
  time: string;
  shift?: 1 | 2;
}

export interface BellsConfig {
  college?: { shift1?: BellSlot[]; shift2?: BellSlot[] };
  university?: { shift1?: BellSlot[]; shift2?: BellSlot[] };
}

export interface Lesson {
  subject?: string;
  teacher?: string;
  room?: string;
  time?: string;
  [k: string]: unknown;
}

export interface GroupData {
  name: string;
  days: {
    [dateIso: string]: {
      [urKey: string]: Lesson[];
    };
  };
}

export interface DayInfo {
  date: string;
  weekday?: string;
  [k: string]: unknown;
}

export interface ScheduleResponse {
  start: string;
  end: string;
  days: DayInfo[];
  college: GroupData[];
  university: GroupData[];
  [k: string]: unknown;
}

export interface ThemePalette {
  background: string;
  surface: string;
  surface_2?: string;
  text: string;
  text_muted: string;
  accent_college: string;
  accent_university: string;
  accent_now?: string;
  lesson_bg: string;
  lesson_border: string;
  grid_line: string;
  header_bg: string;
  [k: string]: string | undefined;
}

export interface ThemeConfig {
  preset: string;
  palette: ThemePalette;
  background_image: string;
  background_image_raw: string;
  background_opacity: number;
  floor_colors: Record<string, string>;
}

export interface TypographyConfig {
  font_family: string;
  cell_font_size: number;
  header_font_size: number;
  title_font_size: number;
}

export interface DisplayConfig {
  layout: LayoutMode;
  period: PeriodKind;
  page_animation?: AnimationType;
  page_animation_ms?: number;
  micro_anim_ms?: number;
  page_interval_seconds?: number;
  groups_per_page?: number;
  group_col_min_px?: number;
  show_teacher?: boolean;
  subject_max_chars?: number;
  fancy_animations?: boolean;
  island_glow_enabled?: boolean;
  island_glow_pulse?: boolean;
  island_glow_color?: string;
  island_glow_radius?: number;
  island_glow_opacity?: number;
  progress_bar_enabled?: boolean;
  [k: string]: unknown;
}

export interface BehaviorConfig {
  show_clock: boolean;
  show_status_indicator: boolean;
  hide_topbar_on_load: boolean;
  client_refresh_seconds: number;
  fullscreen_on_first_interaction: boolean;
}

export interface ConfigResponse {
  version: number;
  display: DisplayConfig;
  theme: ThemeConfig;
  typography: TypographyConfig;
  behavior: BehaviorConfig;
  bells: BellsConfig;
  defaults: { start: string; end: string; period: PeriodKind };
}

export interface StatusResponse {
  healthy: boolean;
  [k: string]: unknown;
}

export interface BootParams {
  default_start: string;
  default_end: string;
  default_period: PeriodKind;
  show_clock: boolean;
  show_status: boolean;
  hide_topbar_on_load: boolean;
  client_refresh_seconds: number;
  fullscreen_on_first_interaction: boolean;
}

declare global {
  interface Window {
    __BOOT__?: Partial<BootParams>;
  }
}
