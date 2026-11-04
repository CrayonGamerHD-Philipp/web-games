<script>
  import { BUNT_COLOR_SHAPES } from '../rules.js';

  /** Colour whose shape mark is drawn (circle / triangle / square / diamond). */
  /** @type {import('../types').BuntColor} */
  export let shape = 'kirsche';
  /** @type {string} */
  export let className = '';

  $: kind = BUNT_COLOR_SHAPES[shape] ?? 'circle';
</script>

<svg class={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
  {#if kind === 'circle'}
    <circle cx="10" cy="10" r="8" />
  {:else if kind === 'triangle'}
    <path d="M10 1.8 18.6 17.4H1.4Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
  {:else if kind === 'square'}
    <rect x="2.6" y="2.6" width="14.8" height="14.8" rx="2" />
  {:else}
    <path d="M10 1 19 10 10 19 1 10Z" />
  {/if}
</svg>
