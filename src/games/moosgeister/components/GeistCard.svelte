<script>
  import Spirit from './Spirit.svelte';
  import { MOOS_COLOR_NAMES, spiritOf } from '../rules.js';

  /** @typedef {import('../types').MoosCard} MoosCard */

  /** @type {MoosCard | null} */
  export let card = null;
  /** Rückseite (Moos) zeigen. */
  export let back = false;
  /** Leiser darstellen, z. B. für abgedeckte Moos-Karten im Rückblick. */
  export let dim = false;

  /** Kartenfarben: Grund, Umriss und Zahlenkreis. */
  const PALETTE = {
    blau: { tint: '#e3eefa', deep: '#1f4f8c', badge: '#5b9fe0', ground: '#a9cfe8' },
    gruen: { tint: '#e5f3e3', deep: '#2a6334', badge: '#4f9a58', ground: '#9ccc72' },
    gelb: { tint: '#fbf2d6', deep: '#9b6f0c', badge: '#e6b53a', ground: '#9ccc72' },
    rot: { tint: '#f8e2e1', deep: '#8c262f', badge: '#d0545b', ground: '#9ccc72' },
    bunt: { tint: '#f4eee4', deep: '#5b4a3a', badge: '#7a6a58', ground: '#9ccc72' }
  };

  /** Farbe des kleinen Tropfens im Farbbonus. */
  const BONUS = {
    blau: { fill: '#5b9fe0', deep: '#1f4f8c' },
    gruen: { fill: '#6cb552', deep: '#2a6334' },
    gelb: { fill: '#e6b53a', deep: '#9b6f0c' },
    rot: { fill: '#d9443e', deep: '#8c262f' }
  };

  $: colors = card ? PALETTE[card.color] : PALETTE.gruen;
  $: spirit = card ? spiritOf(card) : null;
  $: symbols = card ? [...Array(card.spirals).fill('s'), ...Array(card.crosses).fill('x')] : [];
  $: symbolStart = 100 - (symbols.length * 38 - 2) / 2;
  $: bonus = card?.bonus ? BONUS[card.bonus] : null;
</script>

<svg class="geist-card" class:is-dim={dim} viewBox="0 0 200 280" aria-hidden="true">
  {#if back || !card}
    <Spirit name="moos" />
  {:else}
    <rect x="4" y="4" width="192" height="272" rx="20" fill={colors.tint} stroke={colors.deep} stroke-width="5" />
    <path d="M14 200 Q100 186 186 200 L186 218 Q100 210 14 218 Z" fill={colors.ground} opacity="0.55" />
    {#if spirit}<Spirit name={spirit.id} />{/if}

    <circle cx="38" cy="38" r="22" fill={colors.badge} stroke={colors.deep} stroke-width="4" />
    {#if card.color === 'bunt'}
      <path d="M18 30 A22 22 0 0 1 30 18" fill="none" stroke="#5b9fe0" stroke-width="4" />
      <path d="M46 18 A22 22 0 0 1 58 30" fill="none" stroke="#6cb552" stroke-width="4" />
      <path d="M58 46 A22 22 0 0 1 46 58" fill="none" stroke="#f2b530" stroke-width="4" />
      <path d="M30 58 A22 22 0 0 1 18 46" fill="none" stroke="#d9443e" stroke-width="4" />
    {/if}
    <text x="38" y="47" text-anchor="middle" class="geist-num">{card.number}</text>

    {#if bonus && card.bonus}
      <rect x="44" y="228" width="112" height="36" rx="18" fill="#ffffff" stroke={colors.deep} stroke-width="2.5" />
      <text x="80" y="253" text-anchor="middle" class="geist-bonus">+1 je</text>
      <path
        d="M128 232 C137 232 140 241 140 247 C140 254 135 258 128 258 C121 258 116 254 116 247 C116 241 119 232 128 232 Z"
        fill={bonus.fill}
        stroke={bonus.deep}
        stroke-width="2"
      />
      <title>+1 je {MOOS_COLOR_NAMES[card.bonus]}</title>
    {:else}
      {#each symbols as symbol, index (index)}
        {@const x = symbolStart + index * 38 + 18}
        {#if symbol === 's'}
          <circle cx={x} cy="246" r="15" fill="#ffffff" stroke="#2a6334" stroke-width="2.5" />
          <path
            d="M{x} 246 a2.6 2.6 0 0 1 5.2 0 a5.2 5.2 0 0 1 -10.4 0 a7.8 7.8 0 0 1 15.6 0"
            fill="none"
            stroke="#2a6334"
            stroke-width="2.6"
            stroke-linecap="round"
          />
        {:else}
          <circle cx={x} cy="246" r="15" fill="#ffffff" stroke="#8c262f" stroke-width="2.5" />
          <path d="M{x - 6} 240 L{x + 6} 252 M{x + 6} 240 L{x - 6} 252" stroke="#8c262f" stroke-width="3.4" stroke-linecap="round" />
        {/if}
      {/each}
    {/if}
  {/if}
</svg>

<style>
  .geist-card {
    display: block;
    width: 100%;
    height: auto;
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.18));
  }

  .geist-card.is-dim {
    opacity: 0.55;
  }

  .geist-num {
    font: 800 26px/1 system-ui, sans-serif;
    fill: #fff;
    paint-order: stroke;
    stroke: rgb(0 0 0 / 0.25);
    stroke-width: 2px;
  }

  .geist-bonus {
    font: 800 20px/1 system-ui, sans-serif;
    fill: #2b2620;
  }
</style>
