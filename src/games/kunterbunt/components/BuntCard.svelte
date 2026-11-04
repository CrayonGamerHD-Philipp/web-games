<script>
  import { createEventDispatcher } from 'svelte';
  import BuntMark from './BuntMark.svelte';
  import { BUNT_COLOR_NAMES, buntCardName, isBuntNumber } from '../rules.js';

  /** @typedef {import('../types').BuntCard} BuntCard */

  /** @type {BuntCard | null} */
  export let card = null;
  /** Show the back instead of the face (draw pile, opponents). */
  /** @type {boolean} */
  export let faceDown = false;
  /** Card may be played right now (raised + ring). */
  /** @type {boolean} */
  export let playable = false;
  /** Card is picked (e.g. a wish card waiting for a colour). */
  /** @type {boolean} */
  export let selected = false;
  /** It is your turn but this card does not fit (dimmed). */
  /** @type {boolean} */
  export let dimmed = false;
  /** Card cannot be activated. */
  /** @type {boolean} */
  export let disabled = false;
  /** Render as a button (true) or as a decorative element (false). */
  /** @type {boolean} */
  export let interactive = true;
  /** Small marker, e.g. the deck count or „Neu“. */
  /** @type {string | number | null} */
  export let badge = null;
  /** Accessible label override. */
  /** @type {string} */
  export let label = '';

  const dispatch = createEventDispatcher();

  $: showBack = faceDown || !card;
  $: value = card?.value ?? null;
  $: isWild = value === 'wild' || value === 'wild4';
  $: tone = card ? (isWild ? 'wild' : card.color ?? 'wild') : 'wild';
  $: isNumber = value !== null && isBuntNumber(value);
  $: wish = isWild ? card?.wishColor ?? null : null;
  $: accessibleLabel = label || (showBack || !card ? 'Verdeckte Karte' : buntCardName(card));

  /** @param {MouseEvent} event */
  function handleClick(event) {
    if (disabled) return;
    dispatch('activate', event);
  }
</script>

<svelte:element
  this={interactive ? 'button' : 'div'}
  type={interactive ? 'button' : undefined}
  class="bc bc--{tone}"
  class:is-down={showBack}
  class:is-playable={playable && !disabled}
  class:is-selected={selected}
  class:is-dimmed={dimmed}
  class:is-disabled={disabled}
  class:is-static={!interactive}
  aria-label={interactive ? accessibleLabel : undefined}
  aria-hidden={interactive ? undefined : 'true'}
  aria-disabled={interactive && disabled ? 'true' : undefined}
  aria-pressed={interactive && selected ? 'true' : undefined}
  role={interactive ? undefined : 'presentation'}
  on:click={interactive ? handleClick : undefined}
