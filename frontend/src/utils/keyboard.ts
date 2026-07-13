// =============================================================================
// Клавиатурные шорткаты. Работают на любой раскладке через e.code, но также
// проверяем e.key (в т.ч. русскую раскладку: ь, е, к).
// =============================================================================

export interface KeyboardHandlers {
  onFullscreen?: () => void;
  onToggleTopbar?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onRefresh?: () => void;
  onEscape?: () => void;
}

export function bindKeyboard(handlers: KeyboardHandlers): () => void {
  const listener = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    const code = e.code || '';
    const key = (e.key || '').toLowerCase();

    if (code === 'F11' || key === 'f11') {
      e.preventDefault();
      handlers.onFullscreen?.();
      return;
    }
    if (code === 'KeyM' || key === 'm' || key === 'ь') {
      e.preventDefault();
      handlers.onToggleTopbar?.();
      return;
    }
    if (code === 'ArrowLeft')  { handlers.onPrev?.(); return; }
    if (code === 'ArrowRight') { handlers.onNext?.(); return; }
    if (code === 'KeyT' || key === 't' || key === 'е') { handlers.onToday?.(); return; }
    if (code === 'KeyR' || key === 'r' || key === 'к') { handlers.onRefresh?.(); return; }
    if (code === 'Escape' || key === 'escape') { handlers.onEscape?.(); return; }
  };

  document.addEventListener('keydown', listener, { passive: false });
  return () => document.removeEventListener('keydown', listener);
}
