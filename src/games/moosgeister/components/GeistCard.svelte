<script>
  /** @typedef {import('../types').MoosCard} MoosCard */

  /** @type {MoosCard | null} */
  export let card = null;
  /** Rückseite (Moos) zeigen. */
  export let back = false;
  /** Leiser darstellen, z. B. für abgedeckte Moos-Karten im Rückblick. */
  export let dim = false;

  const PALETTE = {
    blau: { body: '#3f7fc9', deep: '#1f4f8c', tint: '#e3eefa' },
    gruen: { body: '#4f9a58', deep: '#2a6334', tint: '#e5f3e3' },
    gelb: { body: '#e6b53a', deep: '#9b6f0c', tint: '#fbf2d6' },
    rot: { body: '#d0545b', deep: '#8c262f', tint: '#f8e2e1' },
    bunt: { body: 'url(#mg-bunt)', deep: '#5b4a3a', tint: '#f4eee4' }
  };

  const uid = Math.random().toString(36).slice(2, 8);

  $: colors = card ? PALETTE[card.color] : PALETTE.gruen;
  $: symbols = card ? [...Array(card.spirals).fill('s'), ...Array(card.crosses).fill('x')] : [];
</script>

<svg class="geist-card" class:is-dim={dim} viewBox="0 0 100 140" aria-hidden="true">
  <defs>
    <linearGradient id="mg-bunt-{uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3f7fc9" />
      <stop offset="0.35" stop-color="#4f9a58" />
      <stop offset="0.65" stop-color="#e6b53a" />
      <stop offset="1" stop-color="#d0545b" />
    </linearGradient>
    <pattern id="mg-moss-{uid}" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="4" r="2.4" fill="#6f9a3e" />
      <circle cx="10" cy="9" r="3" fill="#5a8532" />
      <circle cx="11" cy="2" r="1.4" fill="#8fb556" />
      <circle cx="4" cy="12" r="1.6" fill="#86ad4d" />
    </pattern>
  </defs>

  {#if back || !card}
    <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#4b7029" stroke="#2f4a18" stroke-width="2" />
    <rect x="7" y="7" width="86" height="126" rx="7" fill="url(#mg-moss-{uid})" />
    <path d="M38 92 q12 -30 24 0" fill="none" stroke="#c9dd9a" stroke-width="3" stroke-linecap="round" />
    <path d="M50 92 v-26 M50 74 q-9 -4 -10 -12 M50 70 q9 -5 10 -13" fill="none" stroke="#c9dd9a" stroke-width="3" stroke-linecap="round" />
  {:else}
    {@const fill = card.color === 'bunt' ? `url(#mg-bunt-${uid})` : colors.body}
    <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill={colors.tint} stroke={colors.deep} stroke-width="2" />
    <!-- Zahl -->
    <circle cx="17" cy="17" r="11" fill={fill} stroke={colors.deep} stroke-width="1.5" />
    <text x="17" y="22" text-anchor="middle" class="geist-num">{card.number}</text>
    <!-- Waldgeist: Tropfenkörper mit Blatt -->
    <g transform="translate(50 64)">
      <path d="M0 -30 C 20 -30 26 -8 26 10 C 26 22 18 30 0 30 C -18 30 -26 22 -26 10 C -26 -8 -20 -30 0 -30 Z" fill={fill} stroke={colors.deep} stroke-width="2" />
      <path d="M0 -30 q 4 -12 16 -14 q -2 12 -16 14 Z" fill="#6fae43" stroke="#3d6b22" stroke-width="1.5" />
      <ellipse cx="-9" cy="2" rx="4.2" ry="5.2" fill="#fff" />
      <ellipse cx="9" cy="2" rx="4.2" ry="5.2" fill="#fff" />
      <circle cx="-8.2" cy="3.2" r="2.3" fill="#25201b" />
      <circle cx="9.8" cy="3.2" r="2.3" fill="#25201b" />
      <path d="M-5 13 q5 4 10 0" fill="none" stroke="#25201b" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="-15" cy="11" r="3" fill="#fff" opacity="0.35" />
      <circle cx="15" cy="11" r="3" fill="#fff" opacity="0.35" />
    </g>
    <!-- Symbole -->
    {#if card.bonus}
      {@const bonusColor = PALETTE[card.bonus]}
      <rect x="20" y="106" width="60" height="24" rx="12" fill="#fff" stroke={colors.deep} stroke-width="1.5" />
      <text x="38" y="123" text-anchor="middle" class="geist-bonus">+1</text>
      <path d="M62 108 C 70 108 72 116 72 121 C 72 126 68 128 62 128 C 56 128 52 126 52 121 C 52 116 54 108 62 108 Z" fill={bonusColor.body} stroke={bonusColor.deep} stroke-width="1.5" />
    {:else}
      {#each symbols as symbol, index (index)}
        {@const x = 50 + (index - (symbols.length - 1) / 2) * 20}
        <circle cx={x} cy="118" r="9" fill="#fff" stroke={symbol === 's' ? '#2a6334' : '#8c262f'} stroke-width="1.5" />
        {#if symbol === 's'}
          <path d="M{x} 118 m0 0 a1.6 1.6 0 0 1 3.2 0 a3.2 3.2 0 0 1 -6.4 0 a4.8 4.8 0 0 1 9.6 0" fill="none" stroke="#2a6334" stroke-width="1.8" stroke-linecap="round" />
        {:else}
          <path d="M{x - 4} 114 l8 8 M{x + 4} 114 l-8 8" stroke="#8c262f" stroke-width="2.2" stroke-linecap="round" />
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
    font: 800 15px/1 system-ui, sans-serif;
    fill: #fff;
    paint-order: stroke;
    stroke: rgb(0 0 0 / 0.35);
    stroke-width: 2px;
  }

  .geist-bonus {
    font: 800 13px/1 system-ui, sans-serif;
    fill: #2b2620;
  }
</style>
