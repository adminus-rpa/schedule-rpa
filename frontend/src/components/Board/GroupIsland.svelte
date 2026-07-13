<script lang="ts">
  import type { GroupData } from '$types/api';
  import type { Slot } from '$utils/slots';
  import { config } from '$stores/config.svelte';
  import { islandAppear } from '$utils/transitions';
  import LessonNode from './LessonNode.svelte';

  interface Props {
    group: GroupData;
    slots: Slot[];
    dateIso: string;
    index: number;
  }
  let { group, slots, dateIso, index }: Props = $props();

  const dayLessons = $derived(group.days?.[dateIso] ?? {});
  const fancy = $derived(config.cfg?.display?.fancy_animations !== false);
  const microMs = $derived(Number(config.cfg?.display?.micro_anim_ms) || 420);
</script>

<div
  class="group-island"
  style="--i: {index};"
  in:islandAppear={fancy ? { index, duration: microMs, stagger: 40 } : { index: 0, duration: 0, stagger: 0 }}
>
  <div class="group-island-header">
    <span class="group-name" title={group.name}>{group.name}</span>
  </div>
  <div class="group-island-body">
    {#each slots as slot, i (slot.ur)}
      {@const lessons = dayLessons[slot.ur] ?? dayLessons[String(slot.ur)] ?? []}
      {@const isShift = i > 0 && slot.shift === 2 && slots[i - 1].shift === 1}
      {#if i > 0}
        <div class="lesson-connector" class:is-shift={isShift}></div>
      {/if}
      <LessonNode {slot} {lessons} isShiftDivider={isShift} />
    {/each}
  </div>
</div>
