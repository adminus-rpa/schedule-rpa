<script lang="ts">
  import { schedule } from '$stores/schedule.svelte';
  import Icon from '$components/Icon.svelte';
  import DateNav from './DateNav.svelte';
  import StatusIndicator from './StatusIndicator.svelte';
  import Clock from './Clock.svelte';
  import FullscreenButton from './FullscreenButton.svelte';

  let refreshSpinning = $state<boolean>(false);

  function onRefresh() {
    refreshSpinning = true;
    schedule.load().finally(() => {
      setTimeout(() => { refreshSpinning = false; }, 400);
    });
  }
</script>

<header class="topbar" id="topbar">
  <div class="brand">
    <span class="brand-mark" aria-hidden="true">
      <Icon name="book" size={24} />
    </span>
    <div class="brand-text">
      <div class="brand-title">Расписание</div>
      <div class="brand-sub" id="brand-sub">Экспресс-расписание</div>
    </div>
  </div>

  <DateNav />

  <div class="topbar-right">
    <Clock />
    <StatusIndicator />
    <FullscreenButton />
    <button
      class="btn-icon"
      class:spinning={refreshSpinning}
      id="refresh-btn"
      title="Обновить данные (R)"
      aria-label="Обновить"
      onclick={onRefresh}
    >
      <Icon name="refresh" />
    </button>
  </div>
</header>
