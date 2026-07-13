<!--
  BUG-1 fix. Прямая ссылка на внешний SVG-спрайт /static/img/icons.svg.
  Никакого inline-инжекта в DOM, никакого XML-пролога, никаких race conditions.
-->
<script lang="ts">
  interface Props {
    name: string;
    size?: number;
    class?: string;
  }
  let { name, size = 18, class: className = '' }: Props = $props();
  const SPRITE_URL = '/static/img/icons.svg';
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  class={className}
  aria-hidden="true"
>
  <use href="{SPRITE_URL}#i-{name}" />
</svg>
