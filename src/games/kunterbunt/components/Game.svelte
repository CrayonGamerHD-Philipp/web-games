<script>
  import { tick } from 'svelte';
  import BuntCard from './BuntCard.svelte';
  import BuntMark from './BuntMark.svelte';
  import { BUNT_COLORS, BUNT_COLOR_NAMES, BUNT_VALUES, buntCardName, isBuntCardPlayable, isBuntWild } from '../rules.js';
  import { initials, playerHexById } from '$lib/player-colors.js';

  /** @typedef {import('../types').BuntSession} BuntSession */
  /** @typedef {import('../types').BuntState} BuntState */
  /** @typedef {import('../types').BuntCard} BuntCardType */
  /** @typedef {import('../types').BuntPlayer} BuntPlayer */
  /** @typedef {import('../types').BuntColor} BuntColor */
  /** @typedef {import('../types').BuntEvent} BuntEvent */
  /** @typedef {import('../types').BuntMove} BuntMove */

  /** @type {BuntSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: BuntMove) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** Party players (`{ id, name, color }`) for avatar colours. */
  /** @type {{ id: string, name?: string, color?: string }[]} */
  export let players = [];

  // Kept for the shared game-component API; the table reacts to `game` directly.
  $: void renderNonce;

  /** Hand order: alternating warm / cool so neighbouring colours stay distinguishable. */
  /** @type {(BuntColor | 'wild')[]} */
  const colorOrder = ['kirsche', 'wiese', 'sonne', 'meer', 'wild'];

  const soundSources = {
    draw: '/sounds/take_card1.mp3',
    play: '/sounds/select1.mp3',
    bunt: '/sounds/ping.mp3'
  };
  /** @type {Map<string, HTMLAudioElement>} */
  const audioCache = new Map();

  let buntArmed = false;
  /** @type {string | null} */
  let pickerCardId = null;
  /** @type {HTMLElement | null} */
  let pickerEl = null;
  /** @type {HTMLElement | null} */
  let pickerReturnFocus = null;
  let lastSeq = -1;

  $: state = game?.state ?? null;
  $: isRunning = game?.status === 'running';
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: hand = sortHand(me?.hand ?? []);
  $: isMyTurn = Boolean(isRunning && me && state?.currentPlayerId === currentPlayerId);
  $: discardPile = state?.discardPile ?? [];
  $: topCard = discardPile.length ? discardPile[discardPile.length - 1] : null;
  $: underCards = discardPile.slice(-3, -1);
  $: pendingDraw = state?.pendingDraw ?? 0;
  $: pendingIsFour = pendingDraw > 0 && topCard?.value === 'wild4';
  $: wishColor = state?.wishColor ?? null;
  $: hasDrawn = Boolean(state?.hasDrawn);
  $: drawnCardId = state?.drawnCardId ?? null;
  $: deckCount = state?.deckCount ?? 0;
  $: direction = state?.direction ?? 1;
  $: playableIds = computePlayable(hand, state, isMyTurn, hasDrawn, drawnCardId);
  $: canAct = isMyTurn && !isLoading;
  $: canDraw = canAct && !hasDrawn;
  $: canPass = canAct && hasDrawn;
  $: drawLabel = pendingDraw > 0 ? `+${pendingDraw} ziehen` : 'Ziehen';
  $: needsBunt = isMyTurn && hand.length === 2 && playableIds.size > 0;
  $: opponents = orderOpponents(game, currentPlayerId);
  $: turnPlayer = game?.players.find((player) => player.id === state?.currentPlayerId) ?? null;
  $: nextPlayerId = isRunning && state?.currentPlayerId ? playerAfter(state, state.currentPlayerId) : null;
  $: nextPlayer = game?.players.find((player) => player.id === nextPlayerId) ?? null;
  $: winner = game?.players.find((player) => player.id === state?.winnerId) ?? null;
  $: statusText = getStatusText(game, isMyTurn, Boolean(me), turnPlayer, winner, pendingDraw, pendingIsFour, hasDrawn, playableIds.size, needsBunt, buntArmed);
  $: eventText = state?.lastEvent?.text ?? '';
  $: pickerCard = pickerCardId ? hand.find((card) => card.id === pickerCardId) ?? null : null;
  $: handleEvent(state?.lastEvent ?? null);
  $: if (pickerCardId && (!canAct || !playableIds.has(pickerCardId))) closePicker();

  /** @param {BuntCardType[]} cards */
  function sortHand(cards) {
    return [...cards].sort(
      (a, b) =>
        colorOrder.indexOf(a.color ?? 'wild') - colorOrder.indexOf(b.color ?? 'wild') ||
        BUNT_VALUES.indexOf(a.value) - BUNT_VALUES.indexOf(b.value)
    );
  }

  /**
   * @param {BuntCardType[]} cards
   * @param {BuntState | null} currentState
   * @param {boolean} myTurn
   * @param {boolean} drawn
   * @param {string | null} drawnId
   */
  function computePlayable(cards, currentState, myTurn, drawn, drawnId) {
    /** @type {Set<string>} */
    const ids = new Set();
    if (!currentState || !myTurn) return ids;
    for (const card of cards) {
      if (drawn && card.id !== drawnId) continue;
      if (isBuntCardPlayable(card, currentState)) ids.add(card.id);
    }
    return ids;
  }

  /**
   * @param {BuntState} currentState
   * @param {string} playerId
   */
  function playerAfter(currentState, playerId) {
    const order = currentState.turnOrder ?? [];
    const index = order.indexOf(playerId);
    if (index === -1 || !order.length) return null;
    const length = order.length;
    return order[(((index + (currentState.direction ?? 1)) % length) + length) % length];
  }

  /**
   * Opponents in turn order, starting with the player after me.
   * @param {BuntSession | null} session
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
      .map((player) => /** @type {BuntPlayer} */ (player));
  }

  /**
   * @param {BuntSession | null} session
   * @param {boolean} myTurn
   * @param {boolean} isPlayer
   * @param {BuntPlayer | null} turn
   * @param {BuntPlayer | null} won
   * @param {number} pending
   * @param {boolean} pendingFour
   * @param {boolean} drawn
   * @param {number} playableCount
   * @param {boolean} buntNeeded
   * @param {boolean} armed
   */
  function getStatusText(session, myTurn, isPlayer, turn, won, pending, pendingFour, drawn, playableCount, buntNeeded, armed) {
    if (!session) return '';
    if (session.status === 'finished') {
      if (won && won.id === currentPlayerId) return 'Kunterbunt! Du hast gewonnen.';
      return won ? `Kunterbunt! ${won.name} hat gewonnen.` : 'Die Runde ist beendet.';
    }
    if (!myTurn) {
      const prefix = isPlayer ? '' : 'Du schaust zu. ';
      return turn ? `${prefix}${turn.name} ist am Zug.` : `${prefix}Das Spiel läuft.`;
    }
    if (pending > 0) {
      if (playableCount === 0) return `Du musst ${pending} Karten ziehen.`;
      return pendingFour ? `Leg eine +4 drauf oder zieh ${pending} Karten.` : `Leg +2 oder +4 drauf oder zieh ${pending} Karten.`;
    }
    if (drawn) {
      return playableCount > 0 ? 'Die gezogene Karte passt: legen oder „Weiter“.' : 'Tippe „Weiter“.';
    }
    if (playableCount === 0) return 'Keine Karte passt. Zieh eine Karte.';
    if (buntNeeded && !armed) return 'Vorletzte Karte: erst „Bunt!“ rufen, dann legen.';
    return 'Leg eine passende Karte oder zieh.';
  }

  /** @param {BuntEvent | null} event */
  function handleEvent(event) {
    const seq = event?.seq ?? 0;
    if (seq === lastSeq) return;
    const isFirst = lastSeq === -1;
    lastSeq = seq;
    buntArmed = false;
    if (isFirst || !event) return;
    if (event.type === 'bunt') playSound('bunt');
    else if (event.type === 'draw' || event.type === 'draw-pending' || event.type === 'bunt-penalty') playSound('draw');
    else if (event.type !== 'pass' && event.type !== 'no-cards' && event.type !== 'start') playSound('play');
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

  /** @param {BuntCardType} card */
  function handleCard(card) {
    if (!canAct || !playableIds.has(card.id)) return;
    if (isBuntWild(card.value) && hand.length > 1) {
      void openPicker(card.id);
      return;
    }
    sendPlay(card.id);
  }

  /**
   * @param {string} cardId
   * @param {BuntColor} [wish]
   */
  function sendPlay(cardId, wish) {
    /** @type {BuntMove} */
    const move = { type: 'play', cardId, bunt: hand.length === 2 ? buntArmed : false };
    if (wish) move.wishColor = wish;
    onMove(move);
  }

  function draw() {
    if (!canDraw) return;
    onMove({ type: 'draw' });
  }

  function pass() {
    if (!canPass) return;
    onMove({ type: 'pass' });
  }

  function toggleBunt() {
    buntArmed = !buntArmed;
    if (buntArmed) playSound('bunt');
  }

  /** @param {string} cardId */
  async function openPicker(cardId) {
    pickerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pickerCardId = cardId;
    await tick();
    pickerEl?.querySelector('button')?.focus();
  }

  function closePicker() {
    if (!pickerCardId) return;
    pickerCardId = null;
    const target = pickerReturnFocus;
    pickerReturnFocus = null;
    if (target && target.isConnected) target.focus();
  }

  /** @param {BuntColor} color */
  function chooseColor(color) {
    const cardId = pickerCardId;
    pickerCardId = null;
    pickerReturnFocus = null;
    if (cardId) sendPlay(cardId, color);
  }

  /** @param {KeyboardEvent} event */
  function handlePickerKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker();
      return;
    }
    if (event.key !== 'Tab' || !pickerEl) return;
    const focusables = Array.from(pickerEl.querySelectorAll('button'));
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

  /**
   * Stable small tilt for the cards under the top of the discard pile.
   * @param {string} id
   * @param {number} index
   */
  function tilt(id, index) {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    const deg = ((Math.abs(hash) % 15) - 7) * 1.4;
    const shift = ((Math.abs(hash >> 4) % 7) - 3) * 1.5;
    return `transform: translate(${shift}%, ${index === 0 ? 3 : 1.5}%) rotate(${deg}deg);`;
  }

  /**
   * @param {BuntCardType} card
   * @param {boolean} playable
   */
  function handLabel(card, playable) {
    const name = buntCardName(card);
    if (!isMyTurn) return name;
    return `${name}${playable ? ', spielbar' : ', passt nicht'}`;
  }
