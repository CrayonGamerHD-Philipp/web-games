<script>
  import ShipArt from './ShipArt.svelte';
  import IslandTile from './IslandTile.svelte';

  /**
   * @typedef {{ dir: 'h' | 'v', part: 'start' | 'mid' | 'end', sunk: boolean }} CellShip
   * @typedef {{ kind: 'island' | 'rock', deco: 'palm' | 'hut' | 'flowers' | 'lighthouse', joins: { t: boolean, r: boolean, b: boolean, l: boolean } }} CellTerrain
   * @typedef {{ key: number, x: number, y: number, ship: CellShip | null, terrain?: CellTerrain | null, shot: 'hit' | 'miss' | null, ghost: 'ok' | 'bad' | null, last: boolean, pickable: boolean, label: string }} SeaCell
   * @typedef {{ id: string, length: number, x: number, y: number, dir: 'h' | 'v', sunk?: boolean }} SeaShip
   */

  /** @type {SeaCell[]} */
  export let cells = [];
  /** Schiffe, die auf diesem Brett zu sehen sind (eigene, oder versenkte des Gegners). */
  /** @type {SeaShip[]} */
  export let ships = [];
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
    if (mode === 'target') return !cell.shot && !cell.terrain;
    return true;
  }

  /** @param {string} id */
  function shipType(id) {
    if (id.startsWith('schlacht')) return 'schlachtschiff';
    if (id.startsWith('kreuzer')) return 'kreuzer';
    if (id.startsWith('u-boot')) return 'u-boot';
    return 'zerstoerer';
  }

  /** Ein Schiff überspannt seine Felder im Raster (Zeile/Spalte 1 sind die Beschriftungen). @param {SeaShip} ship */
  function shipArea(ship) {
    const cols = ship.dir === 'h' ? ship.length : 1;
    const rows = ship.dir === 'v' ? ship.length : 1;
    return `grid-column: ${ship.x + 2} / span ${cols}; grid-row: ${ship.y + 2} / span ${rows}; --len: ${ship.length};`;
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
  <span class="sb-corner" aria-hidden="true" style="grid-column: 1; grid-row: 1"></span>
  {#each Array(SIZE) as _, col (col)}
    <span class="sb-label sb-label--col" aria-hidden="true" style="grid-column: {col + 2}; grid-row: 1">{col + 1}</span>
  {/each}

  <!-- Schiffe liegen als ein Bild über ihren Feldern; Treffer und Vorschau zeichnen die Felder darüber. -->
  {#each ships as ship (ship.id)}
    <span class="sb-ship sb-ship--{ship.dir}" class:is-sunk={Boolean(ship.sunk)} style={shipArea(ship)} aria-hidden="true">
      <svg class="sb-ship-art" viewBox="0 0 {ship.length * 100} 100" preserveAspectRatio="none">
        <ShipArt type={shipType(ship.id)} length={ship.length} sunk={Boolean(ship.sunk)} />
      </svg>
    </span>
  {/each}

  {#each cells as cell (cell.key)}
    {#if cell.x === 0}
      <span class="sb-label sb-label--row" aria-hidden="true" style="grid-column: 1; grid-row: {cell.y + 2}">{ROWS[cell.y]}</span>
    {/if}
    <button
      type="button"
      class="sb-cell"
      style="grid-column: {cell.x + 2}; grid-row: {cell.y + 2}"
      class:has-ship={Boolean(cell.ship)}
      class:is-land={Boolean(cell.terrain)}
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
      {#if cell.terrain}
        <IslandTile kind={cell.terrain.kind} deco={cell.terrain.deco} joins={cell.terrain.joins} />
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

    .is-place .sb-cell.is-pickable:hover::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 3;
      background: rgb(255 255 255 / 0.25);
      pointer-events: none;
    }
  }

  /* Fokus und letzter Schuss als Ring über allem – ohne z-index auf dem Feld, damit die Schiffe sichtbar bleiben. */
  .sb-cell:focus-visible {
    outline: none;
  }

  .sb-cell:focus-visible::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 4;
    border-radius: 2px;
    box-shadow: inset 0 0 0 3px var(--sv-focus, #0e7490);
    pointer-events: none;
  }

  .sb-cell.has-ship,
  .sb-cell.is-land {
    background: var(--sv-sea, #dcecf4);
  }

  /* Flaches Lagunenwasser um die Inseln, passend zum Meer des Themes. */
  .sb-cell.is-land {
    background: color-mix(in srgb, var(--sv-sea, #dcecf4) 62%, #4fc2b9);
  }

  /* ---------- Schiffe ---------- */
  .sb-ship {
    position: relative;
    z-index: 1;
    pointer-events: none;
  }

  .sb-ship-art {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 2px 2px rgb(15 40 60 / 0.25));
  }

  /* Senkrechte Schiffe: dasselbe Bild, um 90° gedreht. */
  .sb-ship--v .sb-ship-art {
    width: calc(100% * var(--len));
    height: calc(100% / var(--len));
    transform-origin: 0 0;
    transform: rotate(90deg) translateY(-100%);
  }

  .is-place .sb-cell.is-pickable {
    cursor: grab;
  }

  .sb-cell.is-hit:not(.has-ship) {
    background: var(--sv-hit-bg, #fadcd4);
  }

  /* ---------- Markers: miss = dot, hit = cross, sunk = dark hull + cross ---------- */
  .sb-miss {
    position: absolute;
    z-index: 3;
    inset: 36%;
    border-radius: 999px;
    background: var(--sv-miss, #6b8aa0);
  }

  .sb-hit {
    position: absolute;
    z-index: 3;
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
  .sb-cell.is-last::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 4;
    border-radius: 2px;
    box-shadow: inset 0 0 0 2px var(--sv-last, #0f172a);
    pointer-events: none;
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
    z-index: 3;
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


  }

  @media (min-width: 480px) {
    .sb { --lbl: 1.15rem; gap: 2px; }
    .sb-label { font-size: 0.7rem; }
  }

  @media (min-width: 1024px) {
    .sb-label { font-size: 0.75rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sb-cell {
      transition: none;
    }

    .is-last .sb-hit,
    .is-last .sb-miss,
    .is-last .sb-miss::after {
      animation: none;
    }
  }
</style>
