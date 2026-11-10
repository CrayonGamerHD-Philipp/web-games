<svelte:options namespace="svg" />

<script>
  /**
   * Ein Schiff von oben, Bug nach rechts, mit Gesicht auf der Kajüte – im Stil der Moosgeister.
   * Zeichnet in ein viewBox von `length × 100` mal 100 Einheiten (ein Feld = 100).
   */

  /** @type {'schlachtschiff' | 'kreuzer' | 'zerstoerer' | 'u-boot'} */
  export let type = 'zerstoerer';
  /** @type {number} */
  export let length = 3;
  /** @type {boolean} */
  export let sunk = false;

  const COLORS = {
    schlachtschiff: { hull: '#e25a4f', deep: '#8c262f', deck: '#f8e6cf', accent: '#f2b530' },
    kreuzer: { hull: '#f2b530', deep: '#8a610a', deck: '#fff2cf', accent: '#e25a4f' },
    zerstoerer: { hull: '#4fb08a', deep: '#1f6b4f', deck: '#e3f5ea', accent: '#f2b530' },
    'u-boot': { hull: '#6b7fd6', deep: '#2f3d8c', deck: '#dfe5fb', accent: '#f2b530' }
  };

  $: W = length * 100;
  $: c = COLORS[type] ?? COLORS.zerstoerer;
  $: hull = type === 'u-boot'
    ? `M40 24 L${W - 56} 24 C${W - 24} 24 ${W - 8} 38 ${W - 8} 50 C${W - 8} 62 ${W - 24} 76 ${W - 56} 76 L40 76 C20 76 8 64 8 50 C8 36 20 24 40 24 Z`
    : `M20 20 Q8 20 8 32 L8 68 Q8 80 20 80 L${W - 74} 80 C${W - 34} 80 ${W - 12} 66 ${W - 4} 50 C${W - 12} 34 ${W - 34} 20 ${W - 74} 20 Z`;
  $: deck = type === 'u-boot'
    ? `M44 34 L${W - 58} 34 C${W - 36} 34 ${W - 22} 42 ${W - 22} 50 C${W - 22} 58 ${W - 36} 66 ${W - 58} 66 L44 66 C30 66 22 58 22 50 C22 42 30 34 44 34 Z`
    : `M26 31 Q18 31 18 39 L18 61 Q18 69 26 69 L${W - 78} 69 C${W - 46} 69 ${W - 28} 60 ${W - 20} 50 C${W - 28} 40 ${W - 46} 31 ${W - 78} 31 Z`;
  /** Mitte der Kajüte mit Gesicht. */
  $: cabin = type === 'u-boot' ? 92 : type === 'zerstoerer' ? 150 : W - 140;
</script>

