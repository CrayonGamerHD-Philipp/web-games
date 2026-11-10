<script>
  import Glyph from './Glyph.svelte';
  import { PALETTE, SHAPE_PATHS, SPECIAL_LABELS } from './palette.js';

  /** @type {'color' | 'number' | 'special'} */
  export let kind = 'number';
  /** Farbe, Zahl, Sonderaktion oder 'joker'. */
  /** @type {string | number | null} */
  export let face = null;
  /** @type {boolean} */
  export let selected = false;
  /** @type {boolean} */
  export let disabled = false;
  /** Vom aktiven Spieler genommen. */
  /** @type {boolean} */
  export let taken = false;
  /** @type {string} */
  export let label = '';
  /** @type {() => void} */
  export let onPick = () => {};

  /** Augen je Zahl auf einem 3×3-Raster. */
  const PIPS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  $: isJoker = face === 'joker';
  $: colorInfo = kind === 'color' && !isJoker && typeof face === 'string' ? PALETTE[face] : null;
  $: pips = kind === 'number' && typeof face === 'number' ? PIPS[/** @type {1|2|3|4|5|6} */ (face)] ?? [] : [];
  /** @type {'bomb' | 'heart' | 'stars' | 'row' | 'block' | null} */
  $: special = kind === 'special' && typeof face === 'string' ? /** @type {'bomb' | 'heart' | 'stars' | 'row' | 'block'} */ (face) : null;
</script>

<button
  type="button"
  class="kz-die kz-die--{kind}"
  class:is-joker={isJoker}
  class:is-selected={selected}
  class:is-taken={taken}
  style={colorInfo ? `--die:${colorInfo.fill};--die-ink:${colorInfo.ink}` : ''}
  {disabled}
  aria-pressed={selected}
  aria-label={label}
  on:click={onPick}
>
  {#if isJoker}
    <Glyph name="joker" size={26} />
  {:else if colorInfo}
    <svg class="kz-die-shape" viewBox="0 0 10 10" aria-hidden="true"><path d={SHAPE_PATHS[colorInfo.shape]} /></svg>
  {:else if special}
    <Glyph name={special} size={26} />
    <span class="kz-die-caption">{SPECIAL_LABELS[special]?.short}</span>
  {:else}
    <span class="kz-pips" aria-hidden="true">
      {#each Array(9) as _, index (index)}
        <span class="kz-pip" class:is-on={pips.includes(index)}></span>
      {/each}
    </span>
  {/if}
  {#if taken}<span class="kz-die-taken">genommen</span>{/if}
</button>

<style>
  .kz-die {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--die-size, 3.5rem);
    height: var(--die-size, 3.5rem);
    padding: 0;
    border: 0;
    border-radius: 14px;
    background: var(--raised);
    color: var(--text);
    box-shadow: inset 0 0 0 2px var(--control);
    cursor: pointer;
    transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
  }

  .kz-die--color {
    background: var(--die);
    color: var(--die-ink);
    box-shadow: none;
  }

  .kz-die--special {
    background: #2b2d33;
    color: #ffd36b;
    box-shadow: none;
  }

  .kz-die.is-joker {
    background: #1d1e1c;
    color: #fff;
    box-shadow: inset 0 0 0 2px #5b5d58;
  }

  .kz-die:not(:disabled):hover {
    transform: translateY(-2px);
  }

  .kz-die:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
  }

  .kz-die.is-selected {
    transform: translateY(-3px);
    box-shadow: 0 0 0 3px var(--ground), 0 0 0 6px var(--accent-main);
  }

  .kz-die:disabled {
    cursor: default;
    opacity: 0.4;
  }

  .kz-die.is-taken {
    opacity: 0.32;
  }

  .kz-die:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 3px;
  }

  .kz-die-shape {
    width: 46%;
    height: 46%;
    fill: currentColor;
    opacity: 0.85;
  }

  .kz-die-caption {
    position: absolute;
    bottom: 4px;
    font-size: 0.5625rem;
    font-weight: 700;
    color: #fff;
    opacity: 0.8;
  }

  .kz-pips {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 9%;
    width: 64%;
    height: 64%;
  }

  .kz-pip {
    border-radius: 50%;
  }

  .kz-pip.is-on {
    background: currentColor;
  }

  .kz-die-taken {
    position: absolute;
    bottom: -1.2rem;
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .kz-die {
      transition: none;
    }
  }
</style>
