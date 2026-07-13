// =============================================================================
// Store layout: активная панель (в alternate), pageIndex, groupsPerPage,
// ResizeObserver и логика пагинации.
// =============================================================================

import type { PanelKind } from '$types/api';

class LayoutStore {
  activePanel = $state<PanelKind>('university');
  pageIndex = $state<Record<PanelKind, number>>({ college: 0, university: 0 });
  pageTotal = $state<Record<PanelKind, number>>({ college: 1, university: 1 });
  groupsPerPage = $state<number>(3);

  // Ширина области рендера — обновляется через ResizeObserver.
  panelBodyWidth = $state<Record<PanelKind, number>>({ college: 0, university: 0 });

  hideTopbar = $state<boolean>(false);
  isSwappingPanel = $state<boolean>(false);

  setPageTotal(kind: PanelKind, total: number): void {
    this.pageTotal[kind] = Math.max(1, total);
    // Clamp текущий индекс на случай, если данных стало меньше
    const idx = this.pageIndex[kind];
    if (idx >= this.pageTotal[kind]) this.pageIndex[kind] = 0;
  }

  setPageIndex(kind: PanelKind, idx: number): void {
    const total = this.pageTotal[kind] || 1;
    this.pageIndex[kind] = Math.max(0, Math.min(total - 1, idx | 0));
  }

  advancePage(kind: PanelKind): { wrapped: boolean } {
    const total = this.pageTotal[kind] || 1;
    const cur = this.pageIndex[kind] || 0;
    const next = cur + 1;
    if (next >= total) {
      this.pageIndex[kind] = 0;
      return { wrapped: true };
    }
    this.pageIndex[kind] = next;
    return { wrapped: false };
  }

  toggleActivePanel(): void {
    this.activePanel = this.activePanel === 'college' ? 'university' : 'college';
  }
}

export const layout = new LayoutStore();
