<script>
  import { createEventDispatcher } from 'svelte';

  /** @type {number | null} */
  export let value = null;
  /** Card shows its back. */
  /** @type {boolean} */
  export let hidden = false;
  /** Slot is empty (cleared column/row). */
  /** @type {boolean} */
  export let removed = false;
  /** Card is picked up / active. */
  /** @type {boolean} */
  export let selected = false;
  /** Card cannot be activated. */
  /** @type {boolean} */
  export let disabled = false;
  /** @type {boolean} */
  export let draggable = false;
  /** Card is a valid target for the current action. */
  /** @type {boolean} */
  export let dropTarget = false;
  /** @type {string} */
  export let label = 'Karte';
  /** Kept for API compatibility; the card always fills its parent's width. */
  /** @type {'xs' | 'sm' | 'md'} */
  export let size = 'md';
  /** @type {number} */
  export let revealDelayMs = 0;
  /** Optional small badge (e.g. deck count). */
  /** @type {string | number | null} */
  export let badge = null;

  const dispatch = createEventDispatcher();

  $: tone = value === null
    ? 'none'
    : value < 0
      ? 'neg'
      : value === 0
        ? 'zero'
        : value <= 4
          ? 'low'
          : value <= 8
            ? 'mid'
            : 'high';
  $: ambiguous = value === 6 || value === 9;
  $: accessibleLabel = removed
    ? `${label}: abgeräumt`
    : hidden
      ? `${label}: verdeckt`
      : value === null
        ? label
        : `${label}: ${value}`;

  /** @param {MouseEvent} event */
  function handleClick(event) {
    if (disabled || removed) return;
    dispatch('activate', event);
  }
</script>

<button
  type="button"
  class="pc pc--{size}"
  class:is-hidden={hidden}
  class:is-removed={removed}
  class:is-selected={selected}
  class:is-target={dropTarget && !removed}
  class:is-disabled={disabled}
  aria-disabled={disabled || removed}
  aria-pressed={selected ? 'true' : undefined}
  tabindex={disabled || removed ? -1 : 0}
  draggable={draggable && !disabled && !removed}
  aria-label={accessibleLabel}
  style={`--pc-delay: ${revealDelayMs}ms`}
  on:click={handleClick}
  on:dragstart
  on:dragover
  on:dragenter
  on:dragleave
  on:drop
  on:dragend
