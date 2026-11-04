<script>
  /**
   * @typedef {{ dir: 'h' | 'v', part: 'start' | 'mid' | 'end', sunk: boolean }} CellShip
   * @typedef {{ key: number, x: number, y: number, ship: CellShip | null, shot: 'hit' | 'miss' | null, ghost: 'ok' | 'bad' | null, last: boolean, pickable: boolean, label: string }} SeaCell
   */

  /** @type {SeaCell[]} */
  export let cells = [];
  /** Accessible name of the whole board. */
  export let label = 'Spielfeld';
  /** Cells react to clicks. */
  export let interactive = false;
  /** 'target' shows a crosshair on hover, 'place' a placement cursor. */
  export let mode = 'view';
  /** @type {(x: number, y: number) => void} */
  export let onCellClick = () => {};
  /** @type {(x: number, y: number) => void} */
  export let onCellHover = () => {};
  export let onLeave = () => {};
  export let onRotate = () => {};

  const ROWS = 'ABCDEFGHIJ';
  const SIZE = 10;

  let focusIndex = 0;
  /** @type {HTMLDivElement} */
  let gridEl;

  /** @param {SeaCell} cell */
  function isUsable(cell) {
    if (!interactive) return false;
    if (mode === 'target') return !cell.shot;
    return true;
  }

  /** @param {SeaCell} cell */
  function handleClick(cell) {
    focusIndex = cell.key;
    if (!isUsable(cell)) return;
    onCellClick(cell.x, cell.y);
  }

  /**
   * @param {PointerEvent} event
   * @param {SeaCell} cell
   */
  function handlePointerEnter(event, cell) {
    if (event.pointerType === 'touch') return;
    onCellHover(cell.x, cell.y);
  }

  /**
   * @param {FocusEvent} event
   * @param {SeaCell} cell
   */
  function handleFocus(event, cell) {
    focusIndex = cell.key;
    const target = /** @type {HTMLElement} */ (event.currentTarget);
    // Only keyboard focus previews; a tap must not leave a ghost behind.
    let visible = false;
    try {
      visible = target.matches(':focus-visible');
    } catch {}
    if (visible) onCellHover(cell.x, cell.y);
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    let x = focusIndex % SIZE;
    let y = Math.floor(focusIndex / SIZE);

    switch (event.key) {
      case 'ArrowLeft': x = Math.max(0, x - 1); break;
      case 'ArrowRight': x = Math.min(SIZE - 1, x + 1); break;
      case 'ArrowUp': y = Math.max(0, y - 1); break;
      case 'ArrowDown': y = Math.min(SIZE - 1, y + 1); break;
      case 'Home': x = 0; break;
      case 'End': x = SIZE - 1; break;
      case 'r':
      case 'R':
        if (mode === 'place') {
          event.preventDefault();
          onRotate();
        }
        return;
      default:
        return;
    }

    event.preventDefault();
    focusIndex = y * SIZE + x;
    const button = /** @type {HTMLButtonElement | null} */ (gridEl?.querySelector(`[data-key="${focusIndex}"]`));
    button?.focus();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="sb"
  class:is-target={mode === 'target' && interactive}
  class:is-place={mode === 'place' && interactive}
  role="group"
  aria-label={label}
  bind:this={gridEl}
  on:keydown={handleKeydown}
  on:pointerleave={onLeave}
>
  <span class="sb-corner" aria-hidden="true"></span>
  {#each Array(SIZE) as _, col (col)}
    <span class="sb-label sb-label--col" aria-hidden="true">{col + 1}</span>
  {/each}

  {#each cells as cell (cell.key)}
    {#if cell.x === 0}
      <span class="sb-label sb-label--row" aria-hidden="true">{ROWS[cell.y]}</span>
    {/if}
    <button
      type="button"
      class="sb-cell"
      class:has-ship={Boolean(cell.ship)}
      class:is-hit={cell.shot === 'hit'}
      class:is-miss={cell.shot === 'miss'}
      class:is-sunk={Boolean(cell.ship?.sunk)}
      class:is-last={cell.last}
      class:is-usable={isUsable(cell)}
      class:is-pickable={cell.pickable}
      data-key={cell.key}
      tabindex={cell.key === focusIndex ? 0 : -1}
      aria-label={cell.label}
      aria-disabled={!isUsable(cell)}
      on:click={() => handleClick(cell)}
      on:pointerenter={(event) => handlePointerEnter(event, cell)}
      on:focus={(event) => handleFocus(event, cell)}
    >
      {#if cell.ship}
        <span class="sb-hull sb-hull--{cell.ship.dir} sb-hull--{cell.ship.part}" aria-hidden="true"></span>
      {/if}
      {#if cell.shot === 'miss'}
        <span class="sb-miss" aria-hidden="true"></span>
      {:else if cell.shot === 'hit'}
        <span class="sb-hit" aria-hidden="true"></span>
      {/if}
      {#if cell.ghost}
        <span class="sb-ghost sb-ghost--{cell.ghost}" aria-hidden="true"></span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .sb {
    --lbl: 0.95rem;
    display: grid;
    grid-template-columns: var(--lbl) repeat(10, minmax(0, 1fr));
    gap: 1px;
    width: 100%;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }

  .sb-corner {
    display: block;
  }

  .sb-label {
    display: grid;
    place-items: center;
    font-size: 0.62rem;
    font-weight: 600;
    line-height: 1;
    color: var(--muted, #62625f);
    font-variant-numeric: tabular-nums;
  }

  .sb-label--col {
    padding-bottom: 0.25rem;
  }

  .sb-label--row {
    justify-content: start;
    padding-left: 0.05rem;
  }

  .sb-cell {
    position: relative;
    display: block;
    aspect-ratio: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: var(--sv-sea, #dcecf4);
    color: inherit;
    cursor: default;
    -webkit-tap-highlight-color: transparent;
    transition: background-color 140ms ease;
  }

  .sb-cell.is-usable {
    cursor: pointer;
  }

  .is-target .sb-cell.is-usable {
    cursor: crosshair;
  }

  @media (hover: hover) {
    .is-target .sb-cell.is-usable:hover {
      background: var(--sv-sea-hover, #c6e0ec);
    }

    .is-target .sb-cell.is-usable:hover::after {
      content: '';
      position: absolute;
      inset: 22%;
      border: 2px solid var(--sv-aim, #0e7490);
      border-radius: 999px;
    }

    .is-place .sb-cell.is-pickable:hover .sb-hull {
      background: var(--sv-hull-hover, #36505f);
    }
  }

  .sb-cell:focus-visible {
    z-index: 2;
    outline: 3px solid var(--sv-focus, #0e7490);
    outline-offset: 0;
  }

  .sb-cell.is-hit:not(.has-ship) {
    background: var(--sv-hit-bg, #fadcd4);
  }

  /* ---------- Hull segments ---------- */
  .sb-hull {
    position: absolute;
    background: var(--sv-hull, #4a6273);
    transition: background-color 160ms ease;
  }

  .is-sunk .sb-hull {
    background: var(--sv-hull-sunk, #1d2a35);
  }

  .sb-hull--h { top: 20%; bottom: 20%; left: -1px; right: -1px; }
  .sb-hull--v { left: 20%; right: 20%; top: -1px; bottom: -1px; }
  .sb-hull--h.sb-hull--start { left: 10%; border-radius: 999px 0.2rem 0.2rem 999px; }
  .sb-hull--h.sb-hull--end { right: 12%; border-radius: 0.2rem 0.45rem 0.45rem 0.2rem; }
  .sb-hull--v.sb-hull--start { top: 10%; border-radius: 999px 999px 0.2rem 0.2rem; }
  .sb-hull--v.sb-hull--end { bottom: 12%; border-radius: 0.2rem 0.2rem 0.45rem 0.45rem; }

  /* ---------- Markers: miss = dot, hit = cross, sunk = dark hull + cross ---------- */
  .sb-miss {
    position: absolute;
    inset: 36%;
    border-radius: 999px;
    background: var(--sv-miss, #6b8aa0);
  }

  .sb-hit {
    position: absolute;
    inset: 18%;
  }

  .sb-hit::before,
  .sb-hit::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 22%;
    min-width: 3px;
    border-radius: 2px;
    background: var(--sv-hit, #d9472f);
    transform: translateX(-50%) rotate(45deg);
  }

  .sb-hit::after {
    transform: translateX(-50%) rotate(-45deg);
  }

  .is-sunk .sb-hit::before,
  .is-sunk .sb-hit::after {
    background: var(--sv-hit-on-sunk, #ff8a73);
  }

  /* ---------- Last shot ---------- */
  .sb-cell.is-last {
    z-index: 1;
    box-shadow: 0 0 0 2px var(--sv-last, #0f172a);
  }

  .is-last .sb-hit {
    animation: sb-hit-in 420ms cubic-bezier(0.2, 0.9, 0.3, 1.4);
  }

  .is-last .sb-miss {
    animation: sb-miss-in 360ms ease-out;
  }

  .is-last .sb-miss::after {
    content: '';
    position: absolute;
    inset: -110%;
    border: 2px solid var(--sv-miss, #6b8aa0);
    border-radius: 999px;
    opacity: 0;
    animation: sb-ripple 700ms ease-out;
  }

  @keyframes sb-hit-in {
    from { transform: scale(0.2) rotate(-30deg); opacity: 0; }
    to { transform: none; opacity: 1; }
  }

  @keyframes sb-miss-in {
    from { transform: scale(0); }
    to { transform: none; }
  }

  @keyframes sb-ripple {
    0% { transform: scale(0.3); opacity: 0.9; }
    100% { transform: scale(1); opacity: 0; }
  }

  /* ---------- Placement ghost ---------- */
  .sb-ghost {
    position: absolute;
    inset: 0;
    border-radius: 2px;
    pointer-events: none;
  }

  .sb-ghost--ok {
    background: var(--sv-ghost, rgb(14 116 144 / 0.32));
    box-shadow: inset 0 0 0 2px var(--sv-focus, #0e7490);
  }

  .sb-ghost--bad {
    background: repeating-linear-gradient(
      135deg,
      var(--sv-bad-soft, rgb(220 38 38 / 0.35)) 0 4px,
      transparent 4px 8px
    );
    box-shadow: inset 0 0 0 2px var(--sv-bad, #dc2626);
  }

  /* Narrow phones: no gaps (lines are drawn inside the cells) and the label column
     tucks into the surrounding padding, so cells stay ~30px wide at 360px. */
  @media (max-width: 479px) {
    .sb {
      --lbl: 0.85rem;
      gap: 0;
      width: calc(100% + 0.3rem);
      margin-left: -0.3rem;
    }

    .sb-label--col { padding-bottom: 0.2rem; }

    .sb-cell {
      border-radius: 0;
      box-shadow: inset -1px -1px 0 var(--sv-gridline, #ffffff);
    }

    .sb-cell.is-last {
      box-shadow: inset 0 0 0 2px var(--sv-last, #0f172a);
    }
  }

  @media (min-width: 480px) {
    .sb { --lbl: 1.15rem; gap: 2px; }
    .sb-label { font-size: 0.7rem; }
    .sb-hull--h { left: -2px; right: -2px; }
    .sb-hull--v { top: -2px; bottom: -2px; }
  }

  @media (min-width: 1024px) {
    .sb-label { font-size: 0.75rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sb-cell,
    .sb-hull {
      transition: none;
    }

    .is-last .sb-hit,
    .is-last .sb-miss,
    .is-last .sb-miss::after {
      animation: none;
    }
  }
</style>