<g class="ship" class:is-sunk={sunk}>
  <!-- Bugwelle -->
  {#if !sunk}
    <path d="M{W - 30} 22 q14 10 24 28 q-10 18 -24 28" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.75" />
    <path d="M14 26 q-8 24 0 48" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.55" />
  {/if}

  <path d={hull} fill={c.hull} stroke={c.deep} stroke-width="5" stroke-linejoin="round" />
  <path d={deck} fill={c.deck} />
  <path d="M30 38 L{W - 90} 38" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.5" />

  {#if type === 'schlachtschiff'}
    <!-- zwei Geschütztürme -->
    {#each [70, 170] as x (x)}
      <path d="M{x + 10} 50 L{x + 46} 50" stroke={c.deep} stroke-width="7" stroke-linecap="round" />
      <circle cx={x} cy="50" r="17" fill={c.hull} stroke={c.deep} stroke-width="4" />
      <circle cx={x - 4} cy="45" r="5" fill="#ffffff" opacity="0.45" />
    {/each}
    <!-- Wimpel -->
    <path d="M{W - 60} 50 L{W - 60} 30" stroke={c.deep} stroke-width="3" stroke-linecap="round" />
    <path d="M{W - 60} 30 L{W - 40} 35 L{W - 60} 40 Z" fill={c.accent} stroke={c.deep} stroke-width="2" stroke-linejoin="round" />
  {:else if type === 'kreuzer'}
    <path d="M70 50 L104 50" stroke={c.deep} stroke-width="7" stroke-linecap="round" />
    <circle cx="62" cy="50" r="16" fill={c.hull} stroke={c.deep} stroke-width="4" />
    <circle cx="140" cy="50" r="15" fill="#5a4a3a" stroke="#2e241b" stroke-width="4" />
    <circle cx="140" cy="50" r="7" fill="#2e241b" />
    {#if !sunk}
      <circle cx="122" cy="34" r="9" fill="#ffffff" opacity="0.85" />
      <circle cx="108" cy="28" r="7" fill="#ffffff" opacity="0.7" />
      <circle cx="96" cy="24" r="5" fill="#ffffff" opacity="0.55" />
    {/if}
    <circle cx="{W - 66}" cy="62" r="7" fill="none" stroke={c.accent} stroke-width="4" />
  {:else if type === 'zerstoerer'}
    <circle cx="70" cy="50" r="15" fill="#5a4a3a" stroke="#2e241b" stroke-width="4" />
    <circle cx="70" cy="50" r="7" fill="#2e241b" />
    {#if !sunk}
      <circle cx="52" cy="34" r="9" fill="#ffffff" opacity="0.85" />
      <circle cx="38" cy="28" r="7" fill="#ffffff" opacity="0.7" />
    {/if}
  {:else}
    <!-- U-Boot: Bullaugen und Periskop -->
    <circle cx="44" cy="50" r="6" fill="#bfe0ff" stroke={c.deep} stroke-width="3" />
    <circle cx="142" cy="50" r="6" fill="#bfe0ff" stroke={c.deep} stroke-width="3" />
    <path d="M92 30 L92 14 L104 14" fill="none" stroke={c.deep} stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  {/if}

  <!-- Kajüte mit Gesicht -->
  {#if type === 'u-boot'}
    <circle cx={cabin} cy="50" r="22" fill={c.hull} stroke={c.deep} stroke-width="4" />
  {:else}
    <rect x={cabin - 30} y="32" width="60" height="36" rx="12" fill="#ffffff" stroke={c.deep} stroke-width="4" />
  {/if}
  {#if sunk}
    <path d="M{cabin - 15} 41 l8 8 M{cabin - 7} 41 l-8 8 M{cabin + 7} 41 l8 8 M{cabin + 15} 41 l-8 8" stroke="#2b1d16" stroke-width="3" stroke-linecap="round" />
    <path d="M{cabin - 8} 60 q4 -4 8 0 q4 4 8 0" fill="none" stroke="#2b1d16" stroke-width="2.6" stroke-linecap="round" />
  {:else}
    <ellipse cx={cabin - 11} cy="46" rx="5" ry="6.5" fill="#2b1d16" />
    <ellipse cx={cabin + 11} cy="46" rx="5" ry="6.5" fill="#2b1d16" />
    <circle cx={cabin - 9} cy="43.5" r="2" fill="#ffffff" />
    <circle cx={cabin + 13} cy="43.5" r="2" fill="#ffffff" />
    <ellipse cx={cabin - 21} cy="56" rx="5" ry="3" fill="#f08a8a" opacity="0.8" />
    <ellipse cx={cabin + 21} cy="56" rx="5" ry="3" fill="#f08a8a" opacity="0.8" />
    <path d="M{cabin - 5} 57 Q{cabin} 62 {cabin + 5} 57" fill="none" stroke="#2b1d16" stroke-width="2.6" stroke-linecap="round" />
  {/if}

  {#if sunk}
    <!-- Blubberblasen -->
    <circle cx="{W - 40}" cy="20" r="6" fill="#ffffff" stroke="#5a7a90" stroke-width="2" opacity="0.9" />
    <circle cx="{W - 24}" cy="34" r="4" fill="#ffffff" stroke="#5a7a90" stroke-width="2" opacity="0.9" />
    <circle cx="30" cy="80" r="5" fill="#ffffff" stroke="#5a7a90" stroke-width="2" opacity="0.9" />
  {/if}
</g>

<style>
  .ship.is-sunk {
    filter: grayscale(0.75) brightness(0.82);
  }
</style>