>
  <span class="bc-lift">
    <span class="bc-inner">
      <span class="bc-face bc-front" aria-hidden="true">
        {#if card}
          <span class="bc-frame"></span>
          {#each ['tl', 'br'] as corner (corner)}
            <span class="bc-corner bc-corner--{corner}">
              {#if isNumber}
                <span class="bc-corner-value" class:is-underlined={value === '6' || value === '9'}>{value}</span>
              {:else if value === 'plus2'}
                <span class="bc-corner-value">+2</span>
              {:else if value === 'wild4'}
                <span class="bc-corner-value">+4</span>
              {:else if value === 'skip'}
                <svg class="bc-corner-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.8" /><path d="M6.2 17.8 17.8 6.2" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" /></svg>
              {:else if value === 'reverse'}
                <svg class="bc-corner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8h15M15 4.5 18.5 8 15 11.5" /><path d="M20.5 16h-15M9 12.5 5.5 16 9 19.5" /></svg>
              {:else}
                <svg class="bc-corner-icon" viewBox="0 0 24 24"><g><path d="M12 12V2.5A9.5 9.5 0 0 0 2.5 12Z" fill="#c8435a" /><path d="M12 12V2.5A9.5 9.5 0 0 1 21.5 12Z" fill="#e8b23e" /><path d="M12 12h9.5A9.5 9.5 0 0 1 12 21.5Z" fill="#3a74b8" /><path d="M12 12v9.5A9.5 9.5 0 0 1 2.5 12Z" fill="#4a9a66" /></g></svg>
              {/if}
              {#if card.color}
                <BuntMark shape={card.color} className="bc-corner-mark" />
              {/if}
            </span>
          {/each}

          <span class="bc-center">
            {#if isNumber}
              <span class="bc-big" class:is-underlined={value === '6' || value === '9'}>{value}</span>
            {:else if value === 'plus2'}
              <span class="bc-big bc-big--plus">+2</span>
            {:else if value === 'skip'}
              <svg class="bc-symbol" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.4" /><path d="M6.2 17.8 17.8 6.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
            {:else if value === 'reverse'}
              <svg class="bc-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8h15M15 4.5 18.5 8 15 11.5" /><path d="M20.5 16h-15M9 12.5 5.5 16 9 19.5" /></svg>
            {:else}
              <svg class="bc-disc" viewBox="0 0 24 24">
                <path d="M12 12V1.5A10.5 10.5 0 0 0 1.5 12Z" fill="#c8435a" />
                <path d="M12 12V1.5A10.5 10.5 0 0 1 22.5 12Z" fill="#e8b23e" />
                <path d="M12 12h10.5A10.5 10.5 0 0 1 12 22.5Z" fill="#3a74b8" />
                <path d="M12 12v10.5A10.5 10.5 0 0 1 1.5 12Z" fill="#4a9a66" />
                <path d="M12 1.5v21M1.5 12h21" stroke="#23262e" stroke-width="0.9" />
                {#if value === 'wild4'}
                  <circle cx="12" cy="12" r="6.2" fill="#23262e" />
                  <text x="12" y="12" text-anchor="middle" dominant-baseline="central" class="bc-disc-text">+4</text>
                {/if}
              </svg>
            {/if}
          </span>

          {#if wish}
            <span class="bc-wish bc-wish--{wish}">
              <BuntMark shape={wish} className="bc-wish-mark" />
              <span class="bc-wish-name">{BUNT_COLOR_NAMES[wish]}</span>
            </span>
          {/if}
        {/if}
      </span>
      <span class="bc-face bc-back" aria-hidden="true">
        <span class="bc-back-frame"></span>
        <span class="bc-back-grid">
          <BuntMark shape="kirsche" className="bc-back-mark bc-back-mark--kirsche" />
          <BuntMark shape="sonne" className="bc-back-mark bc-back-mark--sonne" />
          <BuntMark shape="wiese" className="bc-back-mark bc-back-mark--wiese" />
          <BuntMark shape="meer" className="bc-back-mark bc-back-mark--meer" />
        </span>
      </span>
    </span>
  </span>
  {#if badge !== null && badge !== undefined && badge !== ''}
    <span class="bc-badge" aria-hidden="true">{badge}</span>
  {/if}
</svelte:element>

<style>
  .bc {
    --bc-radius: clamp(5px, 10cqw, 14px);
    --bc-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --bc-ring: var(--accent-main, #1b6e66);
    --bc-field: #23262e;
    --bc-ink: #f6f3ea;

    position: relative;
    display: block;
    width: 100%;
    min-width: 0;
    aspect-ratio: 5 / 7;
    padding: 0;
    margin: 0;
    border: 0;
    background: transparent;
    border-radius: var(--bc-radius);
    container-type: inline-size;
    cursor: pointer;
    color: inherit;
    font: inherit;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
    font-variant-numeric: tabular-nums;
  }

  /* Card palette: deep, slightly muted pigments – the same in light and dark mode. */
  .bc--kirsche { --bc-field: #b8364d; --bc-ink: #fff8f4; }
  .bc--sonne { --bc-field: #e3a832; --bc-ink: #2e2003; }
  .bc--wiese { --bc-field: #357a50; --bc-ink: #f4fbf3; }
  .bc--meer { --bc-field: #2e66aa; --bc-ink: #f3f7ff; }
  .bc--wild { --bc-field: #23262e; --bc-ink: #f6f3ea; }

  .bc.is-disabled,
  .bc.is-static {
    cursor: default;
  }

  /* Lift layer: raise / hover lives here so it never clobbers the flip rotation. */
  .bc-lift {
    position: absolute;
    inset: 0;
    display: block;
    border-radius: inherit;
    transition: transform 180ms var(--bc-ease), filter 180ms ease, opacity 180ms ease;
    perspective: 900px;
  }

  /* Flip layer. */
  .bc-inner {
    position: absolute;
    inset: 0;
    display: block;
    border-radius: inherit;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    transform: rotateY(0deg);
    transition: transform 460ms var(--bc-ease);
  }

  .bc.is-down .bc-inner {
    transform: rotateY(180deg);
  }

  .bc-face {
    position: absolute;
    inset: 0;
    display: block;
    overflow: hidden;
    border-radius: inherit;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    box-shadow:
      0 0 0 1px rgb(15 23 42 / 0.16),
      0 1px 2px rgb(15 23 42 / 0.07);
    transition: box-shadow 180ms ease;
  }

  /* ---------- Front ---------- */
  .bc-front {
    transform: rotateY(0deg) translateZ(0.5px);
    background: var(--bc-field);
    color: var(--bc-ink);
  }

  /* A thin inset frame instead of a central shape. */
  .bc-frame {
    position: absolute;
    inset: 5cqw;
    border-radius: calc(var(--bc-radius) * 0.62);
    border: max(1px, 1.2cqw) solid color-mix(in srgb, var(--bc-ink) 32%, transparent);
  }

  .bc-corner {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2cqw;
    min-width: 20cqw;
    line-height: 1;
  }

  .bc-corner--tl {
    left: 9cqw;
    top: 9cqw;
  }

  .bc-corner--br {
    right: 9cqw;
    bottom: 9cqw;
    transform: rotate(180deg);
  }

  .bc-corner-value {
    font-size: 0.85rem;
    font-size: 21cqw;
    font-weight: 600;
    letter-spacing: -0.04em;
    line-height: 0.9;
  }

  .bc-corner-icon {
    width: 19cqw;
    height: 19cqw;
  }

  .bc-corner :global(.bc-corner-mark) {
    width: 11cqw;
    height: 11cqw;
    opacity: 0.9;
  }

  .is-underlined {
    text-decoration: underline;
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.1em;
  }

  .bc-center {
    position: absolute;
    left: 50%;
    top: 50%;
    display: grid;
    place-items: center;
    transform: translate(-50%, -50%);
    line-height: 1;
  }

  .bc-big {
    font-size: 2.6rem;
    font-size: 62cqw;
    font-weight: 600;
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .bc-big--plus {
    font-size: 48cqw;
    letter-spacing: -0.06em;
  }

  .bc-symbol {
    width: 54cqw;
    height: 54cqw;
  }

  .bc-disc {
    width: 62cqw;
    height: 62cqw;
    overflow: visible;
  }

  .bc-disc-text {
    fill: #f6f3ea;
    font-size: 6.4px;
    font-weight: 700;
    letter-spacing: -0.04em;
  }

  /* Chosen colour on a played wish card. */
  .bc-wish {
    position: absolute;
    left: 50%;
    bottom: 7cqw;
    display: inline-flex;
    align-items: center;
    gap: 2cqw;
    padding: 1.6cqw 4cqw;
    border-radius: 999px;
    transform: translateX(-50%);
    font-size: 11cqw;
    font-weight: 600;
    white-space: nowrap;
  }

  .bc-wish--kirsche { background: #b8364d; color: #fff8f4; }
  .bc-wish--sonne { background: #e3a832; color: #2e2003; }
  .bc-wish--wiese { background: #357a50; color: #f4fbf3; }
  .bc-wish--meer { background: #2e66aa; color: #f3f7ff; }

  .bc-wish :global(.bc-wish-mark) {
    width: 9cqw;
    height: 9cqw;
  }

  @container (max-width: 64px) {
    .bc-wish-name { display: none; }
  }

  /* ---------- Back ---------- */
  .bc-back {
    transform: rotateY(180deg) translateZ(0.5px);
    background: #20232b;
  }

  .bc-back-frame {
    position: absolute;
    inset: 5cqw;
    border-radius: calc(var(--bc-radius) * 0.62);
    border: max(1px, 1.2cqw) solid rgb(246 243 234 / 0.22);
  }

  .bc-back-grid {
    position: absolute;
    left: 50%;
    top: 50%;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6cqw;
    padding: 8cqw;
    border-radius: 14cqw;
    background: rgb(246 243 234 / 0.06);
    transform: translate(-50%, -50%) rotate(-8deg);
  }

  .bc-back-grid :global(.bc-back-mark) {
    width: 17cqw;
    height: 17cqw;
  }

  .bc-back-grid :global(.bc-back-mark--kirsche) { color: #d4566b; }
  .bc-back-grid :global(.bc-back-mark--sonne) { color: #ecbb50; }
  .bc-back-grid :global(.bc-back-mark--wiese) { color: #5aa874; }
  .bc-back-grid :global(.bc-back-mark--meer) { color: #4f88cc; }

  /* ---------- Badge ---------- */
  .bc-badge {
    position: absolute;
    right: -6px;
    top: -8px;
    z-index: 2;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--text, #0f172a);
    color: var(--ground, #fff);
    font-size: 0.75rem;
    font-weight: 600;
    box-shadow: 0 0 0 2px var(--ground, #fff);
    pointer-events: none;
  }

  /* ---------- States ---------- */
  .bc.is-playable .bc-lift {
    transform: translateY(-12%);
  }

  .bc.is-playable .bc-face {
    box-shadow:
      0 0 0 2px var(--ground, #fff),
      0 0 0 4px var(--bc-ring);
  }

  .bc.is-selected .bc-lift {
    transform: translateY(-18%);
  }

  .bc.is-selected .bc-face {
    box-shadow:
      0 0 0 2px var(--ground, #fff),
      0 0 0 5px var(--bc-ring);
  }

  .bc.is-dimmed .bc-lift {
    filter: saturate(0.35) brightness(0.8);
  }

  :global(html[data-theme='dark']) .bc.is-dimmed .bc-lift {
    filter: saturate(0.4) brightness(0.55);
  }

  .bc:focus-visible .bc-face {
    box-shadow: 0 0 0 2px var(--ground, #fff), 0 0 0 5px var(--bc-ring);
  }

  .bc:focus-visible .bc-lift {
    transform: translateY(-14%);
  }

  @media (hover: hover) and (pointer: fine) {
    .bc:not(.is-disabled):not(.is-static):hover .bc-lift {
      transform: translateY(-6%);
    }

    .bc.is-playable:not(.is-disabled):hover .bc-lift {
      transform: translateY(-18%);
    }
  }

  .bc:not(.is-disabled):not(.is-static):active .bc-lift {
    transform: translateY(-4%) scale(0.97);
    transition-duration: 80ms;
  }

  /* Tiny cards (opponent fans): drop the bottom index and badge. */
  @container (max-width: 40px) {
    .bc-corner--br,
    .bc-badge {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bc-inner,
    .bc-lift {
      transition: none;
    }
  }
</style>
