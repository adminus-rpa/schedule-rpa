<script lang="ts">
  import type { GroupData, PanelKind } from '$types/api';
  import type { Slot } from '$utils/slots';
  import { config } from '$stores/config.svelte';
  import { slotsForKind } from '$utils/slots';
  import SlotsColumn from './SlotsColumn.svelte';
  import GroupIsland from './GroupIsland.svelte';

  interface Props {
    kind: PanelKind;
    groups: GroupData[];
    allSlots: Slot[];
    dateIso: string;
  }
  let { kind, groups, allSlots, dateIso }: Props = $props();

  const slots = $derived.by<Slot[]>(() => {
    const bells = slotsForKind(kind, config.cfg);
    const bellsUrs = new Set(bells.map((s) => s.ur));
    const extra = allSlots.filter((s) => !bellsUrs.has(s.ur));
    const list = [...bells, ...extra].sort((a, b) => a.ur - b.ur);
    const desired = 7;
    while (list.length < desired) {
      const nextUr = (list.length ? list[list.length - 1].ur : 0) + 1;
      list.push({ ur: nextUr, time: '', shift: nextUr <= 3 ? 1 : 2 });
    }
    return list;
  });
</script>

<SlotsColumn {slots} />
{#if !groups.length}
  <div class="groups-row" style="grid-template-columns: 1fr;">
    <div class="empty-message">
      <div class="empty-icon">🌴</div>В этот день занятий нет
    </div>
  </div>
{:else}
  <div class="groups-row">
    {#each groups as g, gi (g.name + ':' + gi)}
      <GroupIsland group={g} {slots} {dateIso} index={gi} />
    {/each}
  </div>
{/if}
