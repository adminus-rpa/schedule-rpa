<script lang="ts">
  import { fade } from 'svelte/transition';
  import { schedule } from '$stores/schedule.svelte';
  // Показываем только при первичной загрузке (нет ещё данных).
  const visible = $derived(schedule.loading && !schedule.data);
</script>

{#if visible}
  <div id="overlay-loading" class="overlay" transition:fade={{ duration: 300 }}>
    <div class="overlay-card overlay-loading-card">
      <div class="spinner"></div>
      <div class="overlay-title">Загрузка расписания…</div>
    </div>
  </div>
{/if}

<style>
  .spinner {
    width: 42px; height: 42px;
    margin: 0 auto 1rem;
    border: 3px solid color-mix(in srgb, var(--text-muted) 25%, transparent);
    border-top-color: var(--accent-university);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
</style>
