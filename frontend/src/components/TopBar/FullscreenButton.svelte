<script lang="ts">
  import { fullscreen } from '$stores/fullscreen.svelte';
  import Icon from '$components/Icon.svelte';

  // Полный фикс BUG-1: иконка — реактивное выражение, а не setAttribute.
  const iconName = $derived(fullscreen.isFullscreen ? 'fullscreen-exit' : 'fullscreen');
  const title = $derived(
    fullscreen.isFullscreen
      ? 'Выйти из полноэкранного режима (F11)'
      : 'Полноэкранный режим (F11)'
  );
</script>

<button
  class="btn-icon"
  id="fullscreen-btn"
  {title}
  aria-label="Полноэкранный режим"
  onclick={() => void fullscreen.toggle()}
>
  <Icon name={iconName} />
</button>
