<script>
  import { onDestroy, tick } from 'svelte';
  import Die from './Die.svelte';
  import ScoreSheet from './ScoreSheet.svelte';
  import { CATEGORIES, CATEGORY_NAMES, DICE_COUNT, MAX_ROLLS, sheetTotals } from '../rules.js';
  import { initials, playerHexById } from '$lib/player-colors.js';

  /** @typedef {import('../types').BlockSession} BlockSession */
  /** @typedef {import('../types').BlockState} BlockState */
  /** @typedef {import('../types').BlockPlayer} BlockPlayer */
  /** @typedef {import('../types').BlockEvent} BlockEvent */
  /** @typedef {import('../types').BlockMove} BlockMove */
  /** @typedef {import('../types').BlockCategory} BlockCategory */

  /** @type {BlockSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: BlockMove) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** Party players (`{ id, name, color }`) for avatar colours. */
  /** @type {{ id: string, name?: string, color?: string }[]} */
  export let players = [];

  $: void renderNonce;

  const soundSources = {
    roll: '/sounds/dice1.mp3',
    score: '/sounds/select1.mp3',
    strike: '/sounds/turn_card1.mp3',
    turn: '/sounds/ping.mp3',
    win: '/sounds/win1.mp3',
    lose: '/sounds/lose1.mp3'
  };
  /** @type {Map<string, HTMLAudioElement>} */
  const audioCache = new Map();

  /** Local hold state for my own turn: taps feel instant, the server only gets the real move. */
  /** @type {boolean[]} */
  let localHeld = Array(DICE_COUNT).fill(false);
  let heldKey = '';
  /** Holds at the moment of the last roll: only those dice play the landing animation. */
  /** @type {boolean[]} */
  let rolledHeld = Array(DICE_COUNT).fill(false);
  /** rollSeq at the moment I pressed „Würfeln“; -1 = no roll on its way. */
  let rollRequestSeq = -1;
  let sawLoading = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let holdTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let pendingTimer = null;
  let lastSeq = -1;
  let lastTurnFor = '';

  /** @type {string | null} */
  let viewId = null;
  /** @type {HTMLElement | null} */
  let dialogEl = null;
  /** @type {HTMLElement | null} */
  let dialogReturnFocus = null;

  $: state = game?.state ?? null;
  $: isRunning = game?.status === 'running';
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: turnPlayer = game?.players.find((player) => player.id === state?.currentPlayerId) ?? null;
  $: isMyTurn = Boolean(isRunning && me && state?.currentPlayerId === currentPlayerId);
  $: rollsUsed = state?.rollsUsed ?? 0;
  $: rollsLeft = MAX_ROLLS - rollsUsed;
  $: dice = state?.dice ?? Array(DICE_COUNT).fill(0);
  $: hasRolled = rollsUsed > 0;
  $: syncHeld(state, isMyTurn);
  // Assigned directly here so Svelte orders it before canRoll/canScore.
  $: rollPending = computePending(rollRequestSeq, state?.rollSeq ?? 0, isLoading);
  $: shownHeld = isMyTurn ? localHeld : state?.held ?? Array(DICE_COUNT).fill(false);
  $: canHold = isMyTurn && hasRolled && rollsLeft > 0 && !rollPending;
  $: allHeld = localHeld.every(Boolean);
  $: canRoll = isMyTurn && rollsLeft > 0 && !isLoading && !rollPending && !(hasRolled && allHeld);
  $: canScore = isMyTurn && hasRolled && !isLoading && !rollPending;
  $: sheetOwner = me ?? turnPlayer;
  $: previewDice = sheetOwner && state?.currentPlayerId === sheetOwner.id && hasRolled ? dice : null;
  $: opponents = orderOpponents(game, currentPlayerId);
  $: winner = game?.players.find((player) => player.id === state?.winnerId) ?? null;
  $: statusText = getStatusText(game, isMyTurn, Boolean(me), turnPlayer, winner, rollsUsed, allHeld);
  $: eventText = state?.lastEvent?.text ?? '';
  $: recentCategory = state?.lastEvent?.playerId === sheetOwner?.id ? state?.lastEvent?.category ?? null : null;
  $: rollLabel = rollsLeft > 0 ? `Würfeln (${rollsLeft} übrig)` : 'Keine Würfe mehr';
  $: viewPlayer = viewId ? game?.players.find((player) => player.id === viewId) ?? null : null;
  $: handleEvent(state?.lastEvent ?? null);
  $: handleTurn(state?.currentPlayerId ?? null, isMyTurn);

  /**
   * Reset local holds whenever a new roll lands or the turn changes.
   * @param {BlockState | null} currentState
   * @param {boolean} myTurn
   */
  function syncHeld(currentState, myTurn) {
    if (!currentState) return;
    const key = `${currentState.currentPlayerId}:${currentState.turnCount}:${currentState.rollSeq}:${myTurn}`;
    if (key === heldKey) return;
    heldKey = key;
    localHeld = [...(currentState.held ?? Array(DICE_COUNT).fill(false))];
    rolledHeld = [...localHeld];
  }

  /**
   * A roll request settles when a new roll lands or the request ended without one (error).
   * @param {number} requestSeq
   * @param {number} seq
   * @param {boolean} loading
   */
  function computePending(requestSeq, seq, loading) {
    if (requestSeq === -1) return false;
    if (loading) sawLoading = true;
    if (seq !== requestSeq || (sawLoading && !loading)) {
      rollRequestSeq = -1;
      return false;
    }
    return true;
  }

  function stopPending() {
    rollRequestSeq = -1;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  /**
   * Opponents in turn order, starting after me.
   * @param {BlockSession | null} session
   * @param {string} meId
   */
  function orderOpponents(session, meId) {
    if (!session) return [];
    const order = session.state.turnOrder?.length ? session.state.turnOrder : session.players.map((player) => player.id);
    const start = order.indexOf(meId);
    const rotated = start === -1 ? order : [...order.slice(start + 1), ...order.slice(0, start)];
    return rotated
      .map((id) => session.players.find((player) => player.id === id))
      .filter((player) => player && player.id !== meId)
      .map((player) => /** @type {BlockPlayer} */ (player));
  }

  /**
   * @param {BlockSession | null} session
   * @param {boolean} myTurn
   * @param {boolean} isPlayer
   * @param {BlockPlayer | null} turn
   * @param {BlockPlayer | null} won
   * @param {number} used
   * @param {boolean} everyHeld
   */
  function getStatusText(session, myTurn, isPlayer, turn, won, used, everyHeld) {
    if (!session) return '';
    if (session.status === 'finished') {
      if (session.state.isDraw) return 'Unentschieden – der Block ist voll.';
      if (won && won.id === currentPlayerId) return session.players.length === 1 ? 'Block voll – gut gewürfelt.' : 'Du hast gewonnen.';
      return won ? `${won.name} hat gewonnen.` : 'Die Runde ist beendet.';
    }
    if (!myTurn) {
      const prefix = isPlayer ? '' : 'Du schaust zu. ';
      if (!turn) return `${prefix}Das Spiel läuft.`;
      return used ? `${prefix}${turn.name} würfelt (Wurf ${used} von ${MAX_ROLLS}).` : `${prefix}${turn.name} ist am Zug.`;
    }
    if (used === 0) return 'Du bist dran: würfle.';
    if (used >= MAX_ROLLS) return 'Trag dein Ergebnis in eine freie Zeile ein.';
    if (everyHeld) return 'Alle Würfel gehalten: trag ein oder gib einen frei.';
    return 'Halte Würfel und würfle erneut – oder trag ein.';
  }

  /** @param {BlockEvent | null} event */
  function handleEvent(event) {
    const seq = event?.seq ?? 0;
    if (seq === lastSeq) return;
    const isFirst = lastSeq === -1;
    lastSeq = seq;
    if (isFirst || !event) return;
    if (event.type === 'roll') playSound('roll');
    else if (event.type === 'score') playSound('score');
    else if (event.type === 'strike') playSound('strike');
    else if (event.type === 'finish') {
      const won = game?.state.winnerId === currentPlayerId;
      if (me) playSound(won ? 'win' : 'lose');
    }
  }

  /**
   * @param {string | null} turnId
   * @param {boolean} myTurn
   */
  function handleTurn(turnId, myTurn) {
    const key = `${turnId}:${state?.turnCount ?? 0}`;
    if (key === lastTurnFor) return;
    const isFirst = lastTurnFor === '';
    lastTurnFor = key;
    if (!isFirst && myTurn && (game?.players.length ?? 0) > 1) playSound('turn');
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

  /** @param {number} index */
  function toggleHold(index) {
    if (!canHold) return;
    localHeld = localHeld.map((value, i) => (i === index ? !value : value));
    // Kurz entprellt an den Server, damit Zuschauer die Auswahl live sehen.
    if (holdTimer) clearTimeout(holdTimer);
    const held = [...localHeld];
    const roll = rollsUsed;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      if (isMyTurn && rollsUsed === roll) onMove({ type: 'hold', held, roll });
    }, 350);
  }

  function roll() {
    if (!canRoll) return;
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
    rollRequestSeq = state?.rollSeq ?? 0;
    sawLoading = false;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(stopPending, 4000);
    onMove({ type: 'roll', held: hasRolled ? [...localHeld] : Array(DICE_COUNT).fill(false) });
  }

  /** @param {BlockCategory} category */
  function score(category) {
    if (!canScore) return;
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
    onMove({ type: 'score', category });
  }

  /** @param {BlockPlayer} player */
  function filledCount(player) {
    return CATEGORIES.filter((category) => typeof player.sheet[category] === 'number').length;
  }

  /** @param {string} id */
  async function openSheet(id) {
    dialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    viewId = id;
    await tick();
    dialogEl?.querySelector('button')?.focus();
  }

  function closeSheet() {
    viewId = null;
    const target = dialogReturnFocus;
    dialogReturnFocus = null;
    if (target && target.isConnected) target.focus();
  }

  /** @param {KeyboardEvent} event */
  function handleDialogKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== 'Tab' || !dialogEl) return;
    const focusables = Array.from(dialogEl.querySelectorAll('button'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onDestroy(() => {
    if (holdTimer) clearTimeout(holdTimer);
    if (pendingTimer) clearTimeout(pendingTimer);
  });
</script>

{#if !game || !state}
  <div class="ui-alert" role="status">Würfelblock wird über eine Party gestartet, damit alle Mitspieler verbunden sind.</div>
{:else}
  <div class="wb" class:is-finished={!isRunning}>
    <!-- 1. Status -->
    <header class="wb-status">
      <div class="wb-status-text" aria-live="polite" aria-atomic="true">
        <p class="wb-status-main">{statusText}</p>
        {#if eventText && eventText !== statusText}
          <p class="wb-status-event">{eventText}</p>
        {/if}
      </div>
      {#if isMyTurn}
        <span class="ui-chip ui-chip--accent wb-turn-chip">Du bist dran</span>
      {/if}
    </header>

    <!-- 4. Mitspieler kompakt -->
    {#if opponents.length}
      <section class="wb-opps touch-scroll-x" aria-label="Mitspieler">
        <ul class="wb-opps-list">
          {#each opponents as player (player.id)}
            {@const active = isRunning && state.currentPlayerId === player.id}
            {@const filled = filledCount(player)}
            <li>
              <button
                type="button"
                class="wb-opp"
                class:is-active={active}
                aria-haspopup="dialog"
                aria-label={`${player.name}: ${player.total} Punkte, ${filled} von 13 Zeilen${active ? ', am Zug' : ''}. Block ansehen`}
                on:click={() => openSheet(player.id)}
              >
                <span class="ui-avatar" style="--player: {playerHexById(players, player.id)}" aria-hidden="true">{initials(player.name)}</span>
                <span class="wb-opp-meta" aria-hidden="true">
                  <span class="wb-opp-line">
                    <span class="wb-opp-name">{player.name}</span>
                    <span class="wb-opp-total ui-num">{player.total}</span>
                  </span>
                  <span class="wb-ticks">
                    {#each CATEGORIES as category (category)}
                      <span class="wb-tick" class:is-on={typeof player.sheet[category] === 'number'}></span>
                    {/each}
                    {#if active}<span class="wb-opp-state">am Zug</span>{/if}
                  </span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <div class="wb-main">
      <!-- 2. Tisch: Würfel (mobil unten angeheftet) -->
      <div class="wb-tray-wrap">
        <section class="ui-panel wb-tray" class:is-mine={isMyTurn} aria-label="Würfel">
          <div class="wb-tray-head">
            <p class="wb-tray-title">
              {#if !isRunning}
                Letzter Wurf
              {:else if isMyTurn}
                Deine Würfel
              {:else if turnPlayer}
                <span class="ui-avatar wb-tray-avatar" style="--player: {playerHexById(players, turnPlayer.id)}" aria-hidden="true">{initials(turnPlayer.name)}</span>
                {turnPlayer.name}
              {/if}
            </p>
            <p class="wb-tray-meta ui-num">
              Runde {Math.min(state.round, 13)}/13 · Wurf {rollsUsed}/{MAX_ROLLS}
            </p>
          </div>

          <div class="wb-dice" role="group" aria-label={isMyTurn ? 'Deine Würfel – antippen zum Halten' : 'Würfel des aktiven Spielers'}>
            {#each dice as value, index (index)}
              <Die
                {value}
                {index}
                held={hasRolled && Boolean(shownHeld[index])}
                interactive={isMyTurn}
                disabled={!canHold}
                shaking={rollPending}
                landing={hasRolled && !rolledHeld[index]}
                landKey={state.rollSeq}
                onToggle={toggleHold}
              />
            {/each}
          </div>

          {#if isMyTurn}
            <div class="wb-tray-actions">
              <p class="wb-tray-hint">
                {#if !hasRolled}
                  Drei Würfe pro Zug.
                {:else if rollsLeft > 0}
                  Antippen hält einen Würfel.
                {:else}
                  Wähle eine Zeile auf deinem Block.
                {/if}
              </p>
              <button type="button" class="ui-btn ui-btn--primary ui-btn--lg wb-roll" disabled={!canRoll} on:click={roll}>
                {rollLabel}
              </button>
            </div>
          {:else if isRunning}
            <p class="wb-tray-hint wb-tray-hint--watch">
              {#if me}Du siehst live zu, was {turnPlayer?.name ?? 'der aktive Spieler'} hält.{:else}Live-Ansicht.{/if}
            </p>
          {/if}
        </section>
      </div>

      <!-- 3. Eigener Block -->
      {#if sheetOwner}
        <section class="wb-mine" aria-labelledby="wb-mine-title">
          <div class="wb-mine-head">
            <h2 class="wb-mine-title" id="wb-mine-title">
              {#if me}Dein Block{:else}Block von {sheetOwner.name}{/if}
            </h2>
            {#if canScore}
              <span class="wb-mine-tip">Zeile antippen zum Eintragen</span>
            {/if}
          </div>
          <ScoreSheet
            sheet={sheetOwner.sheet}
            dice={previewDice}
            {canScore}
            recent={recentCategory}
            idPrefix="wb-own"
            onScore={score}
          />
        </section>
      {/if}
    </div>
  </div>

  {#if viewPlayer}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="ui-dialog-backdrop" role="presentation" on:click|self={closeSheet}>
      <div
        bind:this={dialogEl}
        class="ui-dialog wb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wb-dialog-title"
        tabindex="-1"
        on:keydown={handleDialogKeydown}
      >
        <div class="wb-dialog-head">
          <span class="ui-avatar" style="--player: {playerHexById(players, viewPlayer.id)}" aria-hidden="true">{initials(viewPlayer.name)}</span>
          <div class="wb-dialog-meta">
            <h2 id="wb-dialog-title" class="wb-dialog-title">Block von {viewPlayer.name}</h2>
            <p class="wb-dialog-sub ui-num">{sheetTotals(viewPlayer.sheet).total} Punkte · {filledCount(viewPlayer)} von 13 Zeilen</p>
          </div>
          <button type="button" class="ui-btn ui-btn--ghost ui-btn--icon" aria-label="Schließen" on:click={closeSheet}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          </button>
        </div>
        <ScoreSheet sheet={viewPlayer.sheet} idPrefix="wb-view" />
      </div>
    </div>
  {/if}
{/if}

<style>
  .wb {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin-top: 12px;
    color: var(--text);
    min-width: 0;
  }

  /* ---------- 1. Status ---------- */
  .wb-status {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }

  .wb-status-text {
    min-width: 0;
  }

  .wb-status-main {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.35;
    font-weight: 600;
    text-wrap: balance;
  }

  .wb-status-event {
    margin: 2px 0 0;
    font-size: 0.875rem;
    line-height: 1.4;
    color: var(--muted);
    text-wrap: pretty;
  }

  .wb-turn-chip {
    flex-shrink: 0;
  }

  /* ---------- 4. Mitspieler ---------- */
  .wb-opps {
    overflow-x: auto;
    padding: 2px 0;
    scrollbar-width: none;
  }

  .wb-opps::-webkit-scrollbar {
    display: none;
  }

  .wb-opps-list {
    display: flex;
    gap: 8px;
    width: max-content;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .wb-opp {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 52px;
    max-width: 13rem;
    padding: 6px 12px 6px 8px;
    border: 0;
    border-radius: var(--radius-inner);
    background: var(--surface);
    color: var(--text);
    text-align: left;
    cursor: pointer;
    scroll-snap-align: start;
    transition: background-color 150ms ease, transform 120ms ease;
    touch-action: manipulation;
  }

  .wb-opp:active {
    transform: scale(0.97);
  }

  .wb-opp:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: 2px;
  }

  .wb-opp.is-active {
    background: var(--accent-soft, var(--surface-2));
    outline: 2px solid var(--accent-main);
    outline-offset: -2px;
  }

  .wb-opp-meta {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .wb-opp-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .wb-opp-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .wb-opp-total {
    margin-left: auto;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .wb-ticks {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .wb-tick {
    width: 4px;
    height: 8px;
    border-radius: 2px;
    background: var(--control);
  }

  .wb-tick.is-on {
    background: var(--text);
  }

  .wb-opp-state {
    margin-left: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--accent-text);
    white-space: nowrap;
  }

  @media (min-width: 1024px) {
    .wb-opps {
      overflow: visible;
    }

    .wb-opps-list {
      flex-wrap: wrap;
      width: auto;
    }
  }

  /* ---------- Hauptbereich ---------- */
  .wb-main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  /* Mobil: Würfel unten angeheftet, der Block scrollt darüber. */
  .wb-tray-wrap {
    order: 2;
    position: sticky;
    bottom: 0;
    z-index: 5;
    padding: 8px 0 max(8px, env(safe-area-inset-bottom));
    margin-bottom: -8px;
    background: var(--ground);
  }

  .wb-mine {
    order: 1;
    min-width: 0;
  }

  @media (min-width: 900px) {
    .wb-main {
      display: grid;
      grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
      align-items: start;
      gap: 20px;
    }

    .wb-tray-wrap {
      order: 0;
      position: sticky;
      top: 16px;
      bottom: auto;
      padding: 0;
      margin: 0;
      background: transparent;
    }

    .wb-mine {
      order: 0;
    }
  }

  /* ---------- 2. Würfel ---------- */
  .wb-tray {
    display: grid;
    gap: 10px;
    padding: 12px 10px;
  }

  .wb-tray {
    border: 2px solid transparent;
  }

  .wb-tray.is-mine {
    border-color: var(--accent-main);
  }

  .wb-tray-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 4px;
  }

  .wb-tray-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .wb-tray-avatar {
    width: 24px;
    height: 24px;
    font-size: 0.6875rem;
  }

  .wb-tray-meta {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .wb-dice {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 72px));
    justify-content: center;
    gap: 6px;
    padding-top: 8px;
  }

  @media (min-width: 400px) {
    .wb-dice {
      gap: 10px;
    }
  }

  .wb-tray-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 2px;
  }

  .wb-tray-hint {
    margin: 0;
    min-width: 0;
    font-size: 0.8125rem;
    line-height: 1.35;
    color: var(--muted);
  }

  .wb-tray-hint--watch {
    padding: 0 4px;
    min-height: 20px;
  }

  .wb-roll {
    flex-shrink: 0;
    min-width: 11rem;
  }

  @media (min-width: 900px) {
    .wb-tray-actions {
      flex-direction: column-reverse;
      align-items: stretch;
      text-align: center;
    }
  }

  /* ---------- 3. Block ---------- */
  .wb-mine-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .wb-mine-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .wb-mine-tip {
    font-size: 0.8125rem;
    color: var(--muted);
  }

  /* ---------- Dialog ---------- */
  .wb-dialog {
    max-width: 560px;
    padding: 20px 16px;
    animation: wb-sheet-in 200ms ease-out;
  }

  .wb-dialog-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .wb-dialog-meta {
    flex: 1;
    min-width: 0;
  }

  .wb-dialog-title {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .wb-dialog-sub {
    margin: 2px 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  @keyframes wb-sheet-in {
    from { transform: translateY(16px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (hover: hover) and (pointer: fine) {
    .wb-opp:hover {
      background: var(--surface-2);
    }

    .wb-opp.is-active:hover {
      background: var(--accent-soft, var(--surface-2));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wb-opp,
    .wb-dialog {
      transition: none;
      animation: none;
    }
  }
</style>
