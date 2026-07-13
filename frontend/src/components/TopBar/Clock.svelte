<script lang="ts">
  import { clock } from '$stores/clock.svelte';
  import { config } from '$stores/config.svelte';

  const boot = window.__BOOT__ ?? {};
  const showClock = $derived(config.cfg?.behavior?.show_clock ?? boot.show_clock ?? true);

  const text = $derived(
    clock.now.toLocaleString('ru-RU', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  );
</script>

{#if showClock}
  <span class="clock">{text}</span>
{/if}
