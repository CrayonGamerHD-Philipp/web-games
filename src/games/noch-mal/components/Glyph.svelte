<script>
  /** Kleine Symbole des Spiels als SVG: Stern, Würfelfeld, Bombe, Herz, Marke, Sonderaktionen. */
  /** @type {'star' | 'gold' | 'bomb' | 'heart' | 'token' | 'stars' | 'row' | 'block' | 'joker' | 'check'} */
  export let name = 'star';
  /** @type {number} */
  export let size = 16;
  /** @type {string} */
  export let label = '';
</script>

<svg
  class="glyph"
  width={size}
  height={size}
  viewBox="0 0 20 20"
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}
>
  {#if name === 'star'}
    <path d="M10 1.8 12.5 7l5.7.7-4.2 3.9 1.1 5.6L10 14.4l-5.1 2.8L6 11.6 1.8 7.7 7.5 7Z" fill="currentColor" />
  {:else if name === 'gold'}
    <rect x="3" y="3" width="14" height="14" rx="3.5" fill="#f3c34b" stroke="#7a5300" stroke-width="1.4" />
    <circle cx="7" cy="7" r="1.5" fill="#7a5300" />
    <circle cx="13" cy="13" r="1.5" fill="#7a5300" />
    <circle cx="10" cy="10" r="1.5" fill="#7a5300" />
  {:else if name === 'bomb'}
    <circle cx="9" cy="11.5" r="6" fill="currentColor" />
    <path d="M12.5 6.5 14.5 4.5M14.5 4.5l1.6-.4M14.5 4.5l.4-1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" />
    <circle cx="7" cy="9.5" r="1.4" fill="#fff" opacity="0.55" />
  {:else if name === 'heart'}
    <path d="M10 17.2S2.2 12.4 2.2 7.1A4 4 0 0 1 10 5.4a4 4 0 0 1 7.8 1.7c0 5.3-7.8 10.1-7.8 10.1Z" fill="currentColor" />
  {:else if name === 'token'}
    <rect x="3" y="3" width="14" height="14" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.8" />
    <path d="M10 6.2v7.6M6.2 10h7.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  {:else if name === 'stars'}
    <path d="M7 2.5 8.4 5.6l3.3.4-2.4 2.3.6 3.3L7 10l-2.9 1.6.6-3.3-2.4-2.3 3.3-.4Z" fill="currentColor" />
    <path d="M13.5 8.5 14.9 11.6l3.3.4-2.4 2.3.6 3.3-2.9-1.6-2.9 1.6.6-3.3-2.4-2.3 3.3-.4Z" fill="currentColor" />
  {:else if name === 'row'}
    <rect x="1.5" y="7" width="5" height="6" rx="1.4" fill="currentColor" />
    <rect x="7.5" y="7" width="5" height="6" rx="1.4" fill="currentColor" />
    <rect x="13.5" y="7" width="5" height="6" rx="1.4" fill="currentColor" />
  {:else if name === 'block'}
    <path d="M3 3h8v6h6v8H3Z" fill="currentColor" />
  {:else if name === 'joker'}
    <path d="M7 7.2a3 3 0 1 1 4.6 2.5c-1 .6-1.6 1.2-1.6 2.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <circle cx="10" cy="15.4" r="1.3" fill="currentColor" />
  {:else}
    <path d="M4.5 10.5 8.3 14 15.5 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  {/if}
</svg>

<style>
  .glyph {
    display: inline-block;
    flex-shrink: 0;
    vertical-align: middle;
  }
</style>
