<script>
  import { initials, playerHexById } from '$lib/player-colors.js';

  /** @typedef {import('../types').VierSession} VierSession */
  /** @typedef {import('../types').VierPlayer} VierPlayer */
  /** @typedef {import('../types').VierEvent} VierEvent */
  /** @typedef {import('../types').VierMove} VierMove */
  /** @typedef {import('../types').VierSeat} VierSeat */

  /** @type {VierSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: VierMove) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** Party players (`{ id, name, color }`) for disc and avatar colours. */
  /** @type {{ id: string, name?: string, color?: string }[]} */
  export let players = [];

  // Part of the shared game-component API; the board reacts to `game` directly.
  $: void renderNonce;

  const COLUMNS = 7;
  const ROWS = 6;
  const columnIndices = Array.from({ length: COLUMNS }, (_, index) => index);
  const rowIndices = Array.from({ length: ROWS }, (_, index) => index);
  /** Used when party colours are missing or too close to tell apart on the board. */
  const FALLBACK = ['#e11d48', '#d97706', '#0891b2', '#7c3aed', '#65a30d'];
  const NEUTRAL = '#64748b';

  const soundSources = {
    drop: '/sounds/select1.mp3',
    win: '/sounds/win1.mp3',
    lose: '/sounds/lose1.mp3',
    draw: '/sounds/ping.mp3'
  };
  /** @type {Map<string, HTMLAudioElement>} */
  const audioCache = new Map();

  let lastSeq = -1;
  let lastSessionId = '';
  /** Cell that plays the drop animation when its disc first appears. */
  let dropIndex = -1;
  /** Optimistic disc while the move is on its way to the server. */
  let pendingIndex = -1;
  let wasLoading = false;
  let focusColumn = 3;
  /** @type {number | null} */
  let hoverColumn = null;
  /** @type {HTMLButtonElement[]} */
  let columnButtons = [];

  $: state = game?.state ?? null;
  $: board = state?.board ?? [];
  $: isRunning = game?.status === 'running';
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: isMyTurn = Boolean(isRunning && me && state?.currentPlayerId === currentPlayerId);
  $: canDrop = isMyTurn && !isLoading && pendingIndex === -1;
  $: colors = discColors(game, players);
  $: turnPlayer = game?.players.find((player) => player.id === state?.currentPlayerId) ?? null;
  $: winner = game?.players.find((player) => player.id === state?.winnerId) ?? null;
  $: statusPlayer = isRunning ? turnPlayer : winner;
  $: statusText = getStatusText(game, isMyTurn, Boolean(me), turnPlayer, winner);
  $: winSet = new Set(state?.winningLine ?? []);
  $: lastIndex = state?.lastMove?.index ?? -1;
  $: heights = columnHeights(board);
  $: seats = game ? [...game.players].sort((a, b) => Number(b.id === currentPlayerId) - Number(a.id === currentPlayerId)) : [];
  $: mySeat = me?.seat ?? 0;
  $: handleEvent(state?.lastEvent ?? null, game?.id ?? '');
  $: handleLoading(isLoading);

  /**
   * Seat colours from the party, with a distinct fallback when they clash.
   * @param {VierSession | null} session
   * @param {{ id: string, color?: string }[]} partyPlayers
   * @returns {[string, string]}
   */
  function discColors(session, partyPlayers) {
    const ids = session?.players.map((player) => player.id) ?? [];
    let first = ids[0] ? playerHexById(partyPlayers ?? [], ids[0]) : NEUTRAL;
    let second = ids[1] ? playerHexById(partyPlayers ?? [], ids[1]) : NEUTRAL;
    if (first === NEUTRAL) first = FALLBACK.find((hex) => !tooClose(hex, second)) ?? FALLBACK[0];
    if (second === NEUTRAL || tooClose(first, second)) second = FALLBACK.find((hex) => !tooClose(hex, first)) ?? FALLBACK[1];
    return [first, second];
  }

  /** @param {string} a @param {string} b */
  function tooClose(a, b) {
    const pa = rgb(a);
    const pb = rgb(b);
    if (!pa || !pb) return false;
    const distance = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
    return distance < 120;
  }

  /** @param {string} hex */
  function rgb(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
    if (!match) return null;
    const value = parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  /** @param {(VierSeat | null)[]} cells */
  function columnHeights(cells) {
    return columnIndices.map((column) => rowIndices.filter((row) => cells[row * COLUMNS + column] != null).length);
  }

  /**
   * @param {VierSession | null} session
   * @param {boolean} myTurn
   * @param {boolean} isPlayer
   * @param {VierPlayer | null} turn
   * @param {VierPlayer | null} won
   */
  function getStatusText(session, myTurn, isPlayer, turn, won) {
    if (!session) return '';
    if (session.status === 'finished') {
      if (session.state.isDraw) return 'Das Brett ist voll – unentschieden.';
      if (won?.id === currentPlayerId) return 'Vier in einer Reihe – du hast gewonnen.';
      return won ? `${won.name} hat vier in einer Reihe.` : 'Die Partie ist beendet.';
    }
    if (myTurn) return 'Wähle eine Spalte für deine Scheibe.';
    const prefix = isPlayer ? '' : 'Du schaust zu. ';
    return turn ? `${prefix}${turn.name} ist am Zug.` : `${prefix}Die Partie läuft.`;
  }

  /**
   * @param {VierEvent | null} event
   * @param {string} sessionId
   */
  function handleEvent(event, sessionId) {
    const seq = event ? event.seq : 0;
    const key = seq + 1;
    if (key === lastSeq && sessionId === lastSessionId) return;
    const isFirst = lastSeq === -1 || sessionId !== lastSessionId;
    lastSeq = key;
    lastSessionId = sessionId;
    const optimistic = pendingIndex;
    pendingIndex = -1;
    if (isFirst || !event) {
      dropIndex = -1;
      return;
    }
    // Keep the animation on the optimistic disc (same element) – otherwise animate the new one.
    if (event.type !== 'start' && typeof event.row === 'number' && typeof event.column === 'number') {
      const index = event.row * COLUMNS + event.column;
      if (index !== optimistic) dropIndex = index;
      if (event.playerId !== currentPlayerId) playSound('drop');
    }
    if (event.type === 'win') playSound(event.playerId === currentPlayerId ? 'win' : 'lose');
    else if (event.type === 'draw') playSound('draw');
  }
  /** @param {boolean} loading */
  function handleLoading(loading) {
    // A rejected move ends loading without a new event: drop the optimistic disc.
    if (wasLoading && !loading && pendingIndex !== -1) pendingIndex = -1;
    wasLoading = loading;
  }

  /** @param {keyof typeof soundSources} name */
  function playSound(name) {
    if (typeof Audio === 'undefined') return;
    let audio = audioCache.get(name);
    if (!audio) {
      audio = new Audio(soundSources[name]);
      audio.preload = 'metadata';
      audioCache.set(name, audio);
    }
    let volume = 0.85;
    try {
      const stored = Number(localStorage.getItem('web-games:effects-volume') ?? '0.85');
      if (Number.isFinite(stored)) volume = Math.max(0, Math.min(1, stored));
    } catch {}
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    void audio.play().catch(() => {});
  }

  /** @param {number} column */
  function drop(column) {
    focusColumn = column;
    if (!canDrop || heights[column] >= ROWS) return;
    const row = ROWS - 1 - heights[column];
    pendingIndex = row * COLUMNS + column;
    dropIndex = pendingIndex;
    playSound('drop');
    onMove({ type: 'drop', column });
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    let next = focusColumn;
    if (event.key === 'ArrowLeft') next = Math.max(0, focusColumn - 1);
    else if (event.key === 'ArrowRight') next = Math.min(COLUMNS - 1, focusColumn + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = COLUMNS - 1;
    else return;
    event.preventDefault();
    focusColumn = next;
    columnButtons[next]?.focus();
  }

  /** @param {PointerEvent} event @param {number} column */
  function handlePointerEnter(event, column) {
    if (event.pointerType === 'mouse') hoverColumn = column;
  }

  /**
   * @param {number} index
   * @param {(VierSeat | null)[]} cells
   * @param {number} pending
   * @param {VierSeat} seat
   * @returns {VierSeat | null}
   */
  function cellSeat(index, cells, pending, seat) {
    const value = cells[index];
    if (value === 0 || value === 1) return value;
    return index === pending ? seat : null;
  }

  /** @param {VierSeat} seat */
  function seatName(seat) {
    return seat === 0 ? 'Ring' : 'Punkt';
  }

  /**
   * Column contents for screen readers, bottom to top.
   * @param {number} column
   * @param {number} height
   * @param {boolean} myTurn
   * @param {(VierSeat | null)[]} cells
   * @param {number} pending
   */
  function columnLabel(column, height, myTurn, cells, pending) {
    const free = ROWS - height;
    const discs = [];
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      const seat = cellSeat(row * COLUMNS + column, cells, pending, mySeat);
      if (seat === null) break;
      const owner = game?.players.find((player) => player.seat === seat);
      discs.push(owner?.id === currentPlayerId ? 'du' : owner?.name ?? seatName(seat));
    }
    const contents = discs.length ? `von unten: ${discs.join(', ')}` : 'leer';
    const fill = free === 0 ? 'voll' : `${free} frei`;
    return `Spalte ${column + 1}, ${contents}; ${fill}${myTurn && free > 0 ? ' – Scheibe einwerfen' : ''}`;
  }
</script>

{#if !game || !state}
  <div class="ui-alert" role="status">Vier in einer Reihe wird über eine Party gestartet, damit zwei Spieler verbunden sind.</div>
{:else}
  <div class="v4" style="--disc-0: {colors[0]}; --disc-1: {colors[1]};">
    <!-- 1. Status -->
    <header class="v4-status">
      <p class="v4-status-text" aria-live="polite" aria-atomic="true">
        {#if statusPlayer}
          <span class="ui-avatar v4-status-avatar" style="--player: {colors[statusPlayer.seat]}" aria-hidden="true">{initials(statusPlayer.name)}</span>
        {/if}
        <span>{statusText}</span>
      </p>
      {#if isMyTurn}
        <span class="ui-chip ui-chip--accent v4-chip">Du bist dran</span>
      {/if}
    </header>

    <!-- 2. Tisch -->
    <section class="v4-table" aria-label="Spielbrett">
      <div class="v4-frame" class:is-active={canDrop} class:is-over={!isRunning && Boolean(state.winnerId)} role="group" aria-label="Spalten, mit Pfeiltasten wählen">
        {#each columnIndices as column (column)}
          {@const full = heights[column] >= ROWS}
          {@const playable = canDrop && !full}
          <button
            bind:this={columnButtons[column]}
            type="button"
            class="v4-col"
            class:is-playable={playable}
            class:is-full={full}
            class:is-hover={playable && hoverColumn === column}
            tabindex={focusColumn === column ? 0 : -1}
            aria-disabled={!playable}
            aria-label={columnLabel(column, heights[column], isMyTurn, board, pendingIndex)}
            on:click={() => drop(column)}
            on:keydown={handleKeydown}
            on:focus={() => (focusColumn = column)}
            on:pointerenter={(event) => handlePointerEnter(event, column)}
            on:pointerleave={() => { if (hoverColumn === column) hoverColumn = null; }}
          >
            <span class="v4-ghost" aria-hidden="true"><span class="v4-disc v4-disc--{mySeat}"></span></span>
            <span class="v4-slots">
            {#each rowIndices as row (row)}
              {@const index = row * COLUMNS + column}
              {@const seat = cellSeat(index, board, pendingIndex, mySeat)}
              <span class="v4-hole">
                {#if seat !== null}
                  <span
                    class="v4-disc v4-disc--{seat}"
                    class:is-drop={index === dropIndex}
                    class:is-win={winSet.has(index)}
                    class:is-last={index === lastIndex && isRunning}
                    style="--fall: {row + 1};"
                    aria-hidden="true"
                  ></span>
                {/if}
              </span>
            {/each}
            </span>
          </button>
        {/each}
      </div>
    </section>

    <!-- 3./4. Wer spielt welche Scheibe -->
    <ul class="v4-seats" aria-label="Scheiben">
      {#each seats as player (player.id)}
        {@const active = isRunning && state.currentPlayerId === player.id}
        <li class="v4-seat" class:is-active={active} class:is-winner={state.winnerId === player.id}>
          <span class="v4-disc v4-disc--{player.seat} v4-seat-disc" aria-hidden="true"></span>
          <span class="v4-seat-meta">
            <span class="v4-seat-name">{player.id === currentPlayerId ? 'Du' : player.name}</span>
            <span class="v4-seat-sub">
              {seatName(player.seat)}{#if active}{' · am Zug'}{:else if state.winnerId === player.id}{' · gewonnen'}{/if}
            </span>
          </span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .v4 {
    /* Brett: ruhige, tief getönte Fläche, Löcher in der Tischfarbe. */
    --frame: #1f2d36;
    --frame-hi: #2a3c48;
    --hole: var(--surface);
    --v4-gap: clamp(6px, 1.8vw, 10px);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    width: 100%;
    max-width: 34rem;
    margin: 12px auto 0;
    color: var(--text);
  }

  :global(html[data-theme='dark']) .v4 {
    --frame: #2a3a45;
    --frame-hi: #344855;
    --hole: var(--ground);
  }

  /* ---------- Status ---------- */
  .v4-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }

  .v4-status-text {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    min-width: 0;
    font-size: 1rem;
    line-height: 1.35;
    font-weight: 600;
    text-wrap: balance;
  }

  .v4-status-avatar {
    flex-shrink: 0;
  }

  .v4-chip {
    flex-shrink: 0;
  }

  /* ---------- Tisch ---------- */
  .v4-table {
    background: var(--surface);
    border-radius: var(--radius-card);
    padding: 12px;
  }

  .v4-frame {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    /* Breite so, dass das Brett unter dem Shell-Kopf ohne Scrollen passt. */
    width: min(100%, calc((100dvh - 18rem) * 7 / 6));
    min-width: min(100%, 17rem);
    margin: 0 auto;
  }

  .v4-col {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    cursor: default;
    overflow: hidden;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
  }

  .v4-col:first-child,
  .v4-col:first-child .v4-slots {
    border-top-left-radius: 18px;
    border-bottom-left-radius: 18px;
  }

  .v4-col:last-child,
  .v4-col:last-child .v4-slots {
    border-top-right-radius: 18px;
    border-bottom-right-radius: 18px;
  }

  /* Der Rahmen: eine Spalten-Leiste je Spalte, zusammen eine ruhige Fläche. */
  .v4-slots {
    display: grid;
    gap: var(--v4-gap);
    padding: calc(var(--v4-gap) * 0.9) calc(var(--v4-gap) / 2);
    /* Gleiche Innenabstände in allen Spalten, damit die Löcher in Reihen fluchten. */
    background: var(--frame);
    transition: background-color 120ms ease;
  }

  .v4-col.is-playable {
    cursor: pointer;
  }

  .v4-col.is-playable:active .v4-slots {
    background: var(--frame-hi);
  }

  .v4-col:focus-visible {
    outline: none;
  }

  .v4-col:focus-visible .v4-slots {
    background: var(--frame-hi);
    box-shadow: inset 0 0 0 2px var(--accent-light, var(--accent-main));
  }

  /* Geisterscheibe nur mit Maus: eine Zeile über dem Brett. */
  .v4-ghost {
    display: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .v4-ghost {
      display: block;
      position: relative;
      margin: 0 calc(var(--v4-gap) / 2) calc(var(--v4-gap) / 2);
      aspect-ratio: 1;
      opacity: 0;
      transition: opacity 100ms ease;
    }

    .v4-col:first-child,
    .v4-col:last-child {
      border-radius: 0;
    }

    .v4-col.is-hover .v4-ghost,
    .v4-col.is-playable:focus-visible .v4-ghost {
      opacity: 0.55;
    }

    .v4-col.is-playable:hover .v4-slots {
      background: var(--frame-hi);
    }
  }

  .v4-hole {
    position: relative;
    display: block;
    aspect-ratio: 1;
    border-radius: 999px;
    background: var(--hole);
  }

  /* ---------- Scheiben ---------- */
  .v4-disc {
    position: absolute;
    inset: 0;
    display: block;
    border-radius: 999px;
    background: var(--disc);
  }

  .v4-ghost .v4-disc,
  .v4-seat-disc {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .v4-disc--0 {
    --disc: var(--disc-0);
  }

  .v4-disc--1 {
    --disc: var(--disc-1);
  }

  /* Zweites Merkmal neben der Farbe: Ring gegen Punkt. */
  .v4-disc::after {
    content: '';
    position: absolute;
    border-radius: 999px;
  }

  .v4-disc--0::after {
    inset: 24%;
    border: max(2px, 0.18em) solid rgb(255 255 255 / 0.78);
  }

  .v4-disc--1::after {
    inset: 36%;
    background: rgb(255 255 255 / 0.82);
  }

  .v4-disc.is-drop {
    animation: v4-drop 250ms cubic-bezier(0.3, 0, 0.6, 1) both;
  }

  @keyframes v4-drop {
    0% {
      transform: translateY(calc(var(--fall) * -1 * (100% + var(--v4-gap))));
    }
    72% {
      transform: translateY(0);
    }
    86% {
      transform: translateY(-9%);
    }
    100% {
      transform: translateY(0);
    }
  }

  /* Letzter Zug: kleine Marke rechts oben. */
  .v4-disc.is-last::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 28%;
    height: 28%;
    border-radius: 999px;
    background: #fff;
    border: 2px solid var(--frame);
  }

  .v4-frame.is-over .v4-disc:not(.is-win) {
    opacity: 0.55;
  }

  .v4-disc.is-win {
    box-shadow:
      inset 0 0 0 3px var(--disc),
      inset 0 0 0 6px #fff;
  }

  /* ---------- Scheiben-Legende ---------- */
  .v4-seats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .v4-seat {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 52px;
    padding: 8px 12px;
    border-radius: var(--radius-inner);
    background: var(--surface);
  }

  .v4-seat.is-active {
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .v4-seat-disc {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
  }

  .v4-seat-meta {
    display: grid;
    min-width: 0;
    line-height: 1.25;
  }

  .v4-seat-name {
    overflow: hidden;
    font-weight: 600;
    font-size: 0.9375rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .v4-seat-sub {
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .v4-seat.is-winner .v4-seat-sub {
    color: var(--positive);
  }

  @media (prefers-reduced-motion: reduce) {
    .v4-disc.is-drop {
      animation: none;
    }

    .v4-slots,
    .v4-ghost {
      transition: none;
    }
  }
</style>
