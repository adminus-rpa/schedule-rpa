// =============================================================================
// Motion Engine v4 — Choreography
// -----------------------------------------------------------------------------
// Тайминги перехода между страницами: сколько ждать exit прежде чем стартует
// enter, как усреднить overlap, как ограничить пиковую нагрузку.
// =============================================================================

export interface ChoreographyPlan {
  /** Задержка появления новой страницы (ms). */
  enterDelay: number;
  /** Длительность выхода прежней страницы (ms). */
  exitDuration: number;
  /** Длительность появления новой (ms). */
  enterDuration: number;
}

/**
 * Разложение общего pageAnimation_ms на exit/enter с перекрытием.
 *
 * overlap = 0   → полностью последовательно (exit → enter)
 * overlap = 0.5 → 50% нахлёста (visually сглаженно, дефолт)
 * overlap = 1   → полностью параллельно (crossfade)
 */
export function planPageTransition(
  totalMs: number,
  overlap: number = 0.5,
): ChoreographyPlan {
  const total = Math.max(0, totalMs);
  const ov = Math.max(0, Math.min(1, overlap));
  // Хотим, чтобы вся композиция уложилась ровно в totalMs.
  // Пусть exit = enter = d. Тогда total = d + d - ov*d = d*(2-ov).
  // Отсюда d = total / (2-ov).
  const d = total / (2 - ov);
  const enterDelay = Math.max(0, Math.round(d * (1 - ov)));
  return {
    enterDelay,
    exitDuration: Math.round(d),
    enterDuration: Math.round(d),
  };
}