>
  {#if removed}
    <span class="pc-empty" aria-hidden="true"></span>
  {:else}
    <span class="pc-lift">
      <span class="pc-inner">
        <span class="pc-face pc-front" data-tone={tone} aria-hidden="true">
          {#if value !== null}
            <span class="pc-corner pc-corner--tl" class:is-ambiguous={ambiguous}>{value}</span>
            <span class="pc-oval">
              <span class="pc-num" class:is-ambiguous={ambiguous}>{value}</span>
            </span>
            <span class="pc-corner pc-corner--br" class:is-ambiguous={ambiguous}>{value}</span>
          {/if}
        </span>
        <span class="pc-face pc-back" aria-hidden="true">
          <span class="pc-back-frame"></span>
          <span class="pc-back-mark"></span>
        </span>
      </span>
    </span>
  {/if}
  {#if badge !== null && badge !== undefined}
    <span class="pc-badge" aria-hidden="true">{badge}</span>
  {/if}
</button>

<style>
  .pc {
    --pc-radius: clamp(5px, 9cqw, 12px);
    --pc-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --pc-ring: var(--accent-main, #1b6e66);

    position: relative;
    display: block;
    width: 100%;
    min-width: 0;
    aspect-ratio: 5 / 7;
    padding: 0;
    margin: 0;
    border: 0;
    background: transparent;
    border-radius: 10px;
    border-radius: var(--pc-radius);
    container-type: inline-size;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
    font-variant-numeric: tabular-nums;
  }

  .pc.is-disabled,
  .pc.is-removed {
    cursor: default;
  }

  /* Lift layer: hover / selection movement lives here, never on the faces,
     so it cannot clobber the flip rotation. */
  .pc-lift {
    position: absolute;
    inset: 0;
    display: block;
    border-radius: inherit;
    transition: transform 180ms var(--pc-ease);
    perspective: 900px;
  }

  .pc-inner {
    position: absolute;
    inset: 0;
    display: block;
    border-radius: inherit;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    transform: rotateY(0deg);
    transition: transform 520ms var(--pc-ease);
    transition-delay: var(--pc-delay, 0ms);
  }

  .pc.is-hidden .pc-inner {
    transform: rotateY(180deg);
  }

  .pc-face {
    position: absolute;
    inset: 0;
    display: block;
    overflow: hidden;
    border-radius: inherit;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    /* Ruhend nur eine feine Kante, kein Schatten (DESIGN.md). */
    box-shadow: 0 0 0 1px rgb(15 23 42 / 0.16);
    transition: box-shadow 180ms ease;
  }

  /* ---------- Front ---------- */
  .pc-front {
    transform: rotateY(0deg) translateZ(0.5px);
    background: #f4f1ea;
    color: #fff;
  }

  .pc-front[data-tone='neg'] { --tone: #2f3fb3; --tone-ink: #1e2a80; }
  .pc-front[data-tone='zero'] { --tone: #2aa7d9; --tone-ink: #0d6f97; }
  .pc-front[data-tone='low'] { --tone: #2f9e57; --tone-ink: #1d6b3a; }
  .pc-front[data-tone='mid'] { --tone: #f0c331; --tone-ink: #7a5a00; }
  .pc-front[data-tone='high'] { --tone: #dc4646; --tone-ink: #9c1f24; }
  .pc-front[data-tone='none'] { --tone: #e2ddd2; --tone-ink: #8a8478; }

  .pc-front:not([data-tone='none']) {
    background: var(--tone);
  }

  /* Inset paper frame so every colour still reads as a card. */
  .pc-front::before {
    content: '';
    position: absolute;
    inset: 5cqw;
    border-radius: calc(var(--pc-radius) * 0.7);
    border: max(1px, 1.6cqw) solid rgb(255 255 255 / 0.45);
    pointer-events: none;
  }

  .pc-front[data-tone='mid'] {
    color: #3f2f00;
  }

  .pc-oval {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 64%;
    height: 52%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #fffdf8;
    box-shadow: inset 0 0 0 max(1px, 1.4cqw) rgb(0 0 0 / 0.08);
  }

  .pc-num {
    font-size: 1.6rem;
    font-size: 40cqw;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
    color: var(--tone-ink);
  }

  .pc-corner {
    position: absolute;
    font-size: 0.7rem;
    font-size: 15cqw;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .pc-corner--tl {
    left: 10cqw;
    top: 9cqw;
  }

  .pc-corner--br {
    right: 10cqw;
    bottom: 9cqw;
    transform: rotate(180deg);
  }

  .is-ambiguous {
    text-decoration: underline;
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.08em;
  }

  /* ---------- Back ---------- */
  .pc-back {
    transform: rotateY(180deg) translateZ(0.5px);
    background-color: #17233b;
    background-image:
      repeating-linear-gradient(45deg, rgb(255 255 255 / 0.07) 0 2px, transparent 2px 9px),
      repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.07) 0 2px, transparent 2px 9px);
  }

  .pc-back-frame {
    position: absolute;
    inset: 6cqw;
    border-radius: calc(var(--pc-radius) * 0.7);
    border: max(1px, 1.6cqw) solid var(--pc-ring);
    opacity: 0.85;
  }

  .pc-back-mark {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 30cqw;
    height: 30cqw;
    border-radius: 18%;
    background: var(--pc-ring);
    transform: translate(-50%, -50%) rotate(45deg);
    box-shadow: 0 0 0 max(2px, 3cqw) #17233b, 0 0 0 max(3px, 4.6cqw) rgb(255 255 255 / 0.35);
  }

  /* ---------- Empty slot ---------- */
  .pc-empty {
    position: absolute;
    inset: 0;
    display: block;
    border-radius: inherit;
    border: 2px dashed var(--control, #d9d9d6);
    background: transparent;
  }

  /* ---------- Badge ---------- */
  .pc-badge {
    position: absolute;
    right: -6px;
    top: -6px;
    z-index: 2;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--text, #1f201d);
    color: var(--ground, #fff);
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    box-shadow: 0 0 0 2px var(--surface, #f6f6f4);
  }

  /* ---------- States ---------- */
  .pc.is-selected .pc-lift {
    transform: translateY(-7%);
  }

  .pc.is-selected .pc-face {
    box-shadow:
      0 0 0 3px var(--pc-ring),
      0 10px 20px -8px rgb(15 23 42 / 0.45);
  }

  .pc.is-target .pc-lift::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: calc(var(--pc-radius) + 4px);
    border: 2px dashed var(--pc-ring);
    pointer-events: none;
    animation: pc-target 1.4s ease-in-out infinite;
  }

  .pc:focus-visible .pc-face,
  .pc:focus-visible .pc-empty {
    box-shadow: 0 0 0 2px var(--ground, #fff), 0 0 0 4px var(--pc-ring);
  }

  @media (hover: hover) and (pointer: fine) {
    .pc:not(.is-disabled):not(.is-removed):hover .pc-lift {
      transform: translateY(-4%);
    }

    .pc.is-selected:not(.is-disabled):hover .pc-lift {
      transform: translateY(-8%);
    }

    .pc:not(.is-disabled):not(.is-removed):hover .pc-face {
      box-shadow:
        0 0 0 1px rgb(15 23 42 / 0.18),
        0 10px 18px -8px rgb(15 23 42 / 0.45);
    }

    .pc.is-selected:not(.is-disabled):hover .pc-face {
      box-shadow:
        0 0 0 3px var(--pc-ring),
        0 12px 22px -8px rgb(15 23 42 / 0.5);
    }
  }

  .pc:not(.is-disabled):not(.is-removed):active .pc-lift {
    transform: translateY(0) scale(0.97);
    transition-duration: 80ms;
  }

  @keyframes pc-target {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }

  /* Tiny cards (opponent boards): drop the corner indices. */
  @container (max-width: 46px) {
    .pc-corner { display: none; }
    .pc-oval { width: 78%; height: 58%; }
    .pc-num { font-size: 46cqw; }
    .pc-front::before { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pc-inner { transition-duration: 1ms; transition-delay: 0ms; }
    .pc-lift { transition: none; }
    .pc.is-target .pc-lift::after { animation: none; }
  }
</style>
