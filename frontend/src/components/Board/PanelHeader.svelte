<script lang="ts">
  import type { PanelKind } from '$types/api';
  import { titleSlide } from '$utils/transitions';
  import { config } from '$stores/config.svelte';
  import Icon from '$components/Icon.svelte';
  import { fmtDateTitle } from '$utils/time';

  interface Props {
    kind: PanelKind;
    /** Уникальный ключ, при смене которого проигрывается анимация улёта/прилёта */
    animKey: number;
    pageIdx: number;
    pageTotal: number;
    dateIso: string;
  }
  let { kind, animKey, pageIdx, pageTotal, dateIso }: Props = $props();

  const isCollege = $derived(kind === 'college');
  const title = $derived(isCollege ? 'КОЛЛЕДЖ' : 'ВЫСШЕЕ ОБРАЗОВАНИЕ');
  const badgeIcon = $derived(isCollege ? 'college' : 'university');
  // Сторона появления/исчезновения (сохраняем поведение старого кода)
  const side = $derived<'left' | 'right'>(isCollege ? 'left' : 'right');

  const fancy = $derived(config.cfg?.display?.fancy_animations !== false);
  const microMs = $derived(Number(config.cfg?.display?.micro_anim_ms ?? 420));
</script>

<div class="panel-title">
  <span class="panel-date">{fmtDateTitle(dateIso)}</span>
  <div class="panel-title-stage" id="title-stage-{kind}">
    {#key animKey}
      {#if fancy}
        <div
          class="panel-title-inner"
          data-key={kind}
          in:titleSlide={{ duration: microMs, direction: 'in', side }}
          out:titleSlide={{ duration: microMs, direction: 'out', side }}
        >
          <span class="panel-badge {kind}" aria-hidden="true">
            <Icon name={badgeIcon} size={14} />
          </span>
          <span class="panel-title-text">{title}</span>
        </div>
      {:else}
        <div class="panel-title-inner" data-key={kind}>
          <span class="panel-badge {kind}" aria-hidden="true">
            <Icon name={badgeIcon} size={14} />
          </span>
          <span class="panel-title-text">{title}</span>
        </div>
      {/if}
    {/key}
  </div>
  {#if pageTotal > 1}
    <span class="panel-page-indicator" id="page-{kind}">{pageIdx + 1} / {pageTotal}</span>
  {/if}
</div>
