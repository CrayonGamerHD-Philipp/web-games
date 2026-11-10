<script>
  import { onDestroy, onMount } from 'svelte';
  import HeimDie from './HeimDie.svelte';
  import ItemIcon from './ItemIcon.svelte';
  import { ITEMS } from '../items.js';
  import { SEATS, TRACK, cellOf } from '../board.js';
  import { playerHexById } from '$lib/player-colors.js';
  import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';

  /** @typedef {import('../types').HeimSession} HeimSession */
  /** @typedef {import('../types').HeimPlayer} HeimPlayer */
  /** @typedef {import('../types').HeimLegalMove} HeimLegalMove */
  /** @typedef {import('../types').HeimEvent} HeimEvent */
  /** @typedef {import('../types').HeimMove} HeimMove */

  /** @type {HeimSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: HeimMove) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** Party players (`{ id, name, color }`) for identity colours. */
  /** @type {{ id: string, name?: string, color?: string, avatar?: import('$lib/party-features.js').Avatar | null }[]} */
  export let players = [];

  $: void renderNonce;

  /** Fallback colours per seat when party colours are missing or too similar. */
  const SEAT_DEFAULTS = ['#d1453b', '#2f6fd6', '#d08a12', '#2f8a57'];
  const SHAPE_NAMES = ['Kreis', 'Quadrat', 'Dreieck', 'Raute'];
  const STEP_MS = 85;

  const soundSources = {
    dice: '/sounds/dice1.mp3',
    move: '/sounds/select1.mp3',
    capture: '/sounds/ping.mp3',
    enter: '/sounds/take_card1.mp3',
    item: '/sounds/turn_card1.mp3',
    win: '/sounds/win1.mp3',
    lose: '/sounds/lose1.mp3'
  };
  /** @type {Map<string, HTMLAudioElement>} */
  const audioCache = new Map();

  let reducedMotion = false;
  /** Displayed progress per piece (`playerId:index`), lags behind the server while a move animates. */
  /** @type {Record<string, number>} */
  let shown = {};
  /** @type {Set<string>} */
  let animating = new Set();
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];
  /** @type {string | null} */
  let shownGameId = null;
  let lastMoveSeq = -1;
  let lastEventSeq = -1;
  /** Piece whose target is emphasised (hover / focus). @type {number | null} */
  let previewPiece = null;
  /** @type {HTMLElement | null} */
  let rootEl = null;
  /** Wunschwürfel: Zahlenauswahl offen. */
  let wishOpen = false;
  /** Item, dessen Erklärung gerade gezeigt wird. @type {string | null} */
  let infoItem = null;

  $: state = game?.state ?? null;
  $: isRunning = game?.status === 'running';
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: isMyTurn = Boolean(isRunning && me && state?.currentPlayerId === currentPlayerId);
  $: canRoll = isMyTurn && state?.phase === 'roll' && !isLoading;
  $: legalMoves = isMyTurn && state?.phase === 'move' ? state.legalMoves ?? [] : [];
  $: canMove = legalMoves.length > 0 && !isLoading;
  $: colors = resolveColors(game?.players ?? [], players);
  $: seatPlayers = mapSeats(game?.players ?? []);
  $: turnPlayer = game?.players.find((player) => player.id === state?.currentPlayerId) ?? null;
  $: winner = game?.players.find((player) => player.id === state?.winnerId) ?? null;
  $: others = me ? (game?.players ?? []).filter((player) => player.id !== me?.id) : game?.players ?? [];
  $: statusText = getStatusText(game, me, isMyTurn, turnPlayer, winner, legalMoves.length);
  $: event = state?.lastEvent ?? null;
  $: eventText = getEventText(event, isRunning, currentPlayerId);
  $: isCaptureEvent = event?.type === 'capture';
  $: targets = legalMoves.map((move) => ({ move, cell: me ? cellOf(me.seat, move.to, move.pieceIndex) : /** @type {[number, number]} */ ([0, 0]) }));
  $: syncPieces(game, reducedMotion);
  $: handleEvent(state?.lastEvent ?? null, game);
  $: if (!canMove) previewPiece = null;
  $: dieLabel = getDieLabel(canRoll, state?.dice ?? null, state?.rollsLeft ?? 0, state?.maxRolls ?? 1);
  $: myColor = me ? colors[me.id] : 'var(--accent-main)';
  $: hint = getHint(isMyTurn, state, legalMoves.length);
  $: itemsOn = Boolean(state?.items?.enabled);
  $: boxFields = new Set(itemsOn ? state?.items?.boxes ?? [] : []);
  $: traps = new Map((state?.items?.traps ?? []).map((trap) => [trap.field, trap.ownerId]));
  $: shields = new Set(state?.items?.shields ?? []);
  $: myItems = me?.items ?? [];
  $: if (!isMyTurn || state?.phase !== 'roll') wishOpen = false;

  onMount(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = query.matches;
    /** @param {MediaQueryListEvent} change */
    const update = (change) => (reducedMotion = change.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  onDestroy(clearTimers);

  function clearTimers() {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    animating = new Set();
  }

  /** @param {string} hex */
  function rgb(hex) {
    const value = hex.replace('#', '');
    return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  }

  /** @param {string} a @param {string} b */
  function distance(a, b) {
    const [r1, g1, b1] = rgb(a);
    const [r2, g2, b2] = rgb(b);
    const mean = (r1 + r2) / 2;
    // „Redmean“-Näherung für wahrgenommene Farbdistanz.
    return Math.sqrt((2 + mean / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - mean) / 256) * (b1 - b2) ** 2);
  }

  /**
   * Party colour per player; seat default when missing or too close to an earlier player.
   * @param {HeimPlayer[]} sessionPlayers
   * @param {{ id: string, color?: string }[]} partyPlayers
   */
  function resolveColors(sessionPlayers, partyPlayers) {
    /** @type {Record<string, string>} */
    const result = {};
    /** @type {string[]} */
    const used = [];
    const tooClose = (/** @type {string} */ hex) => used.some((other) => distance(hex, other) < 110);
    for (const player of sessionPlayers) {
      const known = partyPlayers.some((party) => party.id === player.id && party.color);
      let hex = known ? playerHexById(partyPlayers, player.id) : '';
      if (!hex || hex === '#64748b' || tooClose(hex)) {
        const fallbacks = [SEAT_DEFAULTS[player.seat], ...SEAT_DEFAULTS];
        hex = fallbacks.find((candidate) => !tooClose(candidate)) ?? SEAT_DEFAULTS[player.seat];
      }
      used.push(hex);
      result[player.id] = hex;
    }
    return result;
  }

  /** @param {string} hex */
  function inkOn(hex) {
    const [r, g, b] = rgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? '#1c1a14' : '#ffffff';
  }

  /** @param {HeimPlayer[]} sessionPlayers */
  function mapSeats(sessionPlayers) {
    /** @type {(HeimPlayer | null)[]} */
    const bySeat = [null, null, null, null];
    for (const player of sessionPlayers) bySeat[player.seat] = player;
    return bySeat;
  }

  /**
   * @param {HeimSession | null} session
   * @param {HeimPlayer | null} self
   * @param {boolean} myTurn
   * @param {HeimPlayer | null} turn
   * @param {HeimPlayer | null} won
   * @param {number} moveCount
   */
  function getStatusText(session, self, myTurn, turn, won, moveCount) {
    if (!session) return '';
    const st = session.state;
    if (session.status === 'finished') {
      if (won && won.id === self?.id) return 'Alle vier zu Hause – du hast gewonnen!';
      return won ? `${won.name} hat alle Figuren zu Hause und gewinnt.` : 'Die Runde ist beendet.';
    }
    if (!myTurn) {
      const prefix = self ? '' : 'Du schaust zu. ';
      if (!turn) return `${prefix}Das Spiel läuft.`;
      return st.phase === 'move' ? `${prefix}${turn.name} hat eine ${st.dice} und zieht.` : `${prefix}${turn.name} würfelt.`;
    }
    if (st.phase === 'move') {
      const value = st.items?.turbo ? `${st.dice} + 3 Turbo` : `eine ${st.dice}`;
      return moveCount === 1 ? `Du hast ${value}. Ein Zug ist möglich.` : `Du hast ${value}. Wähle eine markierte Figur.`;
    }
    if (st.maxRolls > 1) {
      return st.rollsLeft === st.maxRolls ? 'Würfle – du hast drei Versuche für eine 6.' : `Würfle noch einmal – ${st.rollsLeft === 1 ? 'letzter Versuch' : `${st.rollsLeft} Versuche`}.`;
    }
    return st.dice === 6 && st.lastEvent?.playerId === self?.id ? 'Eine 6 – würfle noch einmal.' : 'Du bist dran: würfle.';
  }

  /**
   * Last event as a secondary line; skipped where it would repeat the status sentence.
   * @param {HeimEvent | null} ev
   * @param {boolean} running
   * @param {string} meId
   */
  function getEventText(ev, running, meId) {
    if (!ev || !running || ev.type === 'start') return '';
    if (ev.type === 'roll' && ev.playerId === meId) return '';
    return ev.text;
  }

  /**
   * @param {boolean} myTurn
   * @param {import('../types').HeimState | null} st
   * @param {number} count
   */
  function getHint(myTurn, st, count) {
    if (!st || !myTurn) return '';
    if (st.phase === 'move') return count === 1 ? 'Tippe die Figur oder „Zug ausführen“.' : 'Tippe eine leuchtende Figur.';
    if (st.maxRolls > 1) return `Versuch ${st.maxRolls - st.rollsLeft + 1} von ${st.maxRolls}`;
    return 'Leertaste oder Enter würfelt.';
  }

  /**
   * @param {boolean} rollable
   * @param {number | null} dice
   * @param {number} left
   * @param {number} max
   */
  function getDieLabel(rollable, dice, left, max) {
    if (rollable) return max > 1 ? `Würfeln, noch ${left} von ${max} Versuchen` : 'Würfeln';
    return dice ? `Würfel zeigt ${dice}` : 'Würfel';
  }

  /**
   * Mirrors server positions into `shown`, walking the last moved piece field by field.
   * @param {HeimSession | null} session
   * @param {boolean} reduced
   */
  function syncPieces(session, reduced) {
    if (!session) return;
    const fresh = session.id !== shownGameId;
    if (fresh) {
      clearTimers();
      shownGameId = session.id;
      shown = {};
    }
    const move = session.state.lastMove;
    const isNewMove = Boolean(move && move.seq !== lastMoveSeq && !fresh);
    lastMoveSeq = move?.seq ?? 0;

    /** @type {Record<string, number>} */
    const next = { ...shown };
    for (const player of session.players) {
      player.pieces.forEach((progress, index) => {
        const key = `${player.id}:${index}`;
        if (!animating.has(key)) next[key] = progress;
      });
    }

    if (isNewMove && move && !reduced) {
      const moverKey = `${move.playerId}:${move.pieceIndex}`;
      const victimKey = move.capture ? `${move.capture.playerId}:${move.capture.pieceIndex}` : null;
      const steps = move.from >= 0 ? move.to - move.from : 0;
      if (steps > 1 && steps <= 6) {
        next[moverKey] = move.from;
        animating.add(moverKey);
        for (let step = 1; step <= steps; step += 1) {
          const value = move.from + step;
          timers.push(setTimeout(() => (shown = { ...shown, [moverKey]: value }), step * STEP_MS));
        }
        if (victimKey) {
          // Die geschlagene Figur bleibt stehen, bis die angreifende ankommt.
          next[victimKey] = cellProgressBefore(session, move);
          animating.add(victimKey);
        }
        timers.push(
          setTimeout(() => {
            animating.delete(moverKey);
            if (victimKey) animating.delete(victimKey);
            animating = animating;
            syncPieces(game, reducedMotion);
          }, steps * STEP_MS + 120)
        );
      }
    }
    animating = animating;
    shown = next;
  }

  /**
   * Progress the captured piece had (same field as the mover's target, from its own seat).
   * @param {HeimSession} session
   * @param {import('../types').HeimLastMove} move
   */
  function cellProgressBefore(session, move) {
    const mover = session.players.find((player) => player.id === move.playerId);
    const victim = session.players.find((player) => player.id === move.capture?.playerId);
    if (!mover || !victim) return -1;
    const absolute = (SEATS[mover.seat].start + move.to) % 40;
    return (absolute - SEATS[victim.seat].start + 40) % 40;
  }

  /**
   * @param {HeimEvent | null} ev
   * @param {HeimSession | null} session
   */
  function handleEvent(ev, session) {
    const seq = ev?.seq ?? 0;
    if (seq === lastEventSeq) return;
    const first = lastEventSeq === -1;
    lastEventSeq = seq;
    if (first || !ev || !session) return;
    if (ev.type === 'win') playSound(ev.playerId === currentPlayerId || !session.players.some((p) => p.id === currentPlayerId) ? 'win' : 'lose');
    else if (ev.type === 'capture') playSound('capture');
    else if (ev.type === 'enter') playSound('enter');
    else if (ev.type === 'item' || ev.type === 'pickup') playSound('item');
    else if (ev.type === 'trap') playSound('capture');
    else if (ev.type === 'move' || ev.type === 'home') playSound('move');
    else if (ev.type !== 'start') playSound('dice');
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

  function roll() {
    if (!canRoll) return;
    onMove({ type: 'roll' });
  }

  /**
   * Alle Abhängigkeiten als Argument, damit Svelte den Knopf bei jedem Phasenwechsel neu bewertet.
   * @param {import('../types').HeimItem} item
   * @param {boolean} myTurn
   * @param {boolean} loading
   * @param {string | undefined} phase
   * @param {boolean} turboOn
   */
  function canUseItem(item, myTurn, loading, phase, turboOn) {
    return Boolean(myTurn && !loading && phase && ITEMS[item].phases.includes(/** @type {'roll' | 'move'} */ (phase)) && !(item === 'turbo' && turboOn));
  }

  /** @param {import('../types').HeimItem} item */
  function useItem(item) {
    if (!canUseItem(item, isMyTurn, isLoading, state?.phase, Boolean(state?.items?.turbo))) return;
    if (item === 'wish') {
      wishOpen = !wishOpen;
      return;
    }
    onMove({ type: 'use-item', item });
  }

  /** @param {number} value */
  function useWish(value) {
    wishOpen = false;
    onMove({ type: 'use-item', item: 'wish', value });
  }

  /** @param {import('../types').HeimItem} item */
  function itemWhen(item) {
    const phases = ITEMS[item].phases;
    if (phases.length === 2) return 'jederzeit in deinem Zug';
    return phases[0] === 'roll' ? 'vor dem Würfeln' : 'nach dem Würfeln';
  }

  /** @param {number} pieceIndex */
  function movePiece(pieceIndex) {
    if (!canMove || !legalMoves.some((move) => move.pieceIndex === pieceIndex)) return;
    previewPiece = null;
    onMove({ type: 'move', pieceIndex });
  }

  /** @param {KeyboardEvent} keyEvent */
  function handleWindowKey(keyEvent) {
    if (keyEvent.key !== ' ' && keyEvent.key !== 'Enter') return;
    if (keyEvent.defaultPrevented || keyEvent.repeat || keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) return;
    const target = /** @type {HTMLElement | null} */ (keyEvent.target);
    if (target && target !== document.body && !rootEl?.contains(target)) return;
    if (target?.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
    if (!canRoll) return;
    keyEvent.preventDefault();
    roll();
  }

  /** @param {[number, number]} cell */
  function place(cell) {
    return `transform: translate(${cell[1] * 100}%, ${cell[0] * 100}%);`;
  }

  /** @param {number} progress */
  function whereText(progress) {
    if (progress < 0) return 'in der Basis';
    if (progress >= 40) return `im Zuhause, Feld ${progress - 39}`;
    if (progress === 0) return 'auf dem Startfeld';
    return `${progress} Felder nach dem Start`;
  }

  /** @param {HeimLegalMove} move */
  function moveText(move) {
    const capture = move.capture ? `, schlägt ${game?.players.find((p) => p.id === move.capture?.playerId)?.name ?? 'eine Figur'}` : '';
    if (move.from < 0) return `rauskommen aufs Startfeld${capture}`;
    if (move.to >= 40) return `ins Zuhause, Feld ${move.to - 39}`;
    return `ziehen auf ${move.to} Felder nach dem Start${capture}`;
  }

  /** @param {number} seat */
  function seatColor(seat) {
    const player = seatPlayers[seat];
    return player ? colors[player.id] : null;
  }

  // Static board layout.
  const trackFields = TRACK.map(([row, col], index) => ({ row, col, startSeat: SEATS.findIndex((seat) => seat.start === index) }));
</script>

<svelte:window on:keydown={handleWindowKey} />

{#if !game || !state}
  <div class="ui-alert" role="status">Ab nach Hause wird über eine Party gestartet, damit alle Mitspieler verbunden sind.</div>
{:else}
  <div class="hb" bind:this={rootEl} class:is-finished={!isRunning}>
    <!-- 1. Status -->
    <header class="hb-status">
      <div class="hb-status-text" aria-live="polite" aria-atomic="true">
        <p class="hb-status-main">{statusText}</p>
        {#if eventText}
          <p class="hb-status-event" class:is-capture={isCaptureEvent}>{eventText}</p>
        {/if}
      </div>
      {#if isMyTurn}
        <span class="ui-chip ui-chip--accent hb-turn-chip">Du bist dran</span>
      {/if}
    </header>

    <!-- 4. Mitspieler -->
    {#if others.length}
      <section class="hb-opps touch-scroll-x" aria-label="Mitspieler">
        <ul class="hb-opps-list">
          {#each others as player (player.id)}
            {@const active = isRunning && state.currentPlayerId === player.id}
            <li class="hb-opp" class:is-active={active} class:is-winner={state.winnerId === player.id}>
              <PlayerAvatar avatar={players.find((p) => p.id === player.id)?.avatar ?? null} name={player.name} color={colors[player.id]} size={36} active={active} />
              <span class="hb-opp-meta">
                <span class="hb-opp-name">{player.name}</span>
                <span class="hb-opp-count ui-num">
                  <svg class="hb-opp-shape" viewBox="0 0 20 20" style="color: {colors[player.id]}" aria-label={SHAPE_NAMES[player.seat]} role="img"><use href="#hb-shape-{player.seat}" /></svg>
                  {player.homeCount}/4 zu Hause{#if active}<span class="hb-opp-state">{' · am Zug'}</span>{/if}
                </span>
                {#if itemsOn && (player.items.length || shields.has(player.id))}
                  <span class="hb-opp-items">
                    {#if shields.has(player.id)}<span class="hb-opp-item" title="Schutzschild aktiv"><ItemIcon name="shield" size={16} /></span>{/if}
                    {#each player.items as item, itemIndex (itemIndex)}
                      <span class="hb-opp-item" title={ITEMS[item].name}><ItemIcon name={item} size={16} /></span>
                    {/each}
                  </span>
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- 2. Brett -->
    <section class="ui-panel hb-table" aria-label="Spielbrett">
      <svg width="0" height="0" class="hb-defs" aria-hidden="true">
        <defs>
          <symbol id="hb-shape-0" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="currentColor" /></symbol>
          <symbol id="hb-shape-1" viewBox="0 0 20 20"><rect x="4.5" y="4.5" width="11" height="11" rx="1.5" fill="currentColor" /></symbol>
          <symbol id="hb-shape-2" viewBox="0 0 20 20"><path d="M10 3.5 L16.8 15.5 H3.2 Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round" /></symbol>
          <symbol id="hb-shape-3" viewBox="0 0 20 20"><path d="M10 2.8 L17.2 10 L10 17.2 L2.8 10 Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round" /></symbol>
        </defs>
      </svg>

      <div class="hb-board" class:has-preview={previewPiece !== null}>
        <!-- Ecken, Zuhause-Reihen (Tönung) -->
        {#each SEATS as seat, seatIndex (seatIndex)}
          {@const color = seatColor(seatIndex)}
          {@const baseRow = Math.min(...seat.base.map((cell) => cell[0]))}
          {@const baseCol = Math.min(...seat.base.map((cell) => cell[1]))}
          {@const homeRows = seat.home.map((cell) => cell[0])}
          {@const homeCols = seat.home.map((cell) => cell[1])}
          <div
            class="hb-zone hb-zone--base"
            class:is-empty={!color}
            style="grid-area: {baseRow + 1} / {baseCol + 1} / span 2 / span 2; --seat: {color ?? 'var(--muted)'}"
          ></div>
          <div
            class="hb-zone hb-zone--home"
            class:is-empty={!color}
            style="grid-area: {Math.min(...homeRows) + 1} / {Math.min(...homeCols) + 1} / {Math.max(...homeRows) + 2} / {Math.max(...homeCols) + 2}; --seat: {color ?? 'var(--muted)'}"
          ></div>
          {#each seat.base as cell, index (index)}
            <span class="hb-field hb-field--slot" style="grid-area: {cell[0] + 1} / {cell[1] + 1}; --seat: {color ?? 'var(--muted)'}" class:is-empty={!color}></span>
          {/each}
          {#each seat.home as cell, index (index)}
            <span class="hb-field hb-field--home" style="grid-area: {cell[0] + 1} / {cell[1] + 1}; --seat: {color ?? 'var(--muted)'}" class:is-empty={!color}></span>
          {/each}
        {/each}

        <!-- Bahn -->
        {#each trackFields as field, index (index)}
          {@const color = field.startSeat >= 0 ? seatColor(field.startSeat) : null}
          <span
            class="hb-field hb-field--track"
            class:is-start={Boolean(color)}
            style="grid-area: {field.row + 1} / {field.col + 1}; {color ? `--seat: ${color}` : ''}"
          >
            {#if color}
              <svg class="hb-start-arrow" viewBox="0 0 20 20" aria-hidden="true"><use href="#hb-shape-{field.startSeat}" /></svg>
            {:else if traps.has(index)}
              {@const owner = traps.get(index) ?? ''}
              <span class="hb-trap" style="--owner: {colors[owner] ?? 'var(--muted)'}" title={`Falle von ${game.players.find((p) => p.id === owner)?.name ?? '?'}`}>
                <ItemIcon name="trap" size={18} />
              </span>
            {:else if boxFields.has(index)}
              <span class="hb-box" title="Glücksfeld: Wer hier landet, bekommt ein Item"><ItemIcon name="box" size={18} /></span>
            {/if}
          </span>
        {/each}

        <!-- Mitte -->
        <span class="hb-center" style="grid-area: 6 / 6" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 11.2 12 4.5l8 6.7V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="currentColor" /></svg>
        </span>

        <!-- Figuren und Zielvorschau -->
        <div class="hb-layer">
          {#each targets as target (target.move.pieceIndex)}
            <span
              class="hb-target"
              class:is-focus={previewPiece === target.move.pieceIndex}
              class:is-dim={previewPiece !== null && previewPiece !== target.move.pieceIndex}
              class:is-capture={Boolean(target.move.capture)}
              style="{place(target.cell)} --seat: {myColor}"
              aria-hidden="true"
            ></span>
          {/each}

          {#each game.players as player (player.id)}
            {@const color = colors[player.id]}
            {#each player.pieces as _progress, index (index)}
              {@const key = `${player.id}:${index}`}
              {@const progress = shown[key] ?? player.pieces[index]}
              {@const cell = cellOf(player.seat, progress, index)}
              {@const legal = player.id === me?.id ? legalMoves.find((move) => move.pieceIndex === index) : undefined}
              {#if legal}
                <button
                  type="button"
                  class="hb-piece is-legal"
                  class:is-shielded={shields.has(player.id)}
                  class:is-moving={animating.has(key)}
                  class:is-preview={previewPiece === index}
                  style="{place(cell)} --seat: {color}; --ink: {inkOn(color)}"
                  disabled={!canMove}
                  aria-label={`Deine Figur ${index + 1} (${whereText(player.pieces[index])}): ${moveText(legal)}`}
                  on:click={() => movePiece(index)}
                  on:focus={() => (previewPiece = index)}
                  on:blur={() => (previewPiece = null)}
                  on:pointerenter={() => (previewPiece = index)}
                  on:pointerleave={() => (previewPiece = null)}
                >
                  <span class="hb-token"><svg viewBox="0 0 20 20" aria-hidden="true"><use href="#hb-shape-{player.seat}" /></svg></span>
                </button>
              {:else}
                <span
                  class="hb-piece"
                  class:is-shielded={shields.has(player.id)}
                  class:is-moving={animating.has(key)}
                  class:is-mine={player.id === me?.id}
                  style="{place(cell)} --seat: {color}; --ink: {inkOn(color)}"
                  role="img"
                  aria-label={`${player.id === me?.id ? 'Deine' : `${player.name}s`} Figur ${index + 1}, ${whereText(player.pieces[index])}`}
                >
                  <span class="hb-token"><svg viewBox="0 0 20 20" aria-hidden="true"><use href="#hb-shape-{player.seat}" /></svg></span>
                </span>
              {/if}
            {/each}
          {/each}
        </div>
      </div>
    </section>

    <!-- 3. Eigener Bereich: Würfel -->
    <section class="hb-mine" aria-label="Dein Zug">
      <HeimDie
        value={state.dice}
        rollSeq={state.rollSeq}
        disabled={!canRoll}
        primary={canRoll}
        label={dieLabel}
        on:roll={roll}
      />
      <div class="hb-mine-info">
        {#if me}
          <p class="hb-mine-line">
            <svg class="hb-mine-shape" viewBox="0 0 20 20" style="color: {myColor}" aria-hidden="true"><use href="#hb-shape-{me.seat}" /></svg>
            <span>Du · <span class="ui-num">{me.homeCount}/4</span> zu Hause</span>
          </p>
          {#if hint}<p class="hb-mine-hint">{hint}</p>{/if}
        {:else}
          <p class="hb-mine-line">Zuschauer</p>
          {#if state.dice}<p class="hb-mine-hint">Letzter Wurf: {state.dice}</p>{/if}
        {/if}
      </div>
      {#if legalMoves.length === 1}
        <button type="button" class="ui-btn ui-btn--primary hb-quick" disabled={!canMove} on:click={() => movePiece(legalMoves[0].pieceIndex)}>
          Zug ausführen
        </button>
      {/if}
    </section>

    {#if itemsOn && me}
      <section class="hb-items" aria-label="Deine Items">
        <div class="hb-items-head">
          <h3 class="hb-items-title">Deine Items</h3>
          {#if shields.has(me.id)}<span class="hb-items-shield"><ItemIcon name="shield" size={16} />Schild aktiv</span>{/if}
        </div>
        {#if myItems.length}
          <ul class="hb-items-list">
            {#each myItems as item, itemIndex (`${item}-${itemIndex}`)}
              {@const usable = canUseItem(item, isMyTurn, isLoading, state.phase, Boolean(state.items?.turbo))}
              <li>
                <button
                  type="button"
                  class="hb-item"
                  class:is-ready={usable}
                  class:is-open={item === 'wish' && wishOpen}
                  disabled={!usable}
                  aria-describedby={`hb-item-hint-${itemIndex}`}
                  on:click={() => useItem(item)}
                  on:pointerenter={() => (infoItem = `${itemIndex}`)}
                  on:pointerleave={() => (infoItem = null)}
                  on:focus={() => (infoItem = `${itemIndex}`)}
                  on:blur={() => (infoItem = null)}
                >
                  <ItemIcon name={item} size={28} />
                  <span class="hb-item-text">
                    <span class="hb-item-name">{ITEMS[item].name}</span>
                    <span class="hb-item-when">{usable ? 'Jetzt einsetzen' : itemWhen(item)}</span>
                  </span>
                </button>
                <p class="hb-item-hint" id={`hb-item-hint-${itemIndex}`} class:is-shown={infoItem === `${itemIndex}`}>{ITEMS[item].hint}</p>
              </li>
            {/each}
          </ul>
          {#if wishOpen}
            <div class="hb-wish" role="group" aria-label="Wunschzahl wählen">
              {#each [1, 2, 3, 4, 5, 6] as value (value)}
                <button type="button" class="hb-wish-btn ui-num" on:click={() => useWish(value)}>{value}</button>
              {/each}
            </div>
          {/if}
        {:else}
          <p class="hb-items-empty">
            <ItemIcon name="box" size={18} />
            Beende einen Zug auf einem ?-Feld, um ein Item zu bekommen (höchstens 2).
          </p>
        {/if}
      </section>
    {/if}
  </div>
{/if}

<style>
  .hb {
    --hb-track: color-mix(in srgb, var(--text) 9%, var(--raised));
    --hb-track-edge: color-mix(in srgb, var(--text) 18%, var(--raised));

    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'status' 'opps' 'board' 'mine' 'items';
    gap: 12px;
    margin-top: 12px;
    color: var(--text);
    min-width: 0;
  }

  /* ---------- 1. Status ---------- */
  .hb-status {
    grid-area: status;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }

  .hb-status-text {
    min-width: 0;
  }

  .hb-status-main {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.35;
    font-weight: 600;
    text-wrap: balance;
  }

  .hb-status-event {
    margin: 2px 0 0;
    font-size: 0.875rem;
    line-height: 1.4;
    color: var(--muted);
    text-wrap: pretty;
  }

  .hb-status-event.is-capture {
    color: var(--negative);
    font-weight: 600;
  }

  .hb-turn-chip {
    flex-shrink: 0;
  }

  /* ---------- 4. Mitspieler ---------- */
  .hb-opps {
    grid-area: opps;
    overflow-x: auto;
    padding: 2px 0;
    scrollbar-width: none;
  }

  .hb-opps::-webkit-scrollbar {
    display: none;
  }

  .hb-opps-list {
    display: flex;
    gap: 8px;
    width: max-content;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .hb-opp {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    max-width: 13rem;
    padding: 6px 12px 6px 8px;
    border-radius: var(--radius-inner);
    background: var(--surface);
    scroll-snap-align: start;
    transition: box-shadow 150ms ease, background-color 150ms ease;
  }

  .hb-opp.is-active {
    background: var(--accent-soft, var(--surface-2));
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .hb-opp-meta {
    display: grid;
    min-width: 0;
  }

  .hb-opp-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .hb-opp-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8125rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .hb-opp-shape {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  .hb-opp-state {
    color: var(--text);
  }

  /* ---------- 2. Brett ---------- */
  .hb-table {
    grid-area: board;
    padding: 8px;
    min-width: 0;
  }

  .hb-defs {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
  }

  .hb-board {
    position: relative;
    display: grid;
    grid-template-columns: repeat(11, minmax(0, 1fr));
    grid-template-rows: repeat(11, minmax(0, 1fr));
    width: 100%;
    max-width: 620px;
    aspect-ratio: 1;
    margin: 0 auto;
  }

  .hb-zone {
    border-radius: 14px;
    background: color-mix(in srgb, var(--seat) 14%, var(--surface));
  }

  .hb-zone--home {
    margin: 8%;
    border-radius: 999px;
    background: color-mix(in srgb, var(--seat) 20%, var(--surface));
  }

  .hb-zone--base {
    margin: -6%;
  }

  .hb-zone.is-empty {
    background: color-mix(in srgb, var(--text) 4%, var(--surface));
  }

  .hb-field {
    align-self: center;
    justify-self: center;
    width: 78%;
    aspect-ratio: 1;
    border-radius: 999px;
  }

  .hb-field--track {
    display: grid;
    place-items: center;
    background: var(--raised);
    box-shadow: inset 0 0 0 1.5px var(--hb-track-edge);
  }

  .hb-field--track.is-start {
    background: color-mix(in srgb, var(--seat) 26%, var(--raised));
    box-shadow: inset 0 0 0 2.5px var(--seat);
    color: var(--seat);
  }

  .hb-box,
  .hb-trap {
    display: grid;
    place-items: center;
    width: 72%;
    height: 72%;
  }

  .hb-box :global(svg),
  .hb-trap :global(svg) {
    width: 100%;
    height: 100%;
  }

  .hb-trap {
    border-radius: 999px;
    box-shadow: 0 0 0 2px var(--owner);
    background: color-mix(in srgb, var(--owner) 18%, var(--raised));
  }

  .hb-piece.is-shielded .hb-token {
    box-shadow: 0 0 0 3px #3fae6b, 0 0 10px 2px rgb(63 174 107 / 0.55);
  }

  .hb-opp-items {
    display: flex;
    gap: 3px;
    margin-top: 2px;
  }

  .hb-opp-item {
    display: inline-flex;
  }

  .hb-items {
    grid-area: items;
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: var(--radius-card);
    background: var(--surface);
  }

  .hb-items-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .hb-items-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
  }

  .hb-items-shield {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--positive);
  }

  .hb-items-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .hb-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 56px;
    padding: 8px 12px;
    border: 0;
    border-radius: var(--radius-inner);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform 140ms ease, box-shadow 140ms ease;
  }

  .hb-item:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .hb-item.is-ready {
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .hb-item.is-ready:hover {
    transform: translateY(-2px);
  }

  .hb-item.is-open {
    background: var(--accent-soft);
  }

  .hb-item:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .hb-item-text {
    display: grid;
    min-width: 0;
  }

  .hb-item-name {
    font-size: 0.9375rem;
    font-weight: 700;
  }

  .hb-item-when {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .hb-item.is-ready .hb-item-when {
    color: var(--accent-text);
    font-weight: 600;
  }

  .hb-item-hint {
    margin: 4px 2px 0;
    font-size: 0.75rem;
    line-height: 1.35;
    color: var(--muted);
  }

  @media (hover: hover) and (pointer: fine) {
    .hb-item-hint {
      display: none;
    }

    .hb-item-hint.is-shown {
      display: block;
    }
  }

  .hb-wish {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }

  .hb-wish-btn {
    min-height: 44px;
    border: 0;
    border-radius: 12px;
    background: #f4c542;
    color: #3d2a00;
    font-size: 1.125rem;
    font-weight: 800;
    cursor: pointer;
  }

  .hb-wish-btn:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .hb-items-empty {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .hb-start-arrow {
    width: 42%;
    height: 42%;
    opacity: 0.55;
  }

  .hb-field--home {
    background: color-mix(in srgb, var(--seat) 30%, var(--raised));
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--seat) 70%, var(--raised));
  }

  .hb-field--slot {
    background: var(--raised);
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--seat) 45%, var(--raised));
  }

  .hb-field.is-empty {
    background: var(--hb-track);
    box-shadow: none;
  }

  .hb-center {
    display: grid;
    place-items: center;
    color: var(--muted);
  }

  .hb-center svg {
    width: 62%;
    height: 62%;
  }

  .hb-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .hb-piece,
  .hb-target {
    position: absolute;
    top: 0;
    left: 0;
    width: calc(100% / 11);
    height: calc(100% / 11);
  }

  .hb-target {
    display: block;
    transform-origin: center;
  }

  .hb-target::after {
    content: '';
    position: absolute;
    inset: 14%;
    border-radius: 999px;
    border: 2.5px dashed var(--seat);
    background: color-mix(in srgb, var(--seat) 16%, transparent);
    transition: opacity 120ms ease;
  }

  /* Schlag-Ziel: Ring liegt über der gegnerischen Figur. */
  .hb-target.is-capture {
    z-index: 4;
  }

  .hb-target.is-capture::after {
    inset: 3%;
    border-style: solid;
    border-color: var(--negative);
    background: none;
  }

  .hb-target.is-focus::after {
    border-style: solid;
    border-width: 3px;
    background: color-mix(in srgb, var(--seat) 34%, transparent);
  }

  .hb-target.is-dim::after {
    opacity: 0.25;
  }

  .hb-piece {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: none;
    transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .hb-piece.is-moving {
    z-index: 3;
    transition: transform 80ms linear;
  }

  .hb-token {
    position: relative;
    display: grid;
    place-items: center;
    width: 70%;
    height: 70%;
    border-radius: 999px;
    background: var(--seat);
    color: var(--ink);
    outline: 2px solid var(--surface);
  }

  .hb-token svg {
    width: 52%;
    height: 52%;
  }

  .hb-piece.is-legal {
    z-index: 2;
    pointer-events: auto;
    cursor: pointer;
  }

  .hb-piece.is-legal .hb-token::before {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 999px;
    border: 2.5px solid var(--text);
    animation: hb-pulse 1.1s ease-in-out infinite;
  }

  .hb-piece.is-legal.is-preview .hb-token::before {
    animation: none;
    border-color: var(--accent-main);
  }

  .hb-piece.is-legal:active:not(:disabled) .hb-token {
    transform: scale(0.9);
  }

  .hb-piece:focus-visible {
    outline: none;
  }

  .hb-piece:focus-visible .hb-token {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .is-finished .hb-piece:not(.is-legal) {
    transition: none;
  }

  /* ---------- 3. Würfel ---------- */
  .hb-mine {
    grid-area: mine;
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 80px;
    padding: 4px 0;
  }

  .hb-mine-info {
    flex: 1;
    min-width: 0;
  }

  .hb-mine-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .hb-mine-shape {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .hb-mine-hint {
    margin: 2px 0 0;
    font-size: 0.8125rem;
    line-height: 1.35;
    color: var(--muted);
  }

  .hb-quick {
    flex-shrink: 0;
    padding: 0 16px;
  }

  @media (min-width: 640px) {
    .hb {
      gap: 16px;
    }

    .hb-table {
      padding: 16px;
    }

    .hb-quick {
      padding: 0 20px;
    }
  }

  @media (min-width: 1024px) {
    .hb {
      grid-template-columns: minmax(0, 652px) minmax(0, 1fr);
      grid-template-rows: auto auto auto 1fr;
      grid-template-rows: auto auto auto auto 1fr;
      grid-template-areas:
        'status status'
        'board mine'
        'board items'
        'board opps'
        'board .';
      column-gap: 24px;
    }

    .hb-mine {
      flex-wrap: wrap;
      align-content: flex-start;
      padding: 16px;
      border-radius: var(--radius-card);
      background: var(--surface);
    }

    .hb-quick {
      width: 100%;
    }

    .hb-opps {
      overflow: visible;
    }

    .hb-opps-list {
      flex-direction: column;
      width: auto;
    }

    .hb-opp {
      max-width: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .hb-piece.is-legal:hover:not(:disabled) .hb-token::before {
      border-color: var(--accent-main);
    }
  }

  @keyframes hb-pulse {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.14); opacity: 0.45; }
  }

  @media (prefers-reduced-motion: reduce) {
    .hb-piece,
    .hb-piece.is-moving {
      transition: none;
    }

    .hb-piece.is-legal .hb-token::before {
      animation: none;
    }
  }
</style>
