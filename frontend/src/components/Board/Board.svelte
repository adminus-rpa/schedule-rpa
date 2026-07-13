<script lang="ts">
  import { config } from '$stores/config.svelte';
  import { schedule } from '$stores/schedule.svelte';
  import { layout } from '$stores/layout.svelte';
  import Panel from './Panel.svelte';

  const layoutMode = $derived(config.cfg?.display?.layout ?? 'alternate');

  // В alternate — если на активной панели нет групп, а на другой есть — переключаемся.
  $effect(() => {
    if (layoutMode !== 'alternate') return;
    const has = (k: 'college' | 'university') =>
      (schedule.data?.[k]?.length ?? 0) > 0;
    if (!has(layout.activePanel) && has(layout.activePanel === 'college' ? 'university' : 'college')) {
      layout.toggleActivePanel();
    }
  });

  // Инкапсулированная логика ротации страниц и панелей
  function useRotation() {
    $effect(() => {
      if (!config.cfg || !schedule.data) return;
      const disp = config.cfg.display || {};
      const pageInterval = Math.max(3, Number(disp.page_interval_seconds) || 15) * 1000;

      const activePanels = (): Array<'college' | 'university'> => {
        if (layoutMode === 'alternate') return [layout.activePanel];
        if (layoutMode === 'college_only')    return ['college'];
        if (layoutMode === 'university_only') return ['university'];
        return ['college', 'university'];
      };

      let alive = true;
      let timer: number | null = null;

      const tick = () => {
        if (!alive) return;
        const panels = activePanels();
        let wrappedAll = true;
        let anyAdvanced = false;

        for (const kind of panels) {
          const { wrapped } = layout.advancePage(kind);
          if (!wrapped) { anyAdvanced = true; wrappedAll = wrappedAll && false; }
        }

        if (layoutMode === 'alternate' && wrappedAll && !anyAdvanced) {
          const nextKind = layout.activePanel === 'college' ? 'university' : 'college';
          const hasOther = (schedule.data?.[nextKind]?.length ?? 0) > 0;
          if (hasOther) {
            layout.activePanel = nextKind;
            layout.pageIndex[nextKind] = 0;
          }
        }

        timer = window.setTimeout(tick, pageInterval);
      };

      timer = window.setTimeout(tick, pageInterval);
      return () => {
        alive = false;
        if (timer != null) window.clearTimeout(timer);
      };
    });
  }

  useRotation();

  $effect(() => {
    document.body.setAttribute('data-active-panel', layout.activePanel);
  });
</script>

<main class="board" id="board">
  {#if layoutMode !== 'alternate' || layout.activePanel === 'college'}
    <Panel kind="college" />
  {/if}
  {#if layoutMode !== 'alternate' || layout.activePanel === 'university'}
    <Panel kind="university" />
  {/if}
</main>
