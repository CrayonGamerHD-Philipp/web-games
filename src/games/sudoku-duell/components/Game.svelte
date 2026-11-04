<script>
  import { onDestroy, tick } from 'svelte';
  import { initials, playerHexById } from '$lib/player-colors.js';

  /** @typedef {import('../types').SudokuSession} SudokuSession */
  /** @typedef {import('../types').SudokuPlayer} SudokuPlayer */
  /** @typedef {import('../types').SudokuEvent} SudokuEvent */
  /** @typedef {import('../types').SudokuMove} SudokuMove */

  /** @type {SudokuSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: SudokuMove) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** Party players (`{ id, name, color }`) for avatar colours. */
  /** @type {{ id: string, name?: string, color?: string }[]} */
  export let players = [];

  // Kept for the shared game-component API; the board reacts to `game` directly.
  $: void renderNonce;
  // Moves are independent and fast; the pad never waits for a request to finish.
  $: void isLoading;

  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const CELLS = Array.from({ length: 81 }, (_, index) => index);
  const ROW = CELLS.map((cell) => Math.floor(cell / 9));
  const COL = CELLS.map((cell) => cell % 9);
  const BOX = CELLS.map((cell) => Math.floor(ROW[cell] / 3) * 3 + Math.floor(COL[cell] / 3));
  const DIFFICULTY_LABEL = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };

  const soundSources = {
    place: '/sounds/select1.mp3',
    note: '/sounds/turn_card1.mp3',
    mistake: '/sounds/ping.mp3',
    win: '/sounds/win1.mp3',
    lose: '/sounds/lose1.mp3'
  };
  /** @type {Map<string, HTMLAudioElement>} */
  const audioCache = new Map();

  /** @type {number | null} */
  let selected = null;
  let notesMode = false;
  /** Pencil marks: one bitmask per cell, local to this device. */
  /** @type {number[]} */
  let notes = new Array(81).fill(0);
  /** @type {string | null} */
  let notesGameId = null;
  /** Optimistic entries waiting for the server: cell -> value. */
  /** @type {Record<number, number>} */
  let pending = {};
  /** @type {number | null} */
  let shakeCell = null;
  let padShake = false;
  /** @type {HTMLButtonElement[]} */
  let cellEls = [];
  let clockOffset = 0;
  let nowTick = Date.now();
  /** @type {ReturnType<typeof setInterval> | null} */
  let ticker = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let shakeTimer = null;
  let lastSeq = -1;
  let lastMistakes = -1;
  /** @type {string | null} */
  let lastMistakeGame = null;
  /** @type {number[]} */
  let prevEntries = [];

  $: state = game?.state ?? null;
  $: isRunning = game?.status === 'running';
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: givens = state?.givens ?? new Array(81).fill(0);
  $: entries = me?.entries?.length === 81 ? me.entries : new Array(81).fill(0);
  // Local bookkeeping first: these update `notes` / `pending`, which the board values below read.
  $: loadNotes(game?.id ?? null);
  $: trackEntries(game?.id ?? null, entries);
  $: trackMistakes(game?.id ?? null, me);
  $: canPlay = Boolean(isRunning && me && !me.finished && !me.gaveUp);
  $: opponents = (game?.players ?? []).filter((player) => player.id !== currentPlayerId);
  $: winner = game?.players.find((player) => player.id === state?.winnerId) ?? null;
  $: emptyCount = state?.emptyCount ?? 0;
  $: myLeft = me ? Math.max(0, emptyCount - (me.filledCount ?? 0)) : emptyCount;

  $: syncClock(state?.serverNow);
  $: blockedUntil = canPlay ? me?.blockedUntil ?? null : null;
  $: blockedMs = blockedUntil ? Math.max(0, blockedUntil - (nowTick + clockOffset)) : 0;
  $: isBlocked = blockedMs > 0;
  $: blockedSeconds = Math.ceil(blockedMs / 1000);
  $: blockFraction = isBlocked ? Math.min(1, blockedMs / (state?.blockMs ?? 5000)) : 0;
  $: ensureTicker(blockedUntil);

  $: values = CELLS.map((cell) => givens[cell] || entries[cell] || pending[cell] || 0);
  $: digitCounts = countDigits(givens, entries);
  $: selectedValue = selected === null ? 0 : values[selected];

  $: handleEvent(state?.lastEvent ?? null, game?.status ?? null);

  $: statusText = getStatusText(game, me, winner, isBlocked, myLeft);
  $: eventText = getEventText(state?.lastEvent ?? null);

  /** @param {number | undefined} serverNow */
  function syncClock(serverNow) {
    if (typeof serverNow === 'number') clockOffset = serverNow - Date.now();
    nowTick = Date.now();
  }

  /** @param {number | null} until */
  function ensureTicker(until) {
    if (until && !ticker && typeof window !== 'undefined') {
      ticker = setInterval(() => {
        nowTick = Date.now();
        if (!blockedUntil || nowTick + clockOffset >= blockedUntil) stopTicker();
      }, 200);
    } else if (!until) {
      stopTicker();
    }
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
    nowTick = Date.now();
  }

  onDestroy(() => {
    stopTicker();
    if (shakeTimer) clearTimeout(shakeTimer);
  });

  /** @param {number[]} given @param {number[]} own */
  function countDigits(given, own) {
    const counts = new Array(10).fill(0);
    for (let cell = 0; cell < 81; cell += 1) {
      const value = given[cell] || own[cell];
      if (value) counts[value] += 1;
    }
    return counts;
  }

  /** @param {string | null} id */
  function notesKey(id) {
    return `web-games:sudoku-duell:notes:${id}`;
  }

  /** @param {string | null} id */
  function loadNotes(id) {
    if (id === notesGameId) return;
    notesGameId = id;
    selected = null;
    pending = {};
    let loaded = new Array(81).fill(0);
    if (id) {
      try {
        const raw = JSON.parse(localStorage.getItem(notesKey(id)) ?? 'null');
        if (Array.isArray(raw) && raw.length === 81) loaded = raw.map((mask) => (Number.isInteger(mask) ? mask & 0x3fe : 0));
      } catch {}
    }
    notes = loaded;
  }

  function saveNotes() {
    if (!notesGameId) return;
    try {
      if (notes.some(Boolean)) localStorage.setItem(notesKey(notesGameId), JSON.stringify(notes));
      else localStorage.removeItem(notesKey(notesGameId));
    } catch {}
  }

  /**
   * Newly confirmed entries: drop the pending marker and clear that digit from the notes of its peers.
   * @param {string | null} id
   * @param {number[]} current
   */
  function trackEntries(id, current) {
    void id;
    let changed = false;
    const next = [...notes];
    const nextPending = { ...pending };
    for (let cell = 0; cell < 81; cell += 1) {
      const value = current[cell];
      if (!value || prevEntries[cell] === value) continue;
      delete nextPending[cell];
      if (prevEntries.length !== 81) continue;
      next[cell] = 0;
      const bit = 1 << value;
      for (let other = 0; other < 81; other += 1) {
        if ((ROW[other] === ROW[cell] || COL[other] === COL[cell] || BOX[other] === BOX[cell]) && next[other] & bit) next[other] &= ~bit;
      }
      changed = true;
    }
    prevEntries = [...current];
    pending = nextPending;
    if (changed) {
      notes = next;
      saveNotes();
    }
  }

  /**
   * @param {string | null} id
   * @param {SudokuPlayer | null} player
   */
  function trackMistakes(id, player) {
    const count = player?.mistakes ?? 0;
    if (id !== lastMistakeGame) {
      lastMistakeGame = id;
      lastMistakes = count;
      return;
    }
    if (count > lastMistakes) {
      const cell = player?.lastMistakeCell ?? null;
      if (cell !== null) {
        const nextPending = { ...pending };
        delete nextPending[cell];
        pending = nextPending;
      }
      triggerShake(cell);
      playSound('mistake');
    }
    lastMistakes = count;
  }

  /** @param {number | null} cell */
  function triggerShake(cell) {
    if (shakeTimer) clearTimeout(shakeTimer);
    shakeCell = null;
    padShake = false;
    void tick().then(() => {
      shakeCell = cell;
      padShake = true;
      shakeTimer = setTimeout(() => {
        shakeCell = null;
        padShake = false;
      }, 450);
    });
  }

  /**
   * @param {SudokuEvent | null} event
   * @param {string | null} status
   */
  function handleEvent(event, status) {
    const seq = event?.seq ?? 0;
    if (seq === lastSeq) return;
    const isFirst = lastSeq === -1;
    lastSeq = seq;
    if (isFirst || !event) return;
    if (event.type === 'win' && status === 'finished') {
      playSound(event.playerId === currentPlayerId ? 'win' : 'lose');
    } else if (event.type === 'place' && event.playerId === currentPlayerId) {
      playSound('place');
    }
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

  /**
   * @param {SudokuSession | null} session
   * @param {SudokuPlayer | null} player
   * @param {SudokuPlayer | null} won
   * @param {boolean} blocked
   * @param {number} left
   */
  function getStatusText(session, player, won, blocked, left) {
    if (!session) return '';
    if (session.status === 'finished') {
      if (session.state.isDraw) return 'Alle haben aufgegeben. Diesmal gewinnt niemand.';
      if (won && won.id === currentPlayerId) return 'Geschafft! Du warst zuerst fertig.';
      return won ? `${won.name} war zuerst fertig und gewinnt.` : 'Das Spiel ist beendet.';
    }
    if (!player) return 'Du schaust zu. Alle lösen gleichzeitig dasselbe Sudoku.';
    if (player.gaveUp) return 'Du hast aufgegeben. Die anderen spielen weiter.';
    if (blocked) return 'Falsche Zahl – du bist kurz gesperrt.';
    return `Füll alle Felder richtig aus. Noch ${left} ${left === 1 ? 'Feld' : 'Felder'}.`;
  }

  /** @param {SudokuEvent | null} event */
  function getEventText(event) {
    if (!event || event.type === 'place' || event.type === 'start' || event.type === 'win' || event.type === 'draw') return '';
    if (event.type === 'mistake' && event.playerId === currentPlayerId) return '';
    return event.text;
  }

  /** @param {number} cell */
  function selectCell(cell) {
    selected = cell;
  }

  /** @param {number} cell */
  async function focusCell(cell) {
    selected = cell;
    await tick();
    cellEls[cell]?.focus();
  }

  /** @param {number} digit */
  function enterDigit(digit) {
    if (selected === null || !canPlay) return;
    const cell = selected;
    if (givens[cell] || entries[cell] || pending[cell]) return;
    if (notesMode) {
      const next = [...notes];
      next[cell] ^= 1 << digit;
      notes = next;
      saveNotes();
      return;
    }
    if (isBlocked) {
      triggerShake(null);
      return;
    }
    if (digitCounts[digit] >= 9) return;
    pending = { ...pending, [cell]: digit };
    const sentFor = notesGameId;
    setTimeout(() => {
      // Safety net if the server answer never arrives (e.g. rejected request).
      if (notesGameId === sentFor && pending[cell] === digit) {
        const nextPending = { ...pending };
        delete nextPending[cell];
        pending = nextPending;
      }
    }, 4000);
    onMove({ type: 'place', cell, value: digit });
  }

  function eraseNotes() {
    if (selected === null || !notes[selected]) return;
    const next = [...notes];
    next[selected] = 0;
    notes = next;
    saveNotes();
  }

  function giveUp() {
    if (!canPlay) return;
    if (typeof window !== 'undefined' && !window.confirm('Wirklich aufgeben? Du kannst danach nicht mehr mitspielen.')) return;
    onMove({ type: 'give-up' });
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const key = event.key;
    if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      if (selected === null) void focusCell(firstEmpty());
      enterDigit(Number(key));
      return;
    }
    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (key in moves) {
      event.preventDefault();
      if (selected === null) {
        void focusCell(firstEmpty());
        return;
      }
      const row = ROW[selected];
      const col = COL[selected];
      const nextRow = key === 'ArrowUp' ? (row + 8) % 9 : key === 'ArrowDown' ? (row + 1) % 9 : row;
      const nextCol = key === 'ArrowLeft' ? (col + 8) % 9 : key === 'ArrowRight' ? (col + 1) % 9 : col;
      void focusCell(nextRow * 9 + nextCol);
      return;
    }
    if (key === 'Backspace' || key === 'Delete' || key === '0') {
      event.preventDefault();
      eraseNotes();
      return;
    }
    if (key === 'n' || key === 'N') {
      event.preventDefault();
      notesMode = !notesMode;
    }
  }

  function firstEmpty() {
    const cell = CELLS.find((index) => !values[index]);
    return cell ?? 0;
  }

  /**
   * @param {number} cell
   * @param {number} value
   * @param {number} mask
   */
  function cellLabel(cell, value, mask) {
    const where = `Zeile ${ROW[cell] + 1}, Spalte ${COL[cell] + 1}`;
    if (givens[cell]) return `${where}, Vorgabe ${value}`;
    if (entries[cell]) return `${where}, deine ${value}`;
    if (value) return `${where}, ${value} wird geprüft`;
    const marked = DIGITS.filter((digit) => mask & (1 << digit));
    return marked.length ? `${where}, leer, Notizen ${marked.join(' ')}` : `${where}, leer`;
  }

  /** @param {SudokuPlayer} player */
  function playerMeta(player) {
    if (player.finished) return '100 %';
    if (player.gaveUp) return 'aufgegeben';
    const percent = Math.round((player.progress ?? 0) * 100);
    return `${percent} %`;
  }
