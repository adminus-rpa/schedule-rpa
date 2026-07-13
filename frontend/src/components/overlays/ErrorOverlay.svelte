<script lang="ts">
  import { fade } from 'svelte/transition';
  import { schedule } from '$stores/schedule.svelte';
  const visible = $derived(!!schedule.error && !schedule.data);
</script>

{#if visible}
  <div id="overlay-error" class="overlay" transition:fade={{ duration: 300 }}>
    <div class="overlay-card">
      <div class="overlay-icon">⚠️</div>
      <div class="overlay-title">Нет соединения с базой</div>
      <div class="overlay-text" id="overlay-error-text">{schedule.error}</div>
    </div>
  </div>
{/if}

<style>
  .overlay-icon { font-size: 3rem; margin-bottom: .5rem; }
  .overlay-text { color: var(--text-muted); }
</style>
