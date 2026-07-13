<script lang="ts">
  import { schedule } from '$stores/schedule.svelte';
  import { fmtRange } from '$utils/time';
  import Icon from '$components/Icon.svelte';

  const label = $derived(fmtRange(schedule.data?.start, schedule.data?.end));
  const dateValue = $derived(schedule.data?.start ?? '');

  let dpRef = $state<HTMLInputElement | null>(null);

  function openDatePicker(e: MouseEvent) {
    if ((e.target as HTMLElement | null)?.id === 'date-picker') return;
    e.preventDefault();
    if (!dpRef) return;
    const dp = dpRef as HTMLInputElement & { showPicker?: () => void };
    if (typeof dp.showPicker === 'function') {
      try { dp.showPicker(); return; } catch { /* fallback */ }
    }
    try { dp.focus(); dp.click(); } catch { /* noop */ }
  }
</script>

<div class="date-nav">
  <button
    class="btn-icon date-btn"
    id="date-prev"
    title="Предыдущий период (←)"
    aria-label="Предыдущий"
    onclick={() => schedule.shiftBy(-1)}
  >
    <Icon name="chevron-left" />
  </button>

  <button
    class="date-current"
    id="date-current"
    type="button"
    title="Выбрать дату"
    onclick={openDatePicker}
  >
    <Icon name="calendar" size={15} class="icon" />
    <span class="date-current-text" id="date-current-text">{label}</span>
    <input
      type="date"
      id="date-picker"
      aria-label="Выбрать дату"
      bind:this={dpRef}
      value={dateValue}
      onchange={(e) => schedule.pickDate((e.currentTarget as HTMLInputElement).value)}
    />
  </button>

  <button
    class="btn-icon date-btn"
    id="date-next"
    title="Следующий период (→)"
    aria-label="Следующий"
    onclick={() => schedule.shiftBy(1)}
  >
    <Icon name="chevron-right" />
  </button>

  <button
    class="date-btn date-today"
    id="date-today"
    title="Сегодня (T)"
    onclick={() => schedule.jumpToToday()}
  >Сегодня</button>
</div>
