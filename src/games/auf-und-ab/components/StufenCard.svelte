<script>
  /** @typedef {import('../types').AufCard} AufCard */

  /** @type {AufCard | null} */
  export let card = null;
  /** Rückseite zeigen. */
  export let back = false;
  /** Gezählter Wert, z. B. bei einem Joker auf dem Baustapel. */
  /** @type {number | null} */
  export let countsAs = null;
  /** @type {string | number | null} */
  export let badge = null;

  const TIERS = {
    low: { fill: '#2f6fbf', deep: '#1c4a85', tint: '#e5effb' },
    mid: { fill: '#3f9150', deep: '#245e31', tint: '#e5f3e6' },
    high: { fill: '#cc4a52', deep: '#8a2a31', tint: '#f9e4e4' },
    joker: { fill: '#e0a526', deep: '#8f6406', tint: '#fdf3d9' }
  };

  $: value = card?.value ?? null;
  /** @type {'low' | 'mid' | 'high' | 'joker'} */
  $: tier = value === null ? 'joker' : value <= 4 ? 'low' : value <= 8 ? 'mid' : 'high';
  $: colors = TIERS[tier];
</script>

<span class="stufen-card">
  <svg viewBox="0 0 100 140" aria-hidden="true">
    {#if back || !card}
      <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="#2c3448" stroke="#1a2030" stroke-width="2" />
      <rect x="8" y="8" width="84" height="124" rx="7" fill="none" stroke="#56627f" stroke-width="1.5" />
      <path d="M36 62 L50 44 L64 62" fill="none" stroke="#8fa0c6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M36 78 L50 96 L64 78" fill="none" stroke="#c78f8f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
    {:else}
      <rect x="1.5" y="1.5" width="97" height="137" rx="10" fill={colors.tint} stroke={colors.deep} stroke-width="2" />
      <rect x="8" y="8" width="84" height="124" rx="7" fill={colors.fill} />
      {#if value === null}
        <path d="M30 54 L50 32 L70 54" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M30 82 L50 104 L70 82" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
        <text x="50" y="76" text-anchor="middle" class="stufen-joker">JOKER</text>
      {:else}
        <circle cx="50" cy="70" r="31" fill="#fff" />
        <text x="50" y={value >= 10 ? 83 : 85} text-anchor="middle" class="stufen-num" class:is-wide={value >= 10} fill={colors.deep}>{value}</text>
        <text x="17" y="25" text-anchor="middle" class="stufen-corner">{value}</text>
        <text x="83" y="125" text-anchor="middle" class="stufen-corner" transform="rotate(180 83 120)">{value}</text>
      {/if}
      {#if countsAs !== null && value === null}
        <rect x="30" y="112" width="40" height="20" rx="10" fill="#fff" />
        <text x="50" y="127" text-anchor="middle" class="stufen-counts" fill={colors.deep}>= {countsAs}</text>
      {/if}
    {/if}
  </svg>
  {#if badge !== null}<span class="stufen-badge ui-num">{badge}</span>{/if}
</span>

<style>
  .stufen-card {
    position: relative;
    display: block;
    width: 100%;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.2));
  }

  .stufen-num {
    font: 800 44px/1 system-ui, sans-serif;
  }

  .stufen-num.is-wide {
    font-size: 38px;
    letter-spacing: -1px;
  }

  .stufen-corner {
    font: 800 15px/1 system-ui, sans-serif;
    fill: #fff;
  }

  .stufen-joker {
    font: 800 15px/1 system-ui, sans-serif;
    fill: #fff;
    letter-spacing: 1px;
  }

  .stufen-counts {
    font: 800 13px/1 system-ui, sans-serif;
  }

  .stufen-badge {
    position: absolute;
    right: -6px;
    top: -6px;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--accent-main);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 24px;
    text-align: center;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
  }
</style>
