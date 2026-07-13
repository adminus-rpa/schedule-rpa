<script lang="ts">
  import type { Slot } from '$utils/slots';
  import { clock } from '$stores/clock.svelte';
  import { isSlotNow } from '$utils/time';

  interface Props {
    slots: Slot[];
  }
  let { slots }: Props = $props();
</script>

<div class="slots-column">
  <div class="slots-column-header">ПАРА</div>
  {#each slots as slot, i (slot.ur)}
    {@const isNow = isSlotNow(slot.time, clock.now)}
    {#if i > 0}
      <div class="slots-column-spacer"></div>
    {/if}
    <div
      class="slots-column-cell"
      class:is-now={isNow}
      data-time={slot.time || ''}
      data-ur={slot.ur}
    >
      <span class="slot-num-big">{slot.ur}</span>
      {#if slot.time}
        <span class="slot-num-time">{slot.time}</span>
      {/if}
    </div>
  {/each}
</div>
