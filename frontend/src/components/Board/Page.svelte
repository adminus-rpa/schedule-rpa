<script lang="ts">
  import type { GroupData, PanelKind } from '$types/api';
  import type { Slot } from '$utils/slots';
  import GroupIsland from './GroupIsland.svelte';

  interface Props {
    kind: PanelKind;
    groups: GroupData[];
    slots: Slot[];
    dateIso: string;
  }
  let { kind, groups, slots, dateIso }: Props = $props();
</script>

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
