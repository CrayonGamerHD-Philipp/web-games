<script>
  import { createEventDispatcher } from 'svelte';

  /** @type {number | null} */
  export let value = null;
  /** Changes on every roll; restarts the tumble animation. */
  /** @type {number} */
  export let rollSeq = 0;
  export let disabled = true;
  export let primary = false;
  export let label = 'Würfeln';

  const dispatch = createEventDispatcher();

  /** Pip positions in a 3×3 grid (0 = top left, 8 = bottom right). @type {Record<number, number[]>} */
  const PIPS = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  $: pips = value ? PIPS[value] ?? [] : [];
</script>

<button
  type="button"
  class="hd"
  class:is-primary={primary}
  class:is-empty={!value}
  {disabled}
  aria-label={label}
  on:click={() => dispatch('roll')}
>
  {#key rollSeq}
    <span class="hd-face" class:is-tumble={rollSeq > 0} aria-hidden="true">
      {#each Array(9) as _, index (index)}
        <span class="hd-pip" class:is-on={pips.includes(index)}></span>
      {/each}
    </span>
  {/key}
</button>

<style>
  .hd {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 72px;
    height: 72px;
    padding: 0;
    border: 1.5px solid var(--control);
    border-radius: 18px;
    background: var(--raised);
    color: var(--text);
    cursor: pointer;
    transition: transform 120ms ease, background-color 150ms ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .hd.is-primary {
    background: var(--accent-main);
    color: #fff;
    border-color: var(--accent-main);
  }

  .hd:disabled {
    cursor: default;
  }

  .hd:disabled:not(.is-primary) {
    color: var(--text);
  }

  .hd:active:not(:disabled) {
    transform: scale(0.94);
  }

  .hd:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: 3px;
  }

  .hd-face {
    display: grid;
    grid-template-columns: repeat(3, 12px);
    grid-template-rows: repeat(3, 12px);
    gap: 5px;
  }

  .hd-face.is-tumble {
    animation: hd-tumble 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .hd-pip {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: currentColor;
    opacity: 0;
    transform: scale(0.4);
  }

  .hd-pip.is-on {
    opacity: 1;
    transform: none;
  }

  /* Leerer Würfel vor dem ersten Wurf: angedeutete Fünf. */
  .hd.is-empty .hd-pip:nth-child(odd) {
    opacity: 0.22;
    transform: scale(0.7);
  }

  @media (hover: hover) and (pointer: fine) {
    .hd:hover:not(:disabled) {
      background: var(--surface-2);
    }

    .hd.is-primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }
  }

  @keyframes hd-tumble {
    0% { transform: rotate(-200deg) scale(0.6); }
    60% { transform: rotate(14deg) scale(1.08); }
    100% { transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .hd-face.is-tumble {
      animation: none;
    }

    .hd {
      transition: none;
    }
  }
</style>