</script>

{#if !game || !state}
  <div class="ui-alert" role="status">Sudoku-Duell wird über eine Party gestartet, damit alle Mitspieler verbunden sind.</div>
{:else}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="sd" class:is-finished={!isRunning} on:keydown={handleKeydown}>
    <!-- 1. Status -->
    <header class="sd-status">
      <div class="sd-status-text" aria-live="polite" aria-atomic="true">
        <p class="sd-status-main">{statusText}</p>
        {#if eventText}
          <p class="sd-status-event">{eventText}</p>
        {/if}
      </div>
      {#if canPlay && isBlocked}
        <span class="ui-chip sd-chip ui-num">Gesperrt · {blockedSeconds} s</span>
      {:else if canPlay}
        <span class="ui-chip ui-chip--accent sd-chip">Du bist dran</span>
      {:else}
        <span class="ui-chip sd-chip">{DIFFICULTY_LABEL[state.difficulty] ?? 'Sudoku'}</span>
      {/if}
    </header>

    <!-- 4. Mitspieler (kompakt, mobil als wischbarer Streifen) -->
    {#if opponents.length}
      <section class="sd-opps touch-scroll-x" aria-label="Fortschritt der Mitspieler">
        <ul class="sd-opps-list">
          {#each opponents as player (player.id)}
            {@const hex = playerHexById(players, player.id)}
            <li class="sd-opp" class:is-winner={state.winnerId === player.id} class:is-out={player.gaveUp}>
              <span class="ui-avatar sd-opp-avatar" style="--player: {hex}" aria-hidden="true">{initials(player.name)}</span>
              <span class="sd-opp-meta">
                <span class="sd-opp-line">
                  <span class="sd-opp-name">{player.name}</span>
                  {#if player.finished}<span class="sd-badge">fertig</span>{/if}
                </span>
                <span
                  class="sd-bar"
                  role="progressbar"
                  aria-label="Fortschritt von {player.name}"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={Math.round((player.progress ?? 0) * 100)}
                >
                  <span class="sd-bar-fill" style="--player: {hex}; transform: scaleX({player.progress ?? 0});"></span>
                </span>
                <span class="sd-opp-count ui-num">
                  {playerMeta(player)} · {player.mistakes} {player.mistakes === 1 ? 'Fehler' : 'Fehler'}
                </span>
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <div class="sd-main">
      <!-- 2. Tisch: das gemeinsame Rätsel -->
      <section class="ui-panel sd-table" aria-label="Sudoku">
        <div class="sd-grid" role="group" aria-label="Sudoku-Feld, Pfeiltasten zum Bewegen, Ziffern zum Eintragen">
          {#each CELLS as cell (cell)}
            {@const value = values[cell]}
            {@const mask = notes[cell]}
            {@const isGiven = Boolean(givens[cell])}
            {@const isPending = !isGiven && !entries[cell] && Boolean(value)}
            {@const isPeer = selected !== null && (ROW[cell] === ROW[selected] || COL[cell] === COL[selected] || BOX[cell] === BOX[selected])}
            <button
              type="button"
              class="sd-cell"
              class:is-given={isGiven}
              class:is-own={!isGiven && Boolean(entries[cell])}
              class:is-pending={isPending}
              class:is-peer={isPeer}
              class:is-same={Boolean(selectedValue) && value === selectedValue}
              class:is-selected={selected === cell}
              class:is-shake={shakeCell === cell}
              class:edge-r={COL[cell] === 2 || COL[cell] === 5}
              class:edge-b={ROW[cell] === 2 || ROW[cell] === 5}
              tabindex={(selected ?? 0) === cell ? 0 : -1}
              aria-label={cellLabel(cell, value, mask)}
              aria-pressed={selected === cell}
              bind:this={cellEls[cell]}
              on:click={() => selectCell(cell)}
            >
              {#if value}
                <span class="sd-value">{value}</span>
              {:else if mask}
                <span class="sd-notes" aria-hidden="true">
                  {#each DIGITS as digit}
                    <span class:is-on={mask & (1 << digit)} class:is-match={selectedValue === digit}>{digit}</span>
                  {/each}
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </section>

      <!-- 3. Eigener Bereich: Werkzeuge und Ziffernblock -->
      {#if canPlay}
      <section class="sd-own" aria-label="Eingabe">
        <div class="sd-tools">
          <button
            type="button"
            class="ui-btn sd-tool"
            class:is-on={notesMode}
            aria-pressed={notesMode}
            aria-label="Notizen {notesMode ? 'aus' : 'an'} (Taste N)"
            disabled={!canPlay}
            on:click={() => (notesMode = !notesMode)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
            Notizen {notesMode ? 'an' : 'aus'}
          </button>
          <button
            type="button"
            class="ui-btn sd-tool"
            aria-label="Notizen im Feld löschen (Entf)"
            disabled={!canPlay || selected === null || !notes[selected]}
            on:click={eraseNotes}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5h11v14H9l-6-7 6-7Z M12.5 9.5l5 5 M17.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" /></svg>
            Löschen
          </button>
          <span class="sd-mine ui-num" aria-label="Deine Fehler">{me ? `${me.mistakes} Fehler` : ''}</span>
        </div>

        <div class="sd-pad-wrap" class:is-shake={padShake}>
          <div class="sd-pad" class:is-notes={notesMode} class:is-blocked={isBlocked && !notesMode}>
            {#each DIGITS as digit}
              {@const done = digitCounts[digit] >= 9}
              <button
                type="button"
                class="sd-key"
                class:is-done={done}
                class:is-match={selectedValue === digit}
                disabled={!canPlay || (done && !notesMode)}
                aria-label={done ? `${digit}, alle neun gesetzt` : notesMode ? `Notiz ${digit}` : `${digit} eintragen, noch ${9 - digitCounts[digit]}`}
                on:click={() => enterDigit(digit)}
              >
                <span class="sd-key-digit">{digit}</span>
                <span class="sd-key-left ui-num" aria-hidden="true">{done ? 'fertig' : 9 - digitCounts[digit]}</span>
              </button>
            {/each}
          </div>
          {#if isBlocked && !notesMode}
            <div class="sd-cooldown" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="56" height="56">
                <circle cx="24" cy="24" r="20" class="sd-ring-track" />
                <circle cx="24" cy="24" r="20" class="sd-ring" style="stroke-dashoffset: {125.66 * (1 - blockFraction)}" />
              </svg>
              <span class="sd-cooldown-num ui-num">{blockedSeconds}</span>
            </div>
          {/if}
        </div>

        <button type="button" class="ui-btn ui-btn--ghost sd-giveup" on:click={giveUp}>Aufgeben</button>
      </section>
      {/if}
    </div>
  </div>
{/if}

<style>
  .sd {
    --sd-line: color-mix(in srgb, var(--text) 16%, transparent);
    --sd-strong: color-mix(in srgb, var(--text) 72%, transparent);
    --sd-cell: var(--raised);
    --sd-given: var(--text);
    --sd-own: var(--accent-text, var(--accent-main));
    --sd-peer: color-mix(in srgb, var(--accent-main) 8%, var(--raised));
    --sd-same: color-mix(in srgb, var(--accent-main) 24%, var(--raised));
    --sd-sel: color-mix(in srgb, var(--accent-main) 34%, var(--raised));
    --sd-bad: var(--negative);

    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    margin-top: 12px;
    color: var(--text);
    min-width: 0;
  }

  :global(html[data-theme='dark']) .sd {
    --sd-own: color-mix(in srgb, var(--accent-main) 55%, #fff);
    --sd-peer: color-mix(in srgb, var(--accent-main) 12%, var(--raised));
    --sd-same: color-mix(in srgb, var(--accent-main) 34%, var(--raised));
    --sd-sel: color-mix(in srgb, var(--accent-main) 48%, var(--raised));
  }

  /* ---------- 1. Status ---------- */
  .sd-status {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-height: 32px;
  }

  .sd-status-text {
    min-width: 0;
  }

  .sd-status-main {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.35;
    font-weight: 600;
    text-wrap: balance;
  }

  .sd-status-event {
    margin: 2px 0 0;
    font-size: 0.875rem;
    line-height: 1.4;
    color: var(--muted);
  }

  .sd-chip {
    flex-shrink: 0;
  }

  /* ---------- 4. Opponents ---------- */
  .sd-opps {
    overflow-x: auto;
    scrollbar-width: none;
    margin-inline: -4px;
    padding-inline: 4px;
  }

  .sd-opps::-webkit-scrollbar {
    display: none;
  }

  .sd-opps-list {
    display: flex;
    gap: 8px;
    width: max-content;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sd-opp {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 10.5rem;
    min-height: 48px;
    padding: 6px 12px 6px 6px;
    border-radius: var(--radius-inner);
    background: var(--surface);
    scroll-snap-align: start;
  }

  .sd-opp.is-winner {
    box-shadow: inset 0 0 0 2px var(--positive);
  }

  .sd-opp.is-out {
    opacity: 0.6;
  }

  .sd-opp-meta {
    display: grid;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }

  .sd-opp-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .sd-opp-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .sd-badge {
    flex-shrink: 0;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--positive) 16%, var(--ground));
    color: var(--positive);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .sd-bar {
    display: block;
    height: 6px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .sd-bar-fill {
    display: block;
    height: 100%;
    background: var(--player);
    transform-origin: left center;
    transition: transform 300ms ease;
  }

  .sd-opp-count {
    font-size: 0.75rem;
    color: var(--muted);
    white-space: nowrap;
  }

  /* ---------- Layout ---------- */
  .sd-main {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  /* ---------- 2. Board ---------- */
  .sd-table {
    padding: 6px;
    border-radius: var(--radius-inner);
    justify-self: center;
    width: 100%;
    max-width: 480px;
  }

  .sd-grid {
    display: grid;
    grid-template-columns: repeat(9, minmax(0, 1fr));
    aspect-ratio: 1;
    width: 100%;
    border: 2px solid var(--sd-strong);
    border-radius: 6px;
    overflow: hidden;
    background: var(--sd-cell);
  }

  .sd-cell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: 0;
    border-right: 1px solid var(--sd-line);
    border-bottom: 1px solid var(--sd-line);
    background: var(--sd-cell);
    color: var(--sd-given);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .sd-cell:nth-child(9n) {
    border-right: 0;
  }

  .sd-cell:nth-last-child(-n + 9) {
    border-bottom: 0;
  }

  .sd-cell.edge-r {
    border-right: 2px solid var(--sd-strong);
  }

  .sd-cell.edge-b {
    border-bottom: 2px solid var(--sd-strong);
  }

  .sd-cell.is-peer {
    background: var(--sd-peer);
  }

  .sd-cell.is-same {
    background: var(--sd-same);
  }

  .sd-cell.is-selected {
    background: var(--sd-sel);
  }

  .sd-cell:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: -2px;
    z-index: 1;
  }

  .sd-value {
    font-size: clamp(1.25rem, 5.6vw, 1.75rem);
    line-height: 1;
    font-weight: 600;
  }

  .sd-cell.is-own .sd-value {
    color: var(--sd-own);
    font-weight: 500;
  }

  .sd-cell.is-pending .sd-value {
    color: var(--muted);
    font-weight: 500;
  }

  .sd-notes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
    height: 100%;
    padding: 2px;
    font-size: clamp(0.5625rem, 2.3vw, 0.75rem);
    line-height: 1;
    color: var(--muted);
  }

  .sd-notes span {
    display: flex;
    align-items: center;
    justify-content: center;
    visibility: hidden;
  }

  .sd-notes span.is-on {
    visibility: visible;
  }

  .sd-notes span.is-match {
    color: var(--text);
    font-weight: 600;
  }

  .sd-cell.is-shake {
    animation: sd-shake 380ms ease;
    background: color-mix(in srgb, var(--sd-bad) 22%, var(--raised));
  }

  @keyframes sd-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-4px); }
    40% { transform: translateX(4px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(2px); }
  }

  /* ---------- 3. Own area ---------- */
  .sd-own {
    display: grid;
    gap: 8px;
    align-content: start;
    width: 100%;
    max-width: 480px;
    justify-self: center;
    min-width: 0;
  }

  .sd-tools {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sd-tool {
    padding: 0 14px;
    gap: 6px;
  }

  .sd-tool.is-on {
    background: var(--accent-soft, var(--surface-2));
    color: var(--accent-text, var(--accent-main));
    box-shadow: inset 0 0 0 1.5px var(--accent-main);
  }

  .sd-mine {
    margin-left: auto;
    font-size: 0.875rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .sd-pad-wrap {
    position: relative;
  }

  .sd-pad-wrap.is-shake {
    animation: sd-shake 380ms ease;
  }

  .sd-pad {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }

  .sd-key {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 54px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-inner);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    transition: background-color 120ms ease, transform 100ms ease, opacity 150ms ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .sd-key:active:not(:disabled) {
    transform: scale(0.95);
    background: var(--surface-2);
  }

  .sd-key:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: 2px;
  }

  .sd-key-digit {
    font-size: 1.5rem;
    line-height: 1;
    font-weight: 600;
  }

  .sd-key-left {
    font-size: 0.6875rem;
    line-height: 1;
    color: var(--muted);
  }

  .sd-key.is-match {
    box-shadow: inset 0 0 0 1.5px var(--accent-main);
  }

  .sd-key.is-done {
    opacity: 0.4;
    cursor: default;
  }

  .sd-key.is-done .sd-key-digit {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
  }

  .sd-key:disabled:not(.is-done) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sd-pad.is-notes .sd-key-digit {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--accent-text, var(--accent-main));
  }

  .sd-pad.is-blocked .sd-key {
    opacity: 0.35;
  }

  .sd-cooldown {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .sd-cooldown svg {
    grid-area: 1 / 1;
    transform: rotate(-90deg);
    border-radius: 999px;
    background: var(--raised);
  }

  .sd-ring-track,
  .sd-ring {
    fill: none;
    stroke-width: 4;
  }

  .sd-ring-track {
    stroke: var(--surface-2);
  }

  .sd-ring {
    stroke: var(--sd-bad);
    stroke-linecap: round;
    stroke-dasharray: 125.66;
    transition: stroke-dashoffset 200ms linear;
  }

  .sd-cooldown-num {
    position: relative;
    grid-area: 1 / 1;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sd-bad);
  }

  .sd-giveup {
    justify-self: start;
    color: var(--muted);
  }

  @media (hover: hover) and (pointer: fine) {
    .sd-cell:hover:not(.is-selected) {
      background: var(--sd-same);
    }

    .sd-key:hover:not(:disabled) {
      background: var(--surface-2);
    }
  }

  /* ---------- Wider screens: board left, pad and players right ---------- */
  @media (min-width: 900px) {
    .sd {
      grid-template-columns: minmax(0, 540px) minmax(16rem, 20rem);
      grid-template-rows: auto auto 1fr;
      grid-template-areas:
        'status status'
        'table own'
        'table opps';
      gap: 16px 28px;
      align-items: start;
      justify-content: center;
    }

    .sd-status {
      grid-area: status;
    }

    .sd-main {
      display: contents;
    }

    .sd-table {
      grid-area: table;
      max-width: none;
      padding: 10px;
    }

    .sd-own {
      grid-area: own;
      max-width: none;
    }

    .sd-opps {
      grid-area: opps;
      overflow: visible;
      margin: 0;
      padding: 0;
    }

    .sd-opps-list {
      flex-direction: column;
      width: auto;
    }

    .sd-opp {
      width: auto;
    }

    .sd-pad {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .sd-key {
      min-height: 68px;
    }

    .sd-key-digit {
      font-size: 1.75rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sd-cell.is-shake,
    .sd-pad-wrap.is-shake {
      animation: none;
    }

    .sd-bar-fill,
    .sd-ring,
    .sd-key {
      transition: none;
    }
  }
</style>