</script>

{#if !game || !state}
  <div class="ui-alert" role="status">Kunterbunt wird über eine Party gestartet, damit alle Mitspieler verbunden sind.</div>
{:else}
  <div class="kb" class:is-finished={!isRunning}>
    <!-- 1. Status -->
    <header class="kb-status">
      <div class="kb-status-text" aria-live="polite" aria-atomic="true">
        <p class="kb-status-main">{statusText}</p>
        {#if eventText && eventText !== statusText}
          <p class="kb-status-event">{eventText}</p>
        {/if}
      </div>
      {#if isMyTurn}
        <span class="ui-chip ui-chip--accent kb-turn-chip">Du bist dran</span>
      {/if}
    </header>

    <!-- 4. Mitspieler (kompakt, mobil als wischbarer Streifen) -->
    {#if opponents.length}
      <section class="kb-opps touch-scroll-x" aria-label="Mitspieler">
        <ul class="kb-opps-list">
          {#each opponents as player (player.id)}
            {@const active = isRunning && state.currentPlayerId === player.id}
            {@const isNext = isRunning && !active && nextPlayerId === player.id}
            {@const count = player.handCount ?? player.hand.length}
            <li class="kb-opp" class:is-active={active} class:is-winner={state.winnerId === player.id}>
              <span class="ui-avatar kb-opp-avatar" style="--player: {playerHexById(players, player.id)}" aria-hidden="true">{initials(player.name)}</span>
              <span class="kb-opp-meta">
                <span class="kb-opp-line">
                  <span class="kb-opp-name">{player.name}</span>
                  {#if count === 1 && isRunning}<span class="kb-bunt-badge">Bunt!</span>{/if}
                </span>
                <span class="kb-opp-count ui-num">
                  {count} {count === 1 ? 'Karte' : 'Karten'}{#if active}<span class="kb-opp-state">{' · am Zug'}</span>{:else if isNext}<span class="kb-opp-state kb-opp-state--next">{' · als Nächstes'}</span>{/if}
                </span>
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- 2. Tisch -->
    <section class="ui-panel kb-table" aria-label="Spieltisch">
      <div class="kb-piles">
        <div class="kb-pile">
          <div class="kb-deck" class:has-stack={deckCount > 1} class:is-ready={canDraw}>
            {#if deckCount > 0 || (state.discardCount ?? discardPile.length) > 1}
              <BuntCard
                faceDown
                disabled={!canDraw}
                badge={deckCount}
                label={`Nachziehstapel, ${deckCount} ${deckCount === 1 ? 'Karte' : 'Karten'}${canDraw ? ` – ${drawLabel}` : ''}`}
                on:activate={draw}
              />
            {:else}
              <span class="kb-slot" aria-label="Nachziehstapel leer" role="img"></span>
            {/if}
          </div>
          <span class="kb-pile-label">Stapel</span>
        </div>

        <div class="kb-pile">
          <div class="kb-discard">
            {#each underCards as card, index (card.id)}
              <span class="kb-discard-under" style={tilt(card.id, index)}>
                <BuntCard {card} interactive={false} />
              </span>
            {/each}
            {#if topCard}
              {#key topCard.id}
                <span class="kb-discard-top" role="img" aria-label={`Ablage: ${buntCardName(topCard)}${topCard.wishColor ? `, gewünscht ${BUNT_COLOR_NAMES[topCard.wishColor]}` : ''}`}>
                  <BuntCard card={topCard} interactive={false} />
                </span>
              {/key}
            {/if}
          </div>
          <span class="kb-pile-label">Ablage</span>
        </div>

        <div class="kb-indicators">
          {#if pendingDraw > 0 && isRunning}
            <div class="kb-ind kb-ind--draw">
              <span class="kb-ind-big ui-num">+{pendingDraw}</span>
              <span class="kb-ind-text">
                <span class="kb-ind-kicker">Ziehstapel wächst</span>
                {pendingIsFour ? 'Ziehen oder +4 drauf' : 'Ziehen oder +2 / +4 drauf'}
              </span>
            </div>
          {/if}
          {#if wishColor && isRunning}
            <div class="kb-ind">
              <span class="kb-swatch kb-swatch--{wishColor}"><BuntMark shape={wishColor} className="kb-swatch-mark" /></span>
              <span class="kb-ind-text"><span class="kb-ind-kicker">Gewünscht</span>{BUNT_COLOR_NAMES[wishColor]}</span>
            </div>
          {/if}
          {#if isRunning}
            <div class="kb-ind">
              <svg class="kb-dir" class:is-reversed={direction === -1} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
                <path d="M19.8 3.8v3.6h-3.6" />
              </svg>
              <span class="kb-ind-text">
                <span class="kb-ind-kicker">{direction === 1 ? 'Reihenfolge vorwärts' : 'Reihenfolge rückwärts'}</span>
                {#if nextPlayer}Als Nächstes: {nextPlayer.id === currentPlayerId ? 'du' : nextPlayer.name}{/if}
              </span>
            </div>
          {/if}
        </div>
      </div>
    </section>

    <!-- 3. Eigene Hand -->
    {#if me}
      <section class="kb-mine" class:is-turn={isMyTurn} aria-label="Deine Hand">
        <div class="kb-actions">
          <p class="kb-mine-title">
            Deine Hand
            <span class="kb-mine-count ui-num">{hand.length}</span>
          </p>
          <div class="kb-buttons">
            {#if needsBunt}
              <button type="button" class="kb-bunt-btn" class:is-on={buntArmed} aria-pressed={buntArmed} disabled={!canAct} on:click={toggleBunt}>
                {#if buntArmed}
                  <svg viewBox="0 0 20 20" aria-hidden="true" class="kb-check"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  Bunt! gerufen
                {:else}
                  Bunt! rufen
                {/if}
              </button>
            {/if}
            {#if hasDrawn && isMyTurn}
              <button type="button" class="ui-btn" class:ui-btn--primary={playableIds.size === 0} disabled={!canPass} on:click={pass}>Weiter</button>
            {:else}
              <button
                type="button"
                class="ui-btn"
                class:ui-btn--primary={isMyTurn && playableIds.size === 0}
                class:ui-btn--danger={isMyTurn && pendingDraw > 0 && playableIds.size > 0}
                disabled={!canDraw}
                on:click={draw}
              >
                {drawLabel}
              </button>
            {/if}
          </div>
        </div>

        {#if needsBunt && !buntArmed}
          <p class="kb-bunt-hint">Du legst gleich deine vorletzte Karte – ruf vorher „Bunt!“, sonst ziehst du 2 Strafkarten.</p>
        {/if}

        <div class="kb-hand-scroll touch-scroll-x">
          <ul class="kb-hand" style={`--n: ${Math.max(hand.length, 1)}`} aria-label={`${hand.length} Karten auf der Hand`}>
            {#each hand as card (card.id)}
              {@const playable = playableIds.has(card.id)}
              <li class="kb-hand-card">
                <BuntCard
                  {card}
                  {playable}
                  selected={pickerCardId === card.id}
                  dimmed={isMyTurn && !playable}
                  disabled={!canAct || !playable}
                  badge={drawnCardId === card.id && isMyTurn ? 'Neu' : null}
                  label={handLabel(card, playable)}
                  on:activate={() => handleCard(card)}
                />
              </li>
            {/each}
          </ul>
        </div>
      </section>
    {/if}
  </div>

  {#if pickerCard}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="ui-dialog-backdrop kb-backdrop" role="presentation" on:click|self={closePicker}>
      <div
        bind:this={pickerEl}
        class="ui-dialog kb-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kb-sheet-title"
        aria-describedby="kb-sheet-text"
        tabindex="-1"
        on:keydown={handlePickerKeydown}
      >
        <div class="kb-sheet-head">
          <span class="kb-sheet-card" aria-hidden="true"><BuntCard card={pickerCard} interactive={false} /></span>
          <div>
            <h2 id="kb-sheet-title" class="kb-sheet-title">Welche Farbe wünschst du dir?</h2>
            <p id="kb-sheet-text" class="kb-sheet-text">Dein {buntCardName(pickerCard)} wird gelegt, sobald du eine Farbe wählst.</p>
          </div>
        </div>
        <div class="kb-sheet-grid">
          {#each BUNT_COLORS as color (color)}
            <button type="button" class="kb-color-btn kb-color-btn--{color}" on:click={() => chooseColor(color)}>
              <BuntMark shape={color} className="kb-color-mark" />
              <span class="kb-color-name">{BUNT_COLOR_NAMES[color]}</span>
            </button>
          {/each}
        </div>
        {#if hand.length === 2}
          <button type="button" class="kb-bunt-btn kb-bunt-btn--wide" class:is-on={buntArmed} aria-pressed={buntArmed} on:click={toggleBunt}>
            {buntArmed ? 'Bunt! gerufen' : 'Bunt! rufen (vorletzte Karte)'}
          </button>
        {/if}
        <button type="button" class="ui-btn ui-btn--ghost ui-btn--block kb-sheet-cancel" on:click={closePicker}>Abbrechen</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .kb,
  .kb-sheet {
    --kb-kirsche: #b8364d;
    --kb-sonne: #e3a832;
    --kb-wiese: #357a50;
    --kb-meer: #2e66aa;
  }

  .kb {
    --kb-bunt: #a35a00;
    --kb-bunt-soft: color-mix(in srgb, #e3a832 20%, var(--ground));

    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin-top: 12px;
    color: var(--text);
    min-width: 0;
  }

  :global(html[data-theme='dark']) .kb {
    --kb-bunt: #f2c66b;
    --kb-bunt-soft: color-mix(in srgb, #e3a832 16%, var(--ground));
  }

  /* ---------- 1. Status ---------- */
  .kb-status {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }

  .kb-status-text {
    min-width: 0;
  }

  .kb-status-main {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.35;
    font-weight: 600;
    text-wrap: balance;
  }

  .kb-status-event {
    margin: 2px 0 0;
    font-size: 0.875rem;
    line-height: 1.4;
    color: var(--muted);
    text-wrap: pretty;
  }

  .kb-turn-chip {
    flex-shrink: 0;
  }

  /* ---------- 4. Opponents ---------- */
  .kb-opps {
    overflow-x: auto;
    padding: 2px 0;
    scrollbar-width: none;
  }

  .kb-opps::-webkit-scrollbar {
    display: none;
  }

  .kb-opps-list {
    display: flex;
    gap: 8px;
    width: max-content;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .kb-opp {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    max-width: 12rem;
    padding: 6px 12px 6px 8px;
    border-radius: var(--radius-inner);
    background: var(--surface);
    scroll-snap-align: start;
    transition: box-shadow 150ms ease, background-color 150ms ease;
  }

  .kb-opp.is-active {
    background: var(--accent-soft, var(--surface-2));
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .kb-opp-meta {
    display: grid;
    min-width: 0;
  }

  .kb-opp-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .kb-opp-count {
    font-size: 0.8125rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .kb-opp-state {
    color: var(--text);
  }

  .kb-opp-state--next {
    color: var(--muted);
  }

  .kb-opp-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .kb-bunt-badge {
    flex-shrink: 0;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--kb-sonne);
    color: #2e2003;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.35;
  }

  @media (min-width: 1024px) {
    .kb-opps {
      overflow: visible;
    }

    .kb-opps-list {
      flex-wrap: wrap;
      width: auto;
    }
  }

  /* ---------- 2. Table ---------- */
  .kb-table {
    padding: 16px 12px;
  }

  .kb-piles {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: center;
    gap: 16px 24px;
  }

  .kb-pile {
    display: grid;
    justify-items: center;
    gap: 8px;
    width: 5.5rem;
  }

  .kb-deck,
  .kb-discard {
    position: relative;
    width: 100%;
  }

  .kb-deck.has-stack::before,
  .kb-deck.has-stack::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: clamp(5px, 10%, 14px);
    background: #20232b;
    box-shadow: 0 0 0 1px rgb(15 23 42 / 0.2);
  }

  .kb-deck.has-stack::before {
    transform: translate(4px, 4px);
    opacity: 0.5;
  }

  .kb-deck.has-stack::after {
    transform: translate(2px, 2px);
    opacity: 0.8;
  }

  .kb-deck :global(.bc) {
    z-index: 1;
  }

  .kb-deck.is-ready {
    border-radius: clamp(5px, 10%, 14px);
    box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px var(--accent-main);
  }

  .kb-slot {
    display: block;
    aspect-ratio: 5 / 7;
    border-radius: 12px;
    border: 2px dashed var(--control);
  }

  .kb-discard {
    aspect-ratio: 5 / 7;
  }

  .kb-discard-under,
  .kb-discard-top {
    position: absolute;
    inset: 0;
    display: block;
  }

  .kb-discard-top {
    animation: kb-land 320ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .kb-pile-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--muted);
  }

  .kb-indicators {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    flex-basis: 100%;
  }

  .kb-indicators:empty {
    display: none;
  }

  .kb-ind {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 6px 14px 6px 10px;
    border-radius: var(--radius-inner);
    background: var(--raised);
  }

  .kb-ind--draw {
    background: color-mix(in srgb, var(--negative) 12%, var(--raised));
    color: var(--negative);
  }

  .kb-ind-big {
    font-size: 1.625rem;
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .kb-ind-text {
    display: grid;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .kb-ind-kicker {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted);
  }

  .kb-swatch {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }

  .kb-swatch :global(.kb-swatch-mark) {
    width: 14px;
    height: 14px;
  }

  .kb-swatch--kirsche { background: var(--kb-kirsche); color: #fff8f4; }
  .kb-swatch--sonne { background: var(--kb-sonne); color: #2e2003; }
  .kb-swatch--wiese { background: var(--kb-wiese); color: #f4fbf3; }
  .kb-swatch--meer { background: var(--kb-meer); color: #f3f7ff; }

  .kb-dir {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    color: var(--muted);
    transition: transform 300ms ease;
  }

  .kb-dir.is-reversed {
    transform: scaleX(-1);
  }

  /* ---------- 3. My hand ---------- */
  .kb-mine {
    min-width: 0;
    padding-top: 4px;
  }

  .kb-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .kb-mine-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .kb-mine-count {
    min-width: 1.5rem;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.8125rem;
    text-align: center;
  }

  .kb-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .kb-bunt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--control-height, 44px);
    padding: 0 20px;
    border: 0;
    border-radius: 999px;
    background: var(--kb-sonne);
    color: #2e2003;
    font-size: 0.9375rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 150ms ease, transform 120ms ease;
  }

  .kb-bunt-btn.is-on {
    background: var(--positive);
    color: #fff;
  }

  .kb-bunt-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .kb-bunt-btn:not(:disabled):active {
    transform: scale(0.97);
  }

  .kb-bunt-btn:focus-visible,
  .kb-color-btn:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: 2px;
  }

  .kb-bunt-btn--wide {
    width: 100%;
    margin-top: 12px;
  }

  .kb-check {
    width: 18px;
    height: 18px;
  }

  .kb-bunt-hint {
    margin: 8px 0 0;
    padding: 8px 12px;
    border-radius: var(--radius-inner);
    background: var(--kb-bunt-soft);
    color: var(--kb-bunt);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.4;
  }

  /* Hand: overlapping cards that spread out as space allows; scrolls (with snap) when it cannot fit. */
  .kb-hand-scroll {
    container-type: inline-size;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-inline: contain;
    scroll-snap-type: x proximity;
    scroll-padding-inline: 4px;
    scrollbar-width: thin;
    margin-inline: -4px;
    padding: 28px 4px 12px;
  }

  .kb-hand {
    --w: 4.75rem;
    display: flex;
    width: max-content;
    margin: 0 auto;
    padding: 0;
    list-style: none;
  }

  .kb-hand-card {
    position: relative;
    flex: 0 0 var(--w);
    width: var(--w);
    scroll-snap-align: start;
    --step: max(2rem, min(calc(var(--w) * 0.82), calc((100cqw - var(--w)) / max(1, var(--n) - 1))));
  }

  .kb-hand-card + .kb-hand-card {
    margin-inline-start: calc(var(--step) - var(--w));
  }

  .kb-hand-card:focus-within {
    z-index: 2;
  }

  @media (min-width: 640px) {
    .kb {
      gap: 16px;
    }

    .kb-pile {
      width: 6.5rem;
    }

    .kb-table {
      padding: 20px;
    }

    .kb-hand {
      --w: 5.75rem;
    }

    .kb-hand-card {
      --step: max(2.4rem, min(calc(var(--w) * 0.82), calc((100cqw - var(--w)) / max(1, var(--n) - 1))));
    }

    .kb-indicators {
      flex-basis: auto;
      flex-direction: column;
      align-self: center;
      align-items: stretch;
    }
  }

  @media (min-width: 1024px) {
    .kb-pile {
      width: 7.5rem;
    }

    .kb-hand {
      --w: 6.75rem;
    }

    .kb-table {
      padding: 28px 24px;
    }
  }

  /* ---------- Colour picker ---------- */
  .kb-backdrop {
    animation: kb-fade 160ms ease;
  }

  .kb-sheet {
    outline: none;
    animation: kb-sheet-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
    color: var(--text);
  }

  .kb-sheet-head {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .kb-sheet-card {
    flex-shrink: 0;
    width: 3rem;
  }

  .kb-sheet-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .kb-sheet-text {
    margin: 4px 0 0;
    font-size: 0.875rem;
    color: var(--muted);
  }

  .kb-sheet-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 18px;
  }

  .kb-color-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 88px;
    border: 0;
    border-radius: var(--radius-inner);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 120ms ease, filter 150ms ease;
  }

  .kb-color-btn :global(.kb-color-mark) {
    width: 22px;
    height: 22px;
  }

  .kb-color-btn--kirsche { background: var(--kb-kirsche); color: #fff8f4; }
  .kb-color-btn--sonne { background: var(--kb-sonne); color: #2e2003; }
  .kb-color-btn--wiese { background: var(--kb-wiese); color: #f4fbf3; }
  .kb-color-btn--meer { background: var(--kb-meer); color: #f3f7ff; }

  .kb-color-btn:active {
    transform: scale(0.97);
  }

  .kb-sheet-cancel {
    margin-top: 10px;
  }

  @media (hover: hover) and (pointer: fine) {
    .kb-color-btn:hover {
      filter: brightness(1.07);
    }

    .kb-bunt-btn:not(:disabled):not(.is-on):hover {
      background: #d69a26;
    }
  }

  /* ---------- Motion ---------- */
  @keyframes kb-land {
    from { transform: translateY(-14%) scale(1.06); opacity: 0; }
    to { transform: none; opacity: 1; }
  }

  @keyframes kb-fade {
    from { opacity: 0; }
  }

  @keyframes kb-sheet-in {
    from { transform: translateY(16px); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .kb-discard-top,
    .kb-sheet,
    .kb-backdrop {
      animation: none;
    }

    .kb-dir {
      transition: none;
    }
  }
</style>
