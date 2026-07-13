<script lang="ts">
  import { config } from '$stores/config.svelte';
  import { schedule } from '$stores/schedule.svelte';
  import { sse } from '$stores/sse.svelte';
  import { clock } from '$stores/clock.svelte';
  import { fullscreen } from '$stores/fullscreen.svelte';
  import { layout } from '$stores/layout.svelte';
  import { bindKeyboard } from '$utils/keyboard';
  import TopBar from '$components/TopBar/TopBar.svelte';
  import Board from '$components/Board/Board.svelte';
  import LoadingOverlay from '$components/overlays/LoadingOverlay.svelte';
  import ErrorOverlay from '$components/overlays/ErrorOverlay.svelte';

  const boot = window.__BOOT__ ?? {};

  // ---- Инициализация range из URL / boot ----
  const fromURL = schedule.readURL();
  schedule.range.start = fromURL.start || boot.default_start || schedule.todayISO();
  schedule.range.period = (fromURL.period as typeof schedule.range.period) || boot.default_period || 'day';

  layout.hideTopbar = !!boot.hide_topbar_on_load;

  // ---- Bootstrap: config -> schedule -> sse ----
  (async () => {
    await config.load();
    await schedule.load();
    sse.configure(boot.client_refresh_seconds ?? 60);
    sse.open();
    sse.startStatusPolling();
  })();

  // ---- Клавиатура (F11 / M / T / R / стрелки) ----
  $effect(() => {
    return bindKeyboard({
      onFullscreen: () => void fullscreen.toggle(),
      onToggleTopbar: () => { layout.hideTopbar = !layout.hideTopbar; },
      onPrev: () => schedule.shiftBy(-1),
      onNext: () => schedule.shiftBy(1),
      onToday: () => schedule.jumpToToday(),
      onRefresh: () => void schedule.load(),
      onEscape: () => { layout.hideTopbar = false; }
    });
  });

  // ---- Часы + midnight-guard (BUG-5) ----
  $effect(() => {
    return clock.start(() => {
      // Полночь / смена дня: если период day — обновляем start на сегодня
      if (schedule.range.period === 'day') schedule.range.start = clock.today;
      void schedule.load({ silent: true });
    });
  });

  // ---- Fullscreen: cursor auto-hide ----
  $effect(() => fullscreen.armCursorAutoHide());

  // ---- BUG-8: SSE закрывается на hidden, открывается на visible ----
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') sse.close();
    else sse.open();
  };

  // ---- Fullscreen на первое взаимодействие ----
  let waitingInteraction = $state(!!boot.fullscreen_on_first_interaction);
  const onInteraction = () => {
    if (!waitingInteraction) return;
    waitingInteraction = false;
    if (!fullscreen.isFullscreen) void fullscreen.toggle();
  };
  $effect(() => {
    if (layout.hideTopbar) {
      document.body.classList.add('hide-topbar');
    } else {
      document.body.classList.remove('hide-topbar');
    }
  });
</script>

<svelte:document onvisibilitychange={onVisibilityChange} />
<svelte:window 
  onclick={waitingInteraction ? onInteraction : undefined} 
  onkeydown={waitingInteraction ? onInteraction : undefined} 
/>

<div class="bg-layer" aria-hidden="true"></div>

<div class="app-shell" id="app-shell">
  <TopBar />
  <Board />
</div>

<LoadingOverlay />
<ErrorOverlay />
