<script>
  import PlayingCard from './PlayingCard.svelte';
  import { initials, playerHexById } from '$lib/player-colors.js';

  /** @typedef {{ id: string, value: number | null, revealed: boolean, removed: boolean }} SkyjoSlot */
  /** @typedef {{ id: string, value: number }} SkyjoCard */
  /** @typedef {{ id: string, name: string, grid: SkyjoSlot[], roundScore: number }} SkyjoPlayer */

  /** @type {any} */
  export let game;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: { type: string, source?: string, cardIndex?: number }) => void} */
  export let onMove = () => {};
  /** Party players ({ id, name, color }) for avatar colours. */
  /** @type {{ id: string, name?: string, color?: string }[]} */
  export let players = [];

  let draggedDrawnCard = false;
  let draggedDiscardCard = false;
  let drawnCardSelected = false;
  let lastDrawnCardId = '';

  const soundSources = {
    draw: '/sounds/take_card1.mp3',
    reveal: '/sounds/turn_card1.mp3',
    select: '/sounds/select1.mp3',
    confirm: '/sounds/ping.mp3'
  };

  const audioCache = new Map();

  $: me = /** @type {SkyjoPlayer | undefined} */ (game.players.find((/** @type {SkyjoPlayer} */ player) => player.id === currentPlayerId));
  $: opponents = /** @type {SkyjoPlayer[]} */ (game.players.filter((/** @type {SkyjoPlayer} */ player) => player.id !== currentPlayerId));
  $: phase = game.state.phase;
  $: isMyTurn = game.state.currentPlayerId === currentPlayerId;
  $: topDiscard = game.state.discardPile.at(-1) ?? null;
  $: drawnCard = game.state.drawnCard ?? null;
  $: isFinished = game.status === 'finished' || phase === 'finished';
  $: canDraw = phase !== 'setup' && !isFinished && isMyTurn && !drawnCard && !isLoading;
  $: canUseDrawnCard = Boolean(isMyTurn && drawnCard && !isLoading && !isFinished);
  $: forcedReplace = game.state.drawnFrom === 'discard';
  $: currentDrawnCardId = drawnCard?.id ?? '';
  $: if (currentDrawnCardId !== lastDrawnCardId) {
    lastDrawnCardId = currentDrawnCardId;
    drawnCardSelected = forcedReplace;
  }
  $: if (forcedReplace) drawnCardSelected = true;
  $: swapMode = forcedReplace || drawnCardSelected || draggedDrawnCard;
  $: currentTurnName = game.players.find((/** @type {SkyjoPlayer} */ player) => player.id === game.state.currentPlayerId)?.name ?? '';
  $: myRevealed = me ? me.grid.filter((/** @type {SkyjoSlot} */ slot) => slot.revealed).length : 0;
  $: setupPending = phase === 'setup' && myRevealed < 2;
  $: statusText = getStatusText(phase, isFinished, isMyTurn, currentTurnName, drawnCard, forcedReplace, swapMode, setupPending, myRevealed);

  /**
   * @param {string} phase
   * @param {boolean} isFinished
   * @param {boolean} isMyTurn
   * @param {string} currentTurnName
   * @param {SkyjoCard | null} drawnCard
   * @param {boolean} forcedReplace
   * @param {boolean} swapMode
   * @param {boolean} setupPending
   * @param {number} myRevealed
   */
  function getStatusText(phase, isFinished, isMyTurn, currentTurnName, drawnCard, forcedReplace, swapMode, setupPending, myRevealed) {
    if (isFinished) return 'Runde beendet – alle Karten werden aufgedeckt.';
    if (phase === 'setup') {
      return setupPending
        ? `Decke ${2 - myRevealed === 2 ? 'zwei' : 'noch eine'} deiner Karten auf.`
        : 'Warte, bis alle ihre zwei Karten aufgedeckt haben.';
    }
    if (!isMyTurn) return `${currentTurnName} ist am Zug.`;
    if (!drawnCard) return 'Zieh vom Stapel oder nimm die Ablage.';
    if (forcedReplace) return 'Tausche die Ablagekarte gegen eine deiner Karten.';
    if (swapMode) return 'Tippe die Karte, die du ersetzen willst.';
    return 'Verdeckte Karte aufdecken oder offene tauschen.';
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

  /** @param {'deck' | 'discard'} source */
  function drawCard(source) {
    if (!canDraw) return;
    if (source === 'discard' && !topDiscard) return;
    playSound(source === 'discard' ? 'select' : 'draw');
    onMove({ type: 'draw', source });
  }

  /** @param {SkyjoPlayer} player */
  function visibleScore(player) {
    return player.grid.reduce((score, slot) => (slot.removed || !slot.revealed ? score : score + (slot.value ?? 0)), 0);
  }

  /** @param {SkyjoSlot} slot */
  function canTargetSlot(slot) {
    if (slot.removed || isLoading || isFinished) return false;
    if (setupPending) return !slot.revealed;
    if (!canUseDrawnCard) return false;
    // Revealed cards can only ever be swapped, so they are always valid targets.
    if (swapMode || slot.revealed) return true;
    return game.state.drawnFrom === 'deck';
  }

  /** @param {SkyjoSlot} slot */
  function canDropOnSlot(slot) {
    if (slot.removed) return false;
    if (draggedDiscardCard) return Boolean(canDraw && topDiscard);
    if (draggedDrawnCard) return canUseDrawnCard;
    return false;
  }

  /** @param {number} cardIndex */
  function handleOwnCardClick(cardIndex) {
    if (!me || isLoading) return;
    const slot = me.grid[cardIndex];
    if (!canTargetSlot(slot)) return;

    if (phase === 'setup') {
      playSound('reveal');
      onMove({ type: 'reveal-start', cardIndex });
      return;
    }

    if (swapMode || slot.revealed) {
      playSound('confirm');
      onMove({ type: 'replace', cardIndex });
      drawnCardSelected = false;
      return;
    }

    playSound('reveal');
    onMove({ type: 'discard-and-reveal', cardIndex });
  }

  /** @param {boolean} value */
  function setSwapMode(value) {
    if (!canUseDrawnCard || forcedReplace) return;
    if (value !== drawnCardSelected) playSound('select');
    drawnCardSelected = value;
  }

  /** @param {DragEvent} event */
  function handleDrawnDragStart(event) {
    if (!canUseDrawnCard) return;
    draggedDrawnCard = true;
    drawnCardSelected = true;
    event.dataTransfer?.setData('text/plain', 'drawn-card');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /** @param {DragEvent} event */
  function handleDiscardDragStart(event) {
    if (!canDraw || !topDiscard) return;
    draggedDiscardCard = true;
    event.dataTransfer?.setData('text/plain', 'discard-card');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    draggedDrawnCard = false;
    draggedDiscardCard = false;
  }

  /**
   * @param {DragEvent} event
   * @param {number} cardIndex
   */
  function handleCardDragOver(event, cardIndex) {
    if (!me || !canDropOnSlot(me.grid[cardIndex])) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  /**
   * @param {DragEvent} event
   * @param {number} cardIndex
   */
  function handleCardDrop(event, cardIndex) {
    if (!me || !canDropOnSlot(me.grid[cardIndex])) return;
    event.preventDefault();

    if (draggedDiscardCard) {
      draggedDiscardCard = false;
      playSound('confirm');
      onMove({ type: 'replace-from-discard', cardIndex });
      return;
    }

    draggedDrawnCard = false;
    playSound('confirm');
    onMove({ type: 'replace', cardIndex });
    drawnCardSelected = false;
  }
</script>

<div class="skyjo">
  <header class="g-status">
    <p class="g-status-text" aria-live="polite">{statusText}</p>
    {#if isMyTurn && !isFinished && phase !== 'setup'}
      <span class="ui-chip ui-chip--accent">Du bist dran</span>
    {/if}
  </header>

  <div class="sk-layout">
    <section class="sk-table" aria-label="Spieltisch">
      <div class="sk-piles">
        <div class="sk-pile">
          <PlayingCard
            hidden
            value={null}
            disabled={!canDraw}
            dropTarget={canDraw}
            badge={game.state.deckCount}
            label="Nachziehstapel"
            on:activate={() => drawCard('deck')}
          />
          <span class="sk-pile-label">Stapel</span>
        </div>
        <div class="sk-pile">
          <PlayingCard
            value={topDiscard?.value ?? null}
            removed={!topDiscard}
            disabled={!canDraw || !topDiscard}
            dropTarget={canDraw && Boolean(topDiscard)}
            draggable={canDraw && Boolean(topDiscard)}
            label="Ablage"
            on:activate={() => drawCard('discard')}
            on:dragstart={handleDiscardDragStart}
            on:dragend={handleDragEnd}
          />
          <span class="sk-pile-label">Ablage</span>
        </div>
        <div class="sk-pile sk-pile--drawn" class:is-active={Boolean(drawnCard)}>
          <PlayingCard
            value={drawnCard?.value ?? null}
            removed={!drawnCard}
            selected={Boolean(drawnCard) && swapMode && canUseDrawnCard}
            disabled={!canUseDrawnCard || forcedReplace}
            draggable={canUseDrawnCard}
            label="Gezogene Karte"
            on:activate={() => setSwapMode(!drawnCardSelected)}
            on:dragstart={handleDrawnDragStart}
            on:dragend={handleDragEnd}
          />
          <span class="sk-pile-label">Gezogen</span>
        </div>
      </div>

      {#if canUseDrawnCard && !forcedReplace}
        <div class="g-segment sk-mode" role="group" aria-label="Was tun mit der gezogenen Karte?">
          <button type="button" class="g-segment-btn" class:is-on={swapMode} aria-pressed={swapMode} on:click={() => setSwapMode(true)}>
            Tauschen
          </button>
          <button type="button" class="g-segment-btn" class:is-on={!swapMode} aria-pressed={!swapMode} on:click={() => setSwapMode(false)}>
            Aufdecken
          </button>
        </div>
      {/if}
    </section>

    {#if me}
      <section class="sk-mine" aria-label="Deine Karten">
        <div class="sk-mine-inner">
          <div class="g-me">
            <span class="ui-avatar" style={`--player: ${playerHexById(players, me.id)}`} aria-hidden="true">{initials(me.name)}</span>
            <h2 class="g-me-name">{me.name}</h2>
            <span class="g-me-stat" title="Summe der offenen Karten">
              <span class="ui-muted">Offen</span>
              <span class="g-me-value ui-num">{visibleScore(me)}</span>
            </span>
          </div>
          <div class="sk-grid sk-grid--mine">
            {#each me.grid as slot, cardIndex (cardIndex)}
              <PlayingCard
                value={slot.value}
                hidden={!slot.revealed}
                removed={slot.removed}
                dropTarget={draggedDrawnCard || draggedDiscardCard ? canDropOnSlot(slot) : canTargetSlot(slot)}
                revealDelayMs={isFinished && !slot.removed ? cardIndex * 60 : 0}
                disabled={!canTargetSlot(slot) && !canDropOnSlot(slot)}
                label={`Deine Karte ${cardIndex + 1}`}
                on:activate={() => handleOwnCardClick(cardIndex)}
                on:dragover={(event) => handleCardDragOver(event, cardIndex)}
                on:drop={(event) => handleCardDrop(event, cardIndex)}
              />
            {/each}
          </div>
        </div>
      </section>
    {/if}
  </div>

  {#if opponents.length > 0}
    <section class="g-opponents" aria-label="Mitspieler">
      <ul class="g-opp-track">
        {#each opponents as player (player.id)}
          {@const active = player.id === game.state.currentPlayerId && !isFinished}
          <li class="g-opp sk-opp" class:is-active={active}>
            <div class="g-opp-head">
              <span class="ui-avatar" style={`--player: ${playerHexById(players, player.id)}`} aria-hidden="true">{initials(player.name)}</span>
              <span class="g-opp-name">{player.name}</span>
              <span class="g-opp-stat ui-num" title="Summe der offenen Karten">{visibleScore(player)}</span>
            </div>
            <div class="sk-grid sk-grid--opp">
              {#each player.grid as slot, cardIndex (cardIndex)}
                <PlayingCard
                  size="xs"
                  value={slot.value}
                  hidden={!slot.revealed}
                  removed={slot.removed}
                  revealDelayMs={isFinished && !slot.removed ? 700 + cardIndex * 40 : 0}
                  disabled
                  label={`Karte ${cardIndex + 1} von ${player.name}`}
                />
              {/each}
            </div>
            {#if active}<span class="sr-only">{player.name} ist am Zug</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  /* Rahmen nach DESIGN.md: Statuszeile, Tisch (Tonfläche), eigener Bereich, Mitspieler-Streifen.
     Dieselben g-* Regeln stehen in Tic Tac Toe und Schiffe versenken. */
  .skyjo {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    color: var(--text);
  }

  /* ---------- 1. Statuszeile ---------- */
  .g-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }

  .g-status-text {
    margin: 0;
    min-width: 0;
    font-size: 1rem;
    line-height: 1.35;
    font-weight: 600;
    color: var(--text);
    text-wrap: balance;
  }

  .g-status :global(.ui-chip) {
    flex-shrink: 0;
  }

  /* ---------- 2. Tisch ---------- */
  .sk-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .sk-table {
    display: grid;
    gap: 12px;
    justify-items: center;
    background: var(--surface);
    border-radius: var(--radius-card);
    padding: 12px;
  }

  .sk-piles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    width: min(100%, 15rem);
    padding-top: 6px; /* Platz für die Stapel-Zahl */
  }

  .sk-pile {
    display: grid;
    gap: 6px;
    justify-items: center;
    min-width: 0;
  }

  .sk-pile-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted);
  }

  .sk-pile--drawn.is-active .sk-pile-label {
    color: var(--accent-text);
    font-weight: 600;
  }

  /* Segment-Umschalter (gleich wie die Brett-Tabs in Schiffe versenken). */
  .g-segment {
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: var(--radius-control);
    background: var(--surface-2);
  }

  .sk-mode {
    width: min(100%, 20rem);
  }

  .g-segment-btn {
    min-height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--muted);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
  }

  .g-segment-btn.is-on {
    background: var(--raised);
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .g-segment-btn:active {
    transform: scale(0.98);
  }

  .g-segment-btn:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: 2px;
  }

  /* ---------- 3. Eigener Bereich ---------- */
  .sk-mine {
    min-width: 0;
  }

  .sk-mine-inner {
    margin: 0 auto;
    /* Drei Kartenreihen passen unter Kopfzeile, Status und Tisch auf ein Handy. */
    width: min(100%, 26rem);
    width: min(100%, 26rem, calc((100dvh - 32rem) * 0.95 + 2rem));
    min-width: min(100%, 15rem);
  }

  .g-me {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    margin-bottom: 8px;
  }

  .g-me-name {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .g-me-stat {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    flex-shrink: 0;
    font-size: 0.875rem;
  }

  .g-me-value {
    font-size: 1.375rem;
    font-weight: 600;
    line-height: 1;
    color: var(--text);
  }

  .sk-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .sk-grid--mine {
    gap: clamp(6px, 2.2vw, 12px);
    padding: 6px 4px 4px; /* Platz für Anheben + Ziel-Rahmen */
  }

  /* ---------- 4. Mitspieler ---------- */
  .g-opponents {
    min-width: 0;
  }

  .g-opp-track {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 2px 0 4px;
    list-style: none;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .g-opp-track::-webkit-scrollbar {
    display: none;
  }

  .g-opp {
    flex: 0 0 auto;
    scroll-snap-align: start;
    min-width: 0;
    background: var(--surface);
    border-radius: var(--radius-inner);
    padding: 10px;
    transition: box-shadow 200ms ease;
  }

  .g-opp.is-active {
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .sk-opp {
    width: 10.5rem;
  }

  .g-opp-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .g-opp-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .g-opp-stat {
    flex-shrink: 0;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .sk-grid--opp {
    gap: 4px;
  }

  /* ---------- Größere Bildschirme ---------- */
  @media (min-width: 640px) {
    .skyjo,
    .sk-layout { gap: 16px; }
    .g-status-text { font-size: 1.0625rem; }
    .sk-table { padding: 20px; }
    .sk-piles { width: 18rem; }
    .sk-opp { width: 12rem; }
  }

  @media (min-width: 900px) {
    .sk-layout {
      grid-template-columns: 16rem minmax(0, 30rem);
      justify-content: center;
      align-items: start;
      column-gap: 40px;
    }

    .sk-table {
      position: sticky;
      top: 16px;
    }

    .sk-piles {
      width: 100%;
      gap: 10px;
    }

    .sk-mode {
      width: 100%;
    }

    .sk-mine-inner {
      width: min(100%, 30rem);
      width: min(100%, 30rem, calc((100dvh - 15rem) * 0.68));
    }

    .g-opp-track {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
      overflow: visible;
      scroll-snap-type: none;
    }

    .sk-opp {
      width: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .g-opp,
    .g-segment-btn { transition: none; }
  }
</style>
