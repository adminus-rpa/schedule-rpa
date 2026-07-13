<script lang="ts">
  import type { Lesson } from '$types/api';
  import type { Slot } from '$utils/slots';
  import { config } from '$stores/config.svelte';
  import { clock } from '$stores/clock.svelte';
  import { isSlotNow } from '$utils/time';
  import { floorColor, splitRoom, truncateSubject } from '$utils/format';
  import Icon from '$components/Icon.svelte';

  interface Props {
    slot: Slot;
    lessons: Lesson[];
    isShiftDivider: boolean;
  }
  let { slot, lessons, isShiftDivider }: Props = $props();

  const showTeacher = $derived(config.cfg?.display?.show_teacher !== false);
  const subjectMax = $derived(Number(config.cfg?.display?.subject_max_chars) || 0);
  const isEmpty = $derived(lessons.length === 0);
  const isNow = $derived(isSlotNow(slot.time, clock.now));

  const first = $derived<Lesson | null>(lessons[0] ?? null);
  const roomColor = $derived(floorColor(first?.room as string | undefined, config.cfg));
  const roomSplit = $derived(splitRoom(first?.room as string | undefined));
  const roomIsWord = $derived(!!roomSplit.main && !/\d/.test(roomSplit.main));
  const subj = $derived(truncateSubject(first?.subject as string | undefined, subjectMax) || '—');
  const subjectFull = $derived(String(first?.subject ?? ''));
  const teacher = $derived(String(first?.teacher ?? ''));
</script>

<div
  class="lesson-node"
  class:hide-teacher={!showTeacher}
  class:is-now={isNow}
  class:shift-divider={isShiftDivider}
  class:is-empty={isEmpty}
  data-time={slot.time || ''}
  data-ur={slot.ur}
  style="--room-color: {roomColor};"
>
  {#if isEmpty}
    <div class="cell-empty">—</div>
  {:else}
    <div class="cell-subject">
      <span class="subject-text" title={subjectFull}>{subj}</span>
    </div>
    <div class="cell-room">
      <div class="room-box">
        {#if roomSplit.main}
          <span class="room-main" class:is-word={roomIsWord}>{roomSplit.main}</span>
          {#if roomSplit.tail}
            <span class="room-tail">{roomSplit.tail}</span>
          {/if}
        {:else}
          <span class="room-empty">—</span>
        {/if}
      </div>
    </div>
    {#if showTeacher}
      {#if teacher}
        <div class="cell-teacher" title={teacher}>
          <Icon name="user" size={12} />
          <span class="teacher-name">{teacher}</span>
        </div>
      {:else}
        <div class="cell-teacher is-empty">
          <span class="teacher-name">преподаватель не указан</span>
        </div>
      {/if}
    {/if}
  {/if}
</div>
