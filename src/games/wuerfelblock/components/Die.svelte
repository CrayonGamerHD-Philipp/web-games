<script>
  /** Face value 1–6; 0 = not rolled yet. */
  /** @type {number} */
  export let value = 0;
  /** @type {boolean} */
  export let held = false;
  /** @type {boolean} */
  export let interactive = false;
  /** @type {boolean} */
  export let disabled = false;
  /** Shaking while a roll request is on its way. */
  /** @type {boolean} */
  export let shaking = false;
  /** Play the landing animation (die was rolled, not held, in the last roll). */
  /** @type {boolean} */
  export let landing = false;
  /** Changes whenever the die lands with a new roll (drives the landing animation). */
  /** @type {number | string} */
  export let landKey = 0;
  /** @type {number} */
  export let index = 0;
  /** @type {(index: number) => void} */
  export let onToggle = () => {};

  /** @type {Record<number, [number, number][]>} */
  const PIPS = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]]
  };

  $: pips = PIPS[value] ?? [];
  $: label = value ? `Würfel ${index + 1}: ${value}${held ? ', gehalten' : ''}` : `Würfel ${index + 1}: noch nicht gewürfelt`;
</script>

<div class="wb-die-slot" class:is-held={held}>
  {#if interactive}
    <button
      type="button"
      class="wb-die"
      class:is-held={held}
      class:is-empty={!value}
      class:is-shaking={shaking && !held}
      aria-pressed={held}
      aria-label={disabled ? label : `${label}. ${held ? 'Tippen zum Freigeben' : 'Tippen zum Halten'}`}
      {disabled}
      on:click={() => onToggle(index)}
    >
      {#key landKey}
        <svg class="wb-face" class:is-landing={landing && Boolean(value)} viewBox="0 0 100 100" aria-hidden="true">
          <rect class="wb-body" x="3" y="3" width="94" height="94" rx="20" />
          {#each pips as [cx, cy]}
            <circle class="wb-pip" {cx} {cy} r="9.5" />
          {/each}
        </svg>
      {/key}
    </button>
  {:else}
    <span class="wb-die" class:is-held={held} class:is-empty={!value} class:is-shaking={shaking && !held} role="img" aria-label={label}>
      {#key landKey}
        <svg class="wb-face" class:is-landing={landing && Boolean(value)} viewBox="0 0 100 100" aria-hidden="true">
          <rect class="wb-body" x="3" y="3" width="94" height="94" rx="20" />
          {#each pips as [cx, cy]}
            <circle class="wb-pip" {cx} {cy} r="9.5" />
          {/each}
        </svg>
      {/key}
    </span>
  {/if}
  <span class="wb-held-tag" aria-hidden="true">
    {#if held}
      <svg viewBox="0 0 16 16" class="wb-lock"><rect x="3" y="7" width="10" height="7.5" rx="1.6" fill="currentColor" /><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7" fill="none" stroke="currentColor" stroke-width="1.7" /></svg>
      gehalten
    {/if}
  </span>
</div>

<style>
  .wb-die-slot {
    display: grid;
    justify-items: center;
    gap: 4px;
    min-width: 0;
  }

  .wb-die {
    --wb-die-bg: #fbfaf5;
    --wb-die-edge: #cfcabb;
    --wb-pip: #1f2321;

    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    border-radius: 22%;
    background: transparent;
    color: inherit;
    cursor: default;
    transform: translateY(0);
    transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  button.wb-die {
    cursor: pointer;
  }

  button.wb-die:disabled {
    cursor: default;
  }

  .wb-face {
    display: block;
    width: 100%;
    height: 100%;
  }

  .wb-body {
    fill: var(--wb-die-bg);
    stroke: var(--wb-die-edge);
    stroke-width: 3;
  }

  .wb-pip {
    fill: var(--wb-pip);
  }

  .wb-die.is-empty .wb-body {
    fill: transparent;
    stroke: var(--control);
    stroke-dasharray: 9 7;
  }

  /* Gehalten: angehoben, Akzent-Rand und Schloss-Label (nicht nur Farbe). */
  .wb-die.is-held {
    transform: translateY(-8px);
  }

  .wb-die.is-held .wb-body {
    stroke: var(--accent-main);
    stroke-width: 7;
  }

  .wb-held-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-height: 18px;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1;
    color: var(--accent-text, var(--accent-main));
    white-space: nowrap;
  }

  .wb-lock {
    width: 11px;
    height: 11px;
    flex-shrink: 0;
  }

  button.wb-die:active:not(:disabled) {
    transform: translateY(0) scale(0.95);
  }

  button.wb-die.is-held:active:not(:disabled) {
    transform: translateY(-8px) scale(0.95);
  }

  button.wb-die:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: 3px;
  }

  .wb-die.is-shaking .wb-face {
    animation: wb-shake 140ms linear infinite alternate;
  }

  .wb-face.is-landing {
    animation: wb-land 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @keyframes wb-shake {
    from { transform: rotate(-7deg) translateY(1px); }
    to { transform: rotate(7deg) translateY(-1px); }
  }

  @keyframes wb-land {
    0% { transform: rotate(-18deg) scale(0.82); }
    100% { transform: rotate(0) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .wb-die,
    .wb-die.is-held {
      transition: none;
    }

    .wb-die.is-shaking .wb-face,
    .wb-face.is-landing {
      animation: none;
    }
  }
</style>
