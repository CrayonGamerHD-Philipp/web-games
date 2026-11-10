<script>
  import Glyph from './Glyph.svelte';
  import { PALETTE, SHAPE_PATHS, ROW_BONUS_LABELS } from './palette.js';

  /** @typedef {import('../types').NochMalBoard} Board */
  /** @typedef {import('../types').NochMalCell} Cell */
  /** @typedef {import('../types').NochMalClaims} Claims */

  /** @type {Board} */
  export let board;
  /** @type {Set<string>} */
  export let checked = new Set();
  /** Entwurf des aktuellen Zugs. */
  /** @type {Set<string>} */
  export let draft = new Set();
  /** Felder, die man gerade hinzufügen darf. */
  /** @type {Set<string>} */
  export let selectable = new Set();
  /** Zuletzt angekreuzt (für die kleine Strich-Animation). */
  /** @type {Set<string>} */
  export let recent = new Set();
  /** @type {Claims | null} */
  export let claims = null;
  /** @type {string} */
  export let playerId = '';
  /** @type {boolean} */
  export let extended = false;
  /** @type {boolean} */
  export let compact = false;
  /** Wird gerade ein Zug gebaut (dann werden nicht passende Felder gedämpft)? */
  /** @type {boolean} */
  export let focusMode = false;
  /** @type {Record<string, number>} */
  export let columnHearts = {};
  /** @type {((id: string) => void) | null} */
  export let onCell = null;
  /** Wer ist wer – für die Anzeige, wer eine Spalte oder Zeile zuerst hatte. */
  /** @type {Record<string, { name: string, color: string }>} */
  export let people = {};

  $: byId = new Map(board.cells.map((cell) => [cell.id, cell]));
  $: rows = Array.from({ length: board.rows }, (_, row) => board.cells.slice(row * board.cols, (row + 1) * board.cols));
  $: showSide = extended && !compact;
  $: gridStyle = `--cols:${board.cols};--side-w:${showSide ? 'var(--side)' : '0px'};grid-template-columns: repeat(${board.cols}, var(--cell))${showSide ? ' var(--side)' : ''};`;

  /** @param {Cell} cell @param {number} dr @param {number} dc */
  function joined(cell, dr, dc) {
    const other = byId.get(`${cell.row + dr}-${cell.col + dc}`);
    return Boolean(other && other.blockId === cell.blockId);
  }

  /**
   * Geschlossenes Spielfeld: keine Lücken. Zwischen zwei Blöcken liegt nur eine feine Kante,
   * rund sind allein die vier Ecken des ganzen Bretts.
   * @param {Cell} cell
   */
  function tileStyle(cell) {
    const sides = /** @type {const} */ ([['top', -1, 0], ['bottom', 1, 0], ['left', 0, -1], ['right', 0, 1]]);
    const parts = [`--fill:${PALETTE[cell.color].fill}`, `--ink:${PALETTE[cell.color].ink}`];
    for (const [side, dr, dc] of sides) {
      const other = byId.get(`${cell.row + dr}-${cell.col + dc}`);
      // Leicht überlappen, damit zwischen Feldern keine Haarlinien entstehen.
      parts.push(`${side}:${other ? '-0.5px' : '0'}`);
      if (other && other.blockId !== cell.blockId) parts.push(`border-${side}:var(--edge)`);
    }
    const lastRow = board.rows - 1;
    const lastCol = board.cols - 1;
    const round = 'var(--round)';
    if (cell.row === 0 && cell.col === 0) parts.push(`border-top-left-radius:${round}`);
    if (cell.row === 0 && cell.col === lastCol) parts.push(`border-top-right-radius:${round}`);
    if (cell.row === lastRow && cell.col === 0) parts.push(`border-bottom-left-radius:${round}`);
    if (cell.row === lastRow && cell.col === lastCol) parts.push(`border-bottom-right-radius:${round}`);
    return parts.join(';');
  }

  /** @param {Cell} cell */
  function cellLabel(cell) {
    const parts = [`${board.letters[cell.col]}${cell.row + 1}`, PALETTE[cell.color].name];
    if (cell.star) parts.push('Stern');
    if (cell.gold) parts.push('Würfelfeld');
    if (checked.has(cell.id)) parts.push('angekreuzt');
    else if (draft.has(cell.id)) parts.push('ausgewählt');
    else if (selectable.has(cell.id)) parts.push('wählbar');
    return parts.join(', ');
  }

  /** @param {string[]} ids */
  function firstOthers(ids) {
    return ids.filter((id) => id !== playerId).map((id) => people[id] ?? { name: '?', color: 'var(--muted)' });
  }

  /** @param {{ name: string }[]} list */
  function names(list) {
    return list.map((person) => person.name).join(', ');
  }

  /**
   * Spalte: oben der Wert für den Ersten, unten der für alle Späteren.
   * @param {number} col
   */
  function columnState(col) {
    const claim = claims?.columns[col];
    if (!claim) return { top: 'open', bottom: 'open', by: /** @type {{ name: string, color: string }[]} */ ([]) };
    const mineFirst = claim.first.includes(playerId);
    const mineLater = claim.normal.includes(playerId);
    const gone = !mineFirst && claim.first.length > 0;
    return {
      top: mineFirst ? 'mine' : gone ? 'gone' : 'open',
      bottom: mineLater ? 'mine' : gone ? 'left' : 'open',
      by: gone ? firstOthers(claim.first) : []
    };
  }

  /**
   * Zeile: Der Erste bekommt 5 Punkte und den Bonus, Spätere nur den Bonus.
   * @param {number} row
   */
  function rowState(row) {
    const claim = claims?.rows[row];
    /** @type {{ name: string, color: string }[]} */
    const none = [];
    if (!claim) return { state: 'open', by: none };
    if (claim.first.includes(playerId)) return { state: 'mine-first', by: none };
    if (claim.normal.includes(playerId)) return { state: 'mine-later', by: firstOthers(claim.first) };
    if (claim.first.length) return { state: 'gone', by: firstOthers(claim.first) };
    return { state: 'open', by: none };
  }

  /**
   * @param {number} col
   * @param {number} value
   * @param {{ top: string, by: { name: string }[] }} state
   */
  function topTitle(col, value, state) {
    const letter = board.letters[col];
    if (state.top === 'mine') return `Spalte ${letter}: Du warst zuerst, ${value} Punkte`;
    if (state.top === 'gone') return `Spalte ${letter}: ${names(state.by)} zuerst – die ${value} gibt es nicht mehr`;
    return `Spalte ${letter}: Wer sie zuerst füllt, bekommt ${value} Punkte`;
  }

  /**
   * @param {number} col
   * @param {number} value
   * @param {{ bottom: string, by: { name: string }[] }} state
   * @param {number | undefined} heart
   */
  function bottomTitle(col, value, state, heart) {
    const letter = board.letters[col];
    const hearts = heart ? `, dazu Herzbonus +${heart}` : '';
    if (state.bottom === 'mine') return `Spalte ${letter}: geschafft, ${value} Punkte${hearts}`;
    if (state.bottom === 'left') return `Spalte ${letter}: ${names(state.by)} war zuerst – du bekommst noch ${value} Punkte`;
    return `Spalte ${letter}: Wer später fertig wird, bekommt ${value} Punkte${hearts}`;
  }

  /**
   * @param {number} row
   * @param {{ state: string, by: { name: string }[] }} state
   * @param {string} bonusName
   */
  function rowTitle(row, state, bonusName) {
    if (state.state === 'mine-first') return `Zeile ${row + 1}: Du warst zuerst – 5 Punkte und ${bonusName}`;
    if (state.state === 'mine-later') return `Zeile ${row + 1}: geschafft nach ${names(state.by)} – ${bonusName} bekommen, keine Punkte`;
    if (state.state === 'gone') return `Zeile ${row + 1}: ${names(state.by)} zuerst – du bekommst noch ${bonusName}, aber keine Punkte`;
    return `Zeile ${row + 1}: Wer sie zuerst füllt, bekommt 5 Punkte und ${bonusName}. Später gibt es nur noch ${bonusName}`;
  }

  /** @param {string} id */
  function handle(id) {
    if (onCell) onCell(id);
  }
