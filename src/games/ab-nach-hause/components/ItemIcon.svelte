<script>
  /** Symbole der Items und des Glücksfelds. */
  /** @type {'wish' | 'turbo' | 'reroll' | 'shield' | 'storm' | 'trap' | 'box'} */
  export let name = 'box';
  /** @type {number} */
  export let size = 22;
</script>

<svg class="item-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
  {#if name === 'wish'}
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#f4c542" stroke="#7a5600" stroke-width="1.5" />
    <path d="M12 7.2l1.3 2.8 3 .4-2.2 2.1.6 3-2.7-1.5-2.7 1.5.6-3-2.2-2.1 3-.4z" fill="#7a5600" />
  {:else if name === 'turbo'}
    <path d="M13.5 2.5 5 13.2h5.6L9.4 21.5 19 10.4h-5.7z" fill="#ff8a1f" stroke="#8a3d00" stroke-width="1.4" stroke-linejoin="round" />
  {:else if name === 'reroll'}
    <path d="M18.4 8.5A7 7 0 1 0 19 13" fill="none" stroke="#3b82c4" stroke-width="2.4" stroke-linecap="round" />
    <path d="M19.5 3.8v5.3h-5.3" fill="none" stroke="#3b82c4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === 'shield'}
    <path d="M12 2.8 19.5 5.6v5.6c0 4.8-3.2 8.3-7.5 10-4.3-1.7-7.5-5.2-7.5-10V5.6z" fill="#3fae6b" stroke="#16582f" stroke-width="1.4" stroke-linejoin="round" />
    <path d="M8.6 12.2 11 14.6l4.6-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === 'storm'}
    <path d="M7 13.5h10.2a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.6A3.3 3.3 0 0 0 7 13.5z" fill="#7b8794" />
    <path d="M12.6 12.5 9.5 17.5h3l-1.4 4.2 4.4-6h-3l1.6-3.2z" fill="#ffd23f" stroke="#7a5600" stroke-width="0.8" stroke-linejoin="round" />
  {:else if name === 'trap'}
    <path d="M3 17.5h18" stroke="#6b4a2e" stroke-width="2.2" stroke-linecap="round" />
    <path d="M5 17.5 7 11l2.4 6.5L12 9l2.6 8.5L17 11l2 6.5" fill="none" stroke="#9aa3ad" stroke-width="1.9" stroke-linejoin="round" />
  {:else}
    <rect x="3" y="3" width="18" height="18" rx="4.5" fill="#f4c542" stroke="#7a5600" stroke-width="1.4" />
    <path d="M9.4 9.2a2.7 2.7 0 1 1 4 2.4c-.9.5-1.4 1-1.4 2" fill="none" stroke="#7a5600" stroke-width="2" stroke-linecap="round" />
    <circle cx="12" cy="16.6" r="1.25" fill="#7a5600" />
  {/if}
</svg>

<style>
  .item-icon {
    display: block;
    flex-shrink: 0;
  }
</style>
