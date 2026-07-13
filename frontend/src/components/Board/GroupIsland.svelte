<script lang="ts">
  import type { GroupData } from '$types/api';
  import type { Slot } from '$utils/slots';
  import LessonNode from './LessonNode.svelte';

  interface Props {
    group: GroupData;
    slots: Slot[];
    dateIso: string;
    index: number;
  }
  let { group, slots, dateIso, index }: Props = $props();

  const dayLessons = $derived(group.days?.[dateIso] ?? {});
</script>

<div class="group-island" style="--i: {index};">
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