</script>

<div class="kz-board" class:is-compact={compact} class:is-focus={focusMode} style={gridStyle}>
  {#if !compact}
    {#each board.letters as letter, col (col)}
      <span class="kz-head" class:is-start={col === board.startCol} aria-hidden="true">{letter}</span>
    {/each}
    {#if showSide}<span class="kz-head kz-head--side" aria-hidden="true"></span>{/if}

    {#each board.columnPoints.top as value, col (col)}
      {@const state = columnState(col)}
      <span class="kz-pt kz-pt--top" class:is-mine={state.top === 'mine'} class:is-gone={state.top === 'gone'} title={topTitle(col, value, state)}>
        <span class="kz-pt-value">{value}</span>
        {#if state.top === 'gone' && state.by[0]}
          <span class="kz-who" style={`--who:${state.by[0].color}`} aria-hidden="true">{state.by[0].name.slice(0, 1).toUpperCase()}</span>
        {/if}
      </span>
    {/each}
    {#if showSide}<span class="kz-side-head" aria-hidden="true">Zeile</span>{/if}
  {/if}

  {#each rows as rowCells, row (row)}
    {#each rowCells as cell (cell.id)}
      {@const isChecked = checked.has(cell.id)}
      {@const isDraft = draft.has(cell.id)}
      {@const canPick = !isChecked && (selectable.has(cell.id) || isDraft)}
      {#if onCell && !compact}
        <button
          type="button"
          class="kz-cell"
          class:is-checked={isChecked}
          class:is-draft={isDraft}
          class:is-pickable={canPick && !isDraft}
          class:is-start={cell.col === board.startCol}
          disabled={!canPick}
          aria-pressed={isDraft}
          aria-label={cellLabel(cell)}
          on:click={() => handle(cell.id)}
        >
          <span class="kz-tile" style={tileStyle(cell)}>
            {#if cell.star}<span class="kz-mark kz-mark--star"><Glyph name="star" size={14} /></span>
            {:else if cell.gold}<span class="kz-mark"><Glyph name="gold" size={15} /></span>
            {:else}<svg class="kz-shape" viewBox="0 0 10 10" aria-hidden="true"><path d={SHAPE_PATHS[PALETTE[cell.color].shape]} /></svg>{/if}
            {#if isChecked || isDraft}
              <svg class="kz-x" class:is-new={recent.has(cell.id)} viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5 15 15M15 5 5 15" pathLength="1" /></svg>
            {/if}
          </span>
        </button>
      {:else}
        <span class="kz-cell" class:is-checked={isChecked} aria-hidden={compact ? 'true' : undefined} aria-label={compact ? undefined : cellLabel(cell)} role={compact ? undefined : 'img'}>
          <span class="kz-tile" style={tileStyle(cell)}>
            {#if !compact}
              {#if cell.star}<span class="kz-mark kz-mark--star"><Glyph name="star" size={14} /></span>
              {:else if cell.gold}<span class="kz-mark"><Glyph name="gold" size={15} /></span>
              {:else}<svg class="kz-shape" viewBox="0 0 10 10" aria-hidden="true"><path d={SHAPE_PATHS[PALETTE[cell.color].shape]} /></svg>{/if}
            {:else if cell.star && !isChecked}
              <span class="kz-dot" aria-hidden="true"></span>
            {/if}
            {#if isChecked}
              <svg class="kz-x" class:is-new={recent.has(cell.id)} viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5 15 15M15 5 5 15" pathLength="1" /></svg>
            {/if}
          </span>
        </span>
      {/if}
    {/each}
    {#if showSide}
      {@const state = rowState(row)}
      {@const bonus = board.rowBonus[row]}
      <span
        class="kz-side"
        class:is-mine={state.state === 'mine-first'}
        class:is-later={state.state === 'mine-later'}
        class:is-gone={state.state === 'gone'}
        title={rowTitle(row, state, ROW_BONUS_LABELS[bonus])}
      >
        <span class="kz-side-pts ui-num" class:is-struck={state.state === 'gone' || state.state === 'mine-later'}>5</span>
        {#if (state.state === 'gone' || state.state === 'mine-later') && state.by[0]}
          <span class="kz-who" style={`--who:${state.by[0].color}`} aria-hidden="true">{state.by[0].name.slice(0, 1).toUpperCase()}</span>
        {/if}
        {#if state.state === 'gone'}<span class="kz-side-rest">noch</span>{/if}
        <span class="kz-side-bonus"><Glyph name={bonus} size={15} label={ROW_BONUS_LABELS[bonus]} /></span>
      </span>
    {/if}
  {/each}

  {#if !compact}
    {#each board.columnPoints.bottom as value, col (col)}
      {@const state = columnState(col)}
      {@const heart = columnHearts[String(col)]}
      <span class="kz-pt kz-pt--bottom" class:is-mine={state.bottom === 'mine'} class:is-left={state.bottom === 'left'} title={bottomTitle(col, value, state, heart)}>
        {#if state.bottom === 'left'}<span class="kz-pt-note">noch</span>{/if}
        <span class="kz-pt-value">{value}</span>
        {#if heart}<span class="kz-heart-bonus">+{heart}</span>{/if}
      </span>
    {/each}
    {#if showSide}<span aria-hidden="true"></span>{/if}
  {/if}
</div>

<style>
  /* Die Zellgröße folgt der Breite des umgebenden Containers (container-type im Panel). */
  .kz-board {
    --cell: clamp(2.4rem, calc((100cqi - var(--side-w) - 8px) / var(--cols)), 4.2rem);
    --side: 5.4rem;
    --edge: 2px solid rgb(0 0 0 / 0.26);
    --round: 12px;
    font-size: clamp(0.75rem, calc(var(--cell) * 0.28), 1rem);
    display: grid;
    width: max-content;
    row-gap: 0;
    column-gap: 0;
    user-select: none;
  }

  .kz-board.is-compact {
    --cell: 0.62rem;
    --edge: 1px solid rgb(0 0 0 / 0.22);
    --round: 3px;
  }

  .kz-head {
    display: grid;
    place-items: center;
    height: 1.7em;
    font-size: 0.9em;
    font-weight: 700;
    color: var(--muted);
  }

  .kz-head.is-start {
    color: var(--accent-text);
  }

  .kz-head.is-start::after {
    content: '';
    display: block;
    width: 60%;
    height: 3px;
    margin-top: 2px;
    border-radius: 2px;
    background: var(--accent-main);
  }

  .kz-pt {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25em;
    height: 2em;
    margin: 2px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 0.95em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    position: relative;
  }

  .kz-pt-note {
    font-size: 0.68em;
    font-weight: 600;
  }

  .kz-who {
    display: inline-grid;
    place-items: center;
    width: 1.35em;
    height: 1.35em;
    border-radius: 50%;
    background: var(--who);
    color: #fff;
    font-size: 0.62em;
    font-weight: 800;
    text-decoration: none;
  }

  .kz-pt--top {
    margin-bottom: 4px;
  }

  .kz-pt--bottom {
    margin-top: 4px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }

  .kz-pt.is-mine {
    background: var(--accent-main);
    color: #fff;
  }

  .kz-pt.is-gone {
    color: var(--muted);
    background: transparent;
  }

  .kz-pt.is-gone .kz-pt-value,
  .kz-side-pts.is-struck {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
  }

  /* Jemand war schon zuerst: der untere Wert ist, was du noch bekommst. */
  .kz-pt--bottom.is-left {
    background: var(--accent-soft);
    color: var(--accent-ink);
    font-weight: 700;
  }

  .kz-heart-bonus {
    position: absolute;
    bottom: -1.3em;
    font-size: 0.7em;
    font-weight: 700;
    color: #d0315f;
  }

  .kz-side-head {
    display: grid;
    place-items: center;
    font-size: 0.75em;
    font-weight: 600;
    color: var(--muted);
  }

  .kz-side {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3em;
    margin: 4px 0 4px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 0.9em;
    font-weight: 700;
  }

  .kz-side.is-mine {
    background: var(--accent-main);
    color: #fff;
  }

  .kz-side.is-gone {
    background: var(--accent-soft);
    color: var(--accent-ink);
  }

  .kz-side.is-later {
    background: transparent;
    color: var(--muted);
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .kz-side-rest {
    font-size: 0.72em;
    font-weight: 600;
  }

  .kz-side-bonus {
    display: inline-flex;
  }

  .kz-cell {
    position: relative;
    display: block;
    width: var(--cell);
    height: var(--cell);
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
  }

  button.kz-cell:disabled {
    cursor: default;
  }

  button.kz-cell:not(:disabled) {
    cursor: pointer;
  }

  .kz-tile {
    position: absolute;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    background: var(--fill);
    color: var(--ink);
    transition: filter 120ms ease, opacity 120ms ease;
  }

  .kz-cell.is-start .kz-tile::before {
    content: '';
    position: absolute;
    inset: auto 30% 3px;
    height: 2px;
    border-radius: 2px;
    background: currentColor;
    opacity: 0.35;
  }

  .is-compact .kz-cell.is-start .kz-tile::before {
    display: none;
  }

  .kz-shape {
    width: 28%;
    height: 28%;
    fill: currentColor;
    opacity: 0.28;
  }

  .kz-mark {
    display: inline-flex;
    color: var(--ink);
  }

  .kz-mark :global(svg) {
    width: calc(var(--cell) * 0.36);
    height: calc(var(--cell) * 0.36);
  }

  .kz-mark--star {
    color: #fff;
    filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.55));
  }

  .kz-dot {
    width: 40%;
    height: 40%;
    border-radius: 50%;
    background: #fff;
    opacity: 0.85;
  }

  .kz-x {
    position: absolute;
    inset: 8%;
    width: 84%;
    height: 84%;
    fill: none;
    stroke: #1b1c1a;
    stroke-width: 2.6;
    stroke-linecap: round;
  }

  .is-compact .kz-x {
    inset: 0;
    width: 100%;
    height: 100%;
    stroke-width: 3.4;
  }

  .kz-x.is-new path {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: kz-draw 320ms ease-out forwards;
  }

  @keyframes kz-draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  .kz-cell.is-checked .kz-tile {
    filter: saturate(0.55) brightness(0.92);
  }

  /* Beim Zug: alles Nicht-Passende tritt zurück. */
  .kz-board.is-focus .kz-cell:not(.is-pickable):not(.is-draft):not(.is-checked) .kz-tile {
    opacity: 0.62;
    filter: saturate(0.6);
  }

  .kz-cell.is-pickable .kz-tile {
    box-shadow: inset 0 0 0 3px rgb(255 255 255 / 0.95);
  }

  .kz-cell.is-pickable:hover .kz-tile {
    filter: brightness(1.08);
  }

  .kz-cell.is-draft .kz-tile {
    box-shadow: inset 0 0 0 3px #1b1c1a;
  }

  .kz-cell.is-draft .kz-x {
    stroke: #1b1c1a;
    opacity: 0.85;
  }

  button.kz-cell:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: -1px;
    z-index: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .kz-x.is-new path {
      animation: none;
      stroke-dashoffset: 0;
    }
  }

  @media (max-width: 640px) {
    .kz-board:not(.is-compact) {
      --cell: clamp(2.15rem, calc((100cqi - var(--side-w) - 8px) / var(--cols)), 3rem);
      --side: 4.4rem;
      --round: 10px;
    }
  }
</style>
