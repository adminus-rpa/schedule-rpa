<script lang="ts">
  import { sse } from '$stores/sse.svelte';
  import { config } from '$stores/config.svelte';

  const boot = window.__BOOT__ ?? {};
  const showStatus = $derived(config.cfg?.behavior?.show_status_indicator ?? boot.show_status ?? true);

  // Маппинг внутренних статусов на CSS-классы старого стиля.
  const kindClass = $derived(
    sse.status === 'ok'      ? 'ok'
    : sse.status === 'error' ? 'error'
    : 'warn'
  );
</script>

{#if showStatus}
  <span
    class="status-indicator {kindClass}"
    title="Состояние подключения к БД"
    role="status"
    aria-live="polite"
  >
    <span class="dot"></span>
    <span class="label">{sse.statusText}</span>
  </span>
{/if}
