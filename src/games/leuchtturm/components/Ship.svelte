<svelte:options namespace="svg" />

<script>
  /** Ein Segelschiff (Zeichenfläche 100 × 80). */
  export let wrecked = false;
  /** Wimpel am Mast, z. B. beim Anlegen. */
  export let flag = false;
</script>

<path d="M50 14 L50 50" stroke="#5a2a14" stroke-width="3.5" stroke-linecap="round"></path>
<path d="M53 16 L53 46 L82 46 Z" fill="#ffffff" stroke="#3a4a5c" stroke-width="3" stroke-linejoin="round"></path>
<path d="M47 20 L47 44 L26 44 Z" fill="#f2efe6" stroke="#3a4a5c" stroke-width="3" stroke-linejoin="round"></path>
{#if flag}
  <path d="M50 2 L72 8 L50 14 Z" fill="#ffd66b" stroke="#8a6a10" stroke-width="2" stroke-linejoin="round"></path>
{:else}
  <path d="M50 14 L62 18 L50 22 Z" fill="#e8564a"></path>
{/if}
<path d="M8 50 L92 50 L80 70 Q50 76 20 70 Z" fill={wrecked ? '#8a6a5a' : '#c9673e'} stroke="#5a2a14" stroke-width="3.5" stroke-linejoin="round"></path>
<path d="M14 56 L86 56" stroke="#e89a6e" stroke-width="3" stroke-linecap="round"></path>
<circle cx="34" cy="63" r="4" fill="#ffe9a8" stroke="#5a2a14" stroke-width="1.8"></circle>
<circle cx="50" cy="64" r="4" fill="#ffe9a8" stroke="#5a2a14" stroke-width="1.8"></circle>
<circle cx="66" cy="63" r="4" fill="#ffe9a8" stroke="#5a2a14" stroke-width="1.8"></circle>
