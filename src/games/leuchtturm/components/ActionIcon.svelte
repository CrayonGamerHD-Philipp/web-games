<svelte:options namespace="svg" />

<script>
  /** Symbol einer Aktion, zentriert um 0,0 (ca. 16 Einheiten groß). */
  /** @type {import('../types').LtActionType | 'plan'} */
  export let type = 'walk';
</script>

{#if type === 'walk'}
  <ellipse cx="-3.2" cy="2.4" rx="2.6" ry="3.8" fill="#13233d"></ellipse>
  <ellipse cx="3.2" cy="-2.2" rx="2.6" ry="3.8" fill="#13233d"></ellipse>
  <circle cx="-3.2" cy="-2.6" r="1" fill="#13233d"></circle>
  <circle cx="3.2" cy="-7" r="1" fill="#13233d"></circle>
{:else if type === 'sandbag'}
  <path d="M-5.5 6 C-7 1 -4.5 -3 -1 -3.6 L0 -6 L1.2 -3.6 C5 -3 7 1 5.5 6 Z" fill="#d9b26a" stroke="#7a5a22" stroke-width="1.6" stroke-linejoin="round"></path>
  <path d="M-3 2.6 q3 1.4 6 0" fill="none" stroke="#7a5a22" stroke-width="1.2" stroke-linecap="round"></path>
{:else if type === 'kindle'}
  <path d="M0 -7 C4 -2 6 1 5 4 A5 5 0 0 1 -5 4 C-6 1 -3 -1 -1.5 -4 C-1 -1 0 0 1 0.5 C1.5 -2 1 -4.5 0 -7 Z" fill="#ff9f1c" stroke="#b8600a" stroke-width="1.4" stroke-linejoin="round"></path>
  <path d="M0 1 C1.6 2.6 1.8 4 0 5.4 C-1.8 4 -1.6 2.6 0 1 Z" fill="#ffe07a"></path>
{:else if type === 'pilot'}
  <path d="M0 -8 V8 M-8 0 H8 M-5.6 -5.6 L5.6 5.6 M-5.6 5.6 L5.6 -5.6" stroke="#13233d" stroke-width="1.6" stroke-linecap="round"></path>
  <circle r="5" fill="#ffffff" stroke="#13233d" stroke-width="1.8"></circle>
  <circle r="1.6" fill="#13233d"></circle>
{:else if type === 'plan'}
  <path d="M-4 7 V-7 L5 -3.5 L-4 0" fill="#ffd66b" stroke="#13233d" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></path>
{/if}
