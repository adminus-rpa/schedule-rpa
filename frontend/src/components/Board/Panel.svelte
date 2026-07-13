<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { PanelKind } from '$types/api';
  import { config } from '$stores/config.svelte';
  import { schedule } from '$stores/schedule.svelte';
  import { layout } from '$stores/layout.svelte';
  import { buildAllSlots, computeGroupsPerPage, slotsForKind, desiredSlotCount } from '$utils/slots';
  import type { Slot } from '$utils/slots';
  import { todayISO } from '$utils/time';
  import { swapTransition } from '$utils/transitions';
  import PanelHeader from './PanelHeader.svelte';
  import Page from './Page.svelte';
  import SlotsColumn from './SlotsColumn.svelte';

  interface Props {
    kind: PanelKind;
  }
  let { kind }: Props = $props();

  let bodyEl = $state<HTMLDivElement | null>(null);

  const groups = $derived(schedule.data?.[kind] ?? []);
  const dateIso = $derived(
    schedule.data?.days?.[0]?.date ?? schedule.range.start ?? todayISO()
  );

  const allSlots = $derived(buildAllSlots(kind, groups, config.cfg));

  const slots = $derived.by<Slot[]>(() => {
    const bells = slotsForKind(kind, config.cfg);
    const bellsUrs = new Set(bells.map((s) => s.ur));
    const extra = allSlots.filter((s) => !bellsUrs.has(s.ur));
    const list = [...bells, ...extra].sort((a, b) => a.ur - b.ur);
    const desired = desiredSlotCount(kind);
    const lateThreshold = kind === 'university' ? 4 : 3;
    while (list.length < desired) {
      const nextUr = (list.length ? list[list.length - 1].ur : 0) + 1;
      list.push({ ur: nextUr, time: '', shift: nextUr <= lateThreshold ? 1 : 2 });
    }
    return list;
  });

  const availWidth = $derived(layout.panelBodyWidth[kind]);
  const explicitPerPage = $derived(Number(config.cfg?.display?.groups_per_page) || 0);
  const minCol = $derived(Number(config.cfg?.display?.group_col_min_px) || 220);

  const perPage = $derived.by<number>(() => {
    const w = availWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
    return computeGroupsPerPage({ availWidth: w, explicit: explicitPerPage, minCol });
  });

  // Пересчёт pageTotal при изменении данных / perPage.
  $effect(() => {
    const total = Math.max(1, Math.ceil(groups.length / Math.max(1, perPage)));
    layout.setPageTotal(kind, total);
    layout.groupsPerPage = perPage;
  });

  const idx = $derived(Math.min(layout.pageIndex[kind], Math.max(0, layout.pageTotal[kind] - 1)));
  const slice = $derived(groups.slice(idx * perPage, idx * perPage + perPage));

  const total = $derived(layout.pageTotal[kind]);
  const progressPct = $derived(total > 1 ? ((idx + 1) / total) * 100 : 0);
  const showProgress = $derived(total > 1 && (config.cfg?.display?.progress_bar_enabled !== false));

  // ResizeObserver для panelBodyWidth
  $effect(() => {
    if (!bodyEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        layout.panelBodyWidth[kind] = entry.contentRect.width;
      }
    });
    ro.observe(bodyEl);
    layout.panelBodyWidth[kind] = bodyEl.clientWidth;
    return () => ro.disconnect();
  });

  const animMs = $derived(Number(config.cfg?.display?.page_animation_ms ?? 500));
  const animName = $derived(config.cfg?.display?.page_animation ?? 'swap');

  // Ключ для {#key}: меняется при смене страницы, набора групп, диапазона
  const pageKey = $derived(
    `${kind}:${dateIso}:${idx}:${groups.length}:${perPage}`
  );

  // Заголовок анимируется по смене activePanel (kind фиксирован → используем 0/1)
  const headerAnimKey = $derived(layout.activePanel === kind ? 1 : 0);
</script>

<section
  class="panel panel-{kind}"
  id="panel-{kind}"
  data-kind={kind}
  aria-label={kind === 'college' ? 'Расписание колледжа' : 'Расписание вуза'}
  aria-live="polite"
  in:fade={{ duration: 500, delay: 250 }}
  out:fade={{ duration: 250 }}
>
  <div class="panel-progress" aria-hidden="true">
    <div
      class="panel-progress-fill"
      id="progress-{kind}"
      style="width: {progressPct}%; opacity: {showProgress ? 1 : 0};"
    ></div>
  </div>

  <PanelHeader
    {kind}
    animKey={headerAnimKey}
    pageIdx={idx}
    pageTotal={total}
    {dateIso}
  />

  <div class="panel-body" id="body-{kind}" bind:this={bodyEl}>
    {#if !groups.length}
      <div class="empty-message">
        <div class="empty-icon">📭</div>Нет данных
      </div>
    {:else}
      <SlotsColumn {slots} />
      <div class="panel-pages-container">
        {#key pageKey}
          <div
            class="page anim-{animName}"
            style="--slot-count: {allSlots.length}; --groups-per-page: {slice.length};"
            in:swapTransition={{ name: animName, duration: animMs, direction: 'in' }}
            out:swapTransition={{ name: animName, duration: animMs, direction: 'out' }}
          >
            <Page {kind} groups={slice} {slots} {dateIso} />
          </div>
        {/key}
      </div>
    {/if}
  </div>
</section>
