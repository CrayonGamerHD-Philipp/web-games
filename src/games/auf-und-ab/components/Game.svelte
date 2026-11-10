<script>
  import { tick } from 'svelte';
  import { Eye, X } from '@lucide/svelte';
  import StufenCard from './StufenCard.svelte';
  import { DISCARD_PILES, canPlay, cardName, isJoker, nextValue } from '../rules.js';
  import { playerHexById } from '$lib/player-colors.js';
  import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';

  /** @typedef {import('../types').AufSession} AufSession */
  /** @typedef {import('../types').AufPlayer} AufPlayer */
  /** @typedef {import('../types').AufCard} AufCard */
  /** @typedef {import('../types').AufBuildPile} AufBuildPile */
  /** @typedef {import('../types').AufMove} AufMove */
  /** @typedef {import('../types').AufEvent} AufEvent */
  /** @typedef {{ source: 'hand', cardId: string } | { source: 'stock' } | { source: 'discard', discardIndex: number }} Selection */

  /** @type {AufSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: AufMove) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** @type {{ id: string, name?: string, color?: string, avatar?: import('$lib/party-features.js').Avatar | null }[]} */
  export let players = [];

  $: void renderNonce;

  const soundSources = { play: '/sounds/select1.mp3', draw: '/sounds/take_card1.mp3', done: '/sounds/ping.mp3' };
  /** @type {Map<string, HTMLAudioElement>} */
  const audioCache = new Map();

  /** @type {Selection | null} */
  let selection = null;
  let lastSeq = -1;

  /** Geöffneter Ablagestapel zum Nachschauen. */
  /** @type {{ playerId: string, index: number } | null} */
  let viewer = null;
  /** @type {HTMLElement | null} */
  let viewerEl = null;
  /** @type {HTMLElement | null} */
  let viewerReturnFocus = null;

  $: state = game?.state ?? null;
  $: isRunning = game?.status === 'running';
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: isMyTurn = Boolean(isRunning && me && state?.currentPlayerId === currentPlayerId);
  $: canAct = isMyTurn && !isLoading;
  $: hand = sortHand(me?.hand ?? []);
  $: stockTop = me?.stock?.[0] ?? null;
  $: piles = state?.buildPiles ?? [];
  $: selectedCard = canAct ? resolveSelection(selection, me) : null;
  /** Nur gültige Auswahl zählt (Karte noch da, ich bin am Zug). */
  $: active = selectedCard ? selection : null;
  $: playablePiles = new Set(selectedCard ? piles.filter((pile) => canPlay(selectedCard, pile)).map((pile) => pile.id) : []);
  $: canDiscardSelection = active?.source === 'hand';
  $: opponents = orderOpponents(game, currentPlayerId);
  $: turnPlayer = game?.players.find((player) => player.id === state?.currentPlayerId) ?? null;
  $: winners = (state?.winnerIds ?? []).map((id) => game?.players.find((player) => player.id === id)?.name).filter(Boolean);
  $: anyPlayable = canAct && me ? hasAnyPlay(me, piles) : false;
  $: statusText = getStatusText(game, isMyTurn, Boolean(me), turnPlayer, active, selectedCard, anyPlayable);
  $: eventText = state?.lastEvent?.text ?? '';
  $: handleEvent(state?.lastEvent ?? null);
  $: viewerPlayer = viewer ? game?.players.find((player) => player.id === viewer?.playerId) ?? null : null;
  $: viewerCards = viewer && viewerPlayer ? viewerPlayer.discards[viewer.index] ?? [] : [];
  $: viewerTitle = viewer && viewerPlayer
    ? `Ablage ${viewer.index + 1} ${viewerPlayer.id === currentPlayerId ? '(deine)' : `von ${viewerPlayer.name}`}`
    : '';

  /** @param {AufCard[]} cards */
  function sortHand(cards) {
    return [...cards].sort((a, b) => (a.value ?? 99) - (b.value ?? 99));
  }

  /**
   * @param {Selection | null} current
   * @param {AufPlayer | null} player
   * @returns {AufCard | null}
   */
  function resolveSelection(current, player) {
    if (!current || !player) return null;
    if (current.source === 'hand') return player.hand.find((card) => card.id === current.cardId) ?? null;
    if (current.source === 'stock') return player.stock[0] ?? null;
    const pile = player.discards[current.discardIndex] ?? [];
    return pile[pile.length - 1] ?? null;
  }

  /**
   * @param {AufPlayer} player
   * @param {AufBuildPile[]} buildPiles
   */
  function hasAnyPlay(player, buildPiles) {
    const sources = [...player.hand, player.stock[0], ...player.discards.map((pile) => pile[pile.length - 1])].filter(Boolean);
    return sources.some((card) => buildPiles.some((pile) => canPlay(/** @type {AufCard} */ (card), pile)));
  }

  /**
   * @param {AufSession | null} session
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
      .map((player) => /** @type {AufPlayer} */ (player));
  }

  /**
   * @param {AufSession | null} session
   * @param {boolean} myTurn
   * @param {boolean} isPlayer
   * @param {AufPlayer | null} turn
   * @param {Selection | null} current
   * @param {AufCard | null} card
   * @param {boolean} playable
   */
  function getStatusText(session, myTurn, isPlayer, turn, current, card, playable) {
    if (!session) return '';
    if (session.status === 'finished') {
      if (session.state.winnerIds.includes(currentPlayerId)) return 'Geschafft! Du hast gewonnen.';
      return winners.length ? `${winners.join(', ')} ${winners.length === 1 ? 'hat' : 'haben'} gewonnen.` : 'Das Spiel ist beendet.';
    }
    if (!myTurn) {
      const prefix = isPlayer ? '' : 'Du schaust zu. ';
      return turn ? `${prefix}${turn.name} ist am Zug.` : `${prefix}Das Spiel läuft.`;
    }
    if (card && current) {
      const where = playablePiles.size ? 'Tippe einen leuchtenden Stapel in der Mitte' : 'Diese Karte passt gerade nirgends in der Mitte';
      return current.source === 'hand' ? `${where} – oder einen deiner Ablagestapel, um den Zug zu beenden.` : `${where}.`;
    }
    if (me && me.hand.length === 0) return 'Keine Handkarten mehr. Beende deinen Zug.';
    return playable ? 'Wähle eine Karte: Vorrat, Ablage oder Hand.' : 'Nichts passt. Lege eine Handkarte auf einen Ablagestapel.';
  }

  /** @param {AufEvent | null} event */
  function handleEvent(event) {
    const seq = event?.seq ?? 0;
    if (seq === lastSeq) return;
    const isFirst = lastSeq === -1;
    lastSeq = seq;
    if (isFirst || !event) return;
    if (event.type === 'complete' || event.type === 'win') playSound('done');
    else if (event.type === 'play' || event.type === 'refill') playSound('play');
    else if (event.type === 'discard' || event.type === 'end-turn') playSound('draw');
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

  /** @param {Selection} next */
  function select(next) {
    if (!canAct) return;
    const same = selection && selection.source === next.source &&
      (next.source === 'hand' ? /** @type {any} */ (selection).cardId === next.cardId : next.source === 'discard' ? /** @type {any} */ (selection).discardIndex === next.discardIndex : true);
    selection = same ? null : next;
  }

  /** @param {AufBuildPile} pile */
  function playOn(pile) {
    if (!canAct || !active || !playablePiles.has(pile.id)) return;
    /** @type {AufMove} */
    const move = { type: 'play', source: active.source, pileId: pile.id };
    if (active.source === 'hand') move.cardId = active.cardId;
    if (active.source === 'discard') move.discardIndex = active.discardIndex;
    selection = null;
    onMove(move);
  }

  /** @param {number} index */
  function handleDiscard(index) {
    if (!canAct || !me) return;
    if (active?.source === 'hand') {
      const cardId = active.cardId;
      selection = null;
      onMove({ type: 'discard', cardId, discardIndex: index });
      return;
    }
    if (me.discards[index]?.length) select({ source: 'discard', discardIndex: index });
  }

  function endTurn() {
    if (!canAct || !me || me.hand.length) return;
    onMove({ type: 'end-turn' });
  }

  /** @param {AufBuildPile} pile */
  function pileTop(pile) {
    return pile.cards[pile.cards.length - 1] ?? null;
  }

  /** @param {AufBuildPile} pile */
  function pileLabel(pile) {
    const top = pileTop(pile);
    const dir = pile.dir === 'up' ? 'Aufwärts' : 'Abwärts';
    return `${dir}-Stapel, ${top ? `oben ${top.value}` : 'leer'}, als Nächstes ${nextValue(pile)}${playablePiles.has(pile.id) ? ' – hier ablegen' : ''}`;
  }

  /** @param {string} id */
  function avatarOf(id) {
    return players.find((player) => player.id === id)?.avatar ?? null;
  }

  /**
   * @param {string} playerId
   * @param {number} index
   */
  async function openViewer(playerId, index) {
    viewerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    viewer = { playerId, index };
    await tick();
    viewerEl?.querySelector('button')?.focus();
  }

  function closeViewer() {
    if (!viewer) return;
    viewer = null;
    const target = viewerReturnFocus;
    viewerReturnFocus = null;
    if (target && target.isConnected) target.focus();
  }

  /** @param {KeyboardEvent} event */
  function handleViewerKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewer();
      return;
    }
    if (event.key !== 'Tab' || !viewerEl) return;
    const focusables = Array.from(viewerEl.querySelectorAll('button'));
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

  /** @param {AufCard[]} pile */
  function topOf(pile) {
    return pile[pile.length - 1] ?? null;
  }
</script>

{#if !game || !state}
  <div class="ui-alert" role="status">Auf & Ab wird über eine Party gestartet, damit alle Mitspieler verbunden sind.</div>
{:else}
  <div class="aa">
    <header class="aa-status">
      <div class="aa-status-text" aria-live="polite" aria-atomic="true">
        <p class="aa-status-main">{statusText}</p>
        {#if eventText && eventText !== statusText}<p class="aa-status-event">{eventText}</p>{/if}
      </div>
      {#if isMyTurn}<span class="ui-chip ui-chip--accent aa-chip">Du bist dran</span>{/if}
    </header>

    {#if opponents.length}
      <section class="aa-opps touch-scroll-x" aria-label="Mitspieler">
        <ul class="aa-opps-list">
          {#each opponents as player (player.id)}
            {@const active = isRunning && state.currentPlayerId === player.id}
            <li class="aa-opp" class:is-active={active} class:is-winner={state.winnerIds.includes(player.id)}>
              <div class="aa-opp-head">
                <PlayerAvatar avatar={avatarOf(player.id)} name={player.name} color={playerHexById(players, player.id)} size={32} {active} />
                <span class="aa-opp-meta">
                  <span class="aa-opp-name">{player.name}</span>
                  <span class="aa-opp-sub ui-num">Vorrat {player.stockCount} · Hand {player.handCount}{#if active}{' · am Zug'}{/if}</span>
                </span>
              </div>
              <div class="aa-opp-cards">
                <span class="aa-mini aa-mini--stock" title="Oberste Vorratskarte">
                  {#if player.stock[0]}<StufenCard card={player.stock[0]} />{:else}<span class="aa-empty"></span>{/if}
                </span>
                {#each player.discards as pile, index (index)}
                  {@const top = topOf(pile)}
                  {#if top}
                    <button
                      type="button"
                      class="aa-mini aa-mini-btn"
                      title={`Ablage ${index + 1}: ${pile.length} ${pile.length === 1 ? 'Karte' : 'Karten'} – ansehen`}
                      aria-label={`Ablage ${index + 1} von ${player.name}: oben ${cardName(top)}, ${pile.length} ${pile.length === 1 ? 'Karte' : 'Karten'}. Ansehen`}
                      on:click={() => openViewer(player.id, index)}
                    >
                      <StufenCard card={top} badge={pile.length > 1 ? pile.length : null} />
                    </button>
                  {:else}
                    <span class="aa-mini" title={`Ablage ${index + 1}: leer`}><span class="aa-empty"></span></span>
                  {/if}
                {/each}
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="ui-panel aa-table" aria-label="Baustapel in der Mitte">
      <div class="aa-builds">
        {#each piles as pile (pile.id)}
          {@const top = pileTop(pile)}
          {@const target = playablePiles.has(pile.id)}
          <div class="aa-build">
            <span class="aa-build-label" class:is-up={pile.dir === 'up'} class:is-down={pile.dir === 'down'}>
              {pile.dir === 'up' ? '↑ Auf' : '↓ Ab'}
            </span>
            <button
              type="button"
              class="aa-build-slot"
              class:is-target={target}
              disabled={!target || !canAct}
              aria-label={pileLabel(pile)}
              on:click={() => playOn(pile)}
            >
              {#if top}
                <StufenCard card={top.card} countsAs={top.value} />
              {:else}
                <span class="aa-build-empty">
                  <span class="aa-build-arrow">{pile.dir === 'up' ? '↑' : '↓'}</span>
                  <span class="ui-num">{pile.dir === 'up' ? '1' : '12'}</span>
                </span>
              {/if}
              {#if target && selectedCard && isJoker(selectedCard)}
                <span class="aa-joker-hint">Joker = {nextValue(pile)}</span>
              {/if}
            </button>
            <span class="aa-build-next ui-num">
              {pile.cards.length ? `nächste: ${nextValue(pile)}` : `Start: ${nextValue(pile)}`}
            </span>
          </div>
        {/each}
        <div class="aa-build aa-deck">
          <span class="aa-build-label">Stapel</span>
          <span class="aa-build-slot aa-deck-slot">
            {#if state.deckCount > 0}<StufenCard back badge={state.deckCount} />{:else}<span class="aa-build-empty">leer</span>{/if}
          </span>
          <span class="aa-build-next">{state.completedPiles} fertig</span>
        </div>
      </div>
    </section>

    {#if me}
      <section class="ui-panel aa-mine" aria-label="Deine Karten">
        <div class="aa-mine-row">
          <div class="aa-own">
            <span class="aa-own-label">Vorrat <strong class="ui-num">{me.stockCount}</strong></span>
            <button
              type="button"
              class="aa-card-btn aa-stock"
              class:is-selected={active?.source === 'stock'}
              disabled={!canAct || !stockTop}
              aria-pressed={active?.source === 'stock'}
              aria-label={stockTop ? `Vorrat: ${cardName(stockTop)}, noch ${me.stockCount} Karten` : 'Vorrat leer'}
              on:click={() => select({ source: 'stock' })}
            >
              {#if stockTop}<StufenCard card={stockTop} badge={me.stockCount} />{:else}<span class="aa-empty"></span>{/if}
            </button>
          </div>
          <div class="aa-own aa-own--discards">
            <span class="aa-own-label">Deine Ablage</span>
            <div class="aa-discards">
              {#each me.discards as pile, index (index)}
                {@const top = topOf(pile)}
                <div class="aa-discard-col">
                <button
                  type="button"
                  class="aa-card-btn aa-discard"
                  class:is-selected={active?.source === 'discard' && active.discardIndex === index}
                  class:is-target={canDiscardSelection && canAct}
                  disabled={!canAct || (!canDiscardSelection && !top)}
                  aria-label={`Ablage ${index + 1}${top ? `: oben ${cardName(top)}, ${pile.length} Karten` : ', leer'}${canDiscardSelection ? ' – hier ablegen und Zug beenden' : ''}`}
                  on:click={() => handleDiscard(index)}
                >
                  {#if top}
                    {#if pile.length > 1}<span class="aa-under"><StufenCard card={pile[pile.length - 2]} /></span>{/if}
                    <StufenCard card={top} badge={pile.length > 1 ? pile.length : null} />
                  {:else}
                    <span class="aa-empty aa-empty--discard">{index + 1}</span>
                  {/if}
                </button>
                {#if pile.length}
                  <button
                    type="button"
                    class="aa-peek"
                    aria-label={`Ablage ${index + 1} ansehen, ${pile.length} ${pile.length === 1 ? 'Karte' : 'Karten'}`}
                    on:click={() => openViewer(me.id, index)}
                  >
                    <Eye size={14} aria-hidden="true" /><span class="ui-num">{pile.length}</span>
                  </button>
                {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="aa-hand-head">
          <span class="aa-own-label">Hand</span>
          {#if canAct && me.hand.length === 0}
            <button type="button" class="ui-btn ui-btn--primary" on:click={endTurn}>Zug beenden</button>
          {/if}
        </div>
        <ul class="aa-hand">
          {#each hand as card (card.id)}
            {@const fits = piles.some((pile) => canPlay(card, pile))}
            <li>
              <button
                type="button"
                class="aa-card-btn aa-hand-card"
                class:is-selected={active?.source === 'hand' && active.cardId === card.id}
                class:fits={fits && canAct}
                disabled={!canAct}
                aria-pressed={active?.source === 'hand' && active.cardId === card.id}
                aria-label={`Hand: ${cardName(card)}${canAct ? (fits ? ', passt' : ', passt gerade nicht') : ''}`}
                on:click={() => select({ source: 'hand', cardId: card.id })}
              >
                <StufenCard {card} />
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if !isRunning}
      <section class="ui-panel aa-final" aria-label="Endstand">
        <h3 class="ui-section-title">Restkarten im Vorrat</h3>
        <ol class="aa-final-list">
          {#each [...game.players].sort((a, b) => a.stockCount - b.stockCount) as player (player.id)}
            <li class="aa-final-row">
              <PlayerAvatar avatar={avatarOf(player.id)} name={player.name} color={playerHexById(players, player.id)} size={24} />
              <span>{player.name}</span>
              <strong class="ui-num">{player.stockCount}</strong>
            </li>
          {/each}
        </ol>
      </section>
    {/if}
  </div>
  {#if viewer && viewerPlayer}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="ui-dialog-backdrop" role="presentation" on:click|self={closeViewer}>
      <div
        bind:this={viewerEl}
        class="ui-dialog aa-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aa-viewer-title"
        aria-describedby="aa-viewer-text"
        tabindex="-1"
        on:keydown={handleViewerKeydown}
      >
        <div class="aa-viewer-head">
          <PlayerAvatar avatar={avatarOf(viewerPlayer.id)} name={viewerPlayer.name} color={playerHexById(players, viewerPlayer.id)} size={28} />
          <h2 id="aa-viewer-title" class="aa-viewer-title">{viewerTitle}</h2>
          <button type="button" class="ui-btn ui-btn--ghost ui-btn--icon" aria-label="Schließen" on:click={closeViewer}><X size={18} aria-hidden="true" /></button>
        </div>
        <p id="aa-viewer-text" class="aa-viewer-text">
          {#if viewerCards.length}
            {viewerCards.length} {viewerCards.length === 1 ? 'Karte' : 'Karten'}, von unten nach oben. Nur die oberste kann gespielt werden.
          {:else}
            Dieser Stapel ist leer.
          {/if}
        </p>
        {#if viewerCards.length}
          <ol class="aa-viewer-list">
            {#each viewerCards as card, position (card.id)}
              {@const isTop = position === viewerCards.length - 1}
              <li class="aa-viewer-item" class:is-top={isTop}>
                <span class="aa-viewer-card"><StufenCard {card} /></span>
                <span class="aa-viewer-pos ui-num">{isTop ? 'oben' : `${position + 1}.`}</span>
              </li>
            {/each}
          </ol>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  .aa {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin-top: 12px;
    color: var(--text);
    min-width: 0;
  }

  .aa-status {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }

  .aa-status-text {
    min-width: 0;
  }

  .aa-status-main {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.35;
    font-weight: 600;
    text-wrap: balance;
  }

  .aa-status-event {
    margin: 2px 0 0;
    font-size: 0.875rem;
    line-height: 1.4;
    color: var(--muted);
  }

  .aa-chip {
    flex-shrink: 0;
  }

  /* Mitspieler */
  .aa-opps {
    overflow-x: auto;
    padding: 2px 0;
    scrollbar-width: none;
  }

  .aa-opps::-webkit-scrollbar {
    display: none;
  }

  .aa-opps-list {
    display: flex;
    gap: 8px;
    width: max-content;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .aa-opp {
    display: grid;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-inner);
    background: var(--surface);
  }

  .aa-opp.is-active {
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .aa-opp.is-winner {
    box-shadow: inset 0 0 0 2px var(--positive);
  }

  .aa-opp-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .aa-opp-meta {
    display: grid;
    min-width: 0;
  }

  .aa-opp-name {
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .aa-opp-sub {
    font-size: 0.75rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .aa-opp-cards {
    display: flex;
    gap: 4px;
  }

  .aa-mini {
    display: block;
    width: 2rem;
  }

  .aa-mini--stock {
    margin-right: 6px;
  }

  .aa-empty {
    display: block;
    aspect-ratio: 100 / 140;
    border-radius: 6px;
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--muted) 35%, transparent);
  }

  .aa-empty--discard {
    display: grid;
    place-items: center;
    font-weight: 700;
    color: color-mix(in srgb, var(--muted) 70%, transparent);
  }

  /* Baustapel */
  .aa-builds {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: clamp(6px, 2vw, 18px);
    max-width: 44rem;
    margin: 0 auto;
  }

  .aa-build {
    display: grid;
    justify-items: center;
    gap: 6px;
    min-width: 0;
  }

  .aa-deck {
    padding-left: clamp(4px, 1.5vw, 14px);
    border-left: 1px dashed color-mix(in srgb, var(--muted) 35%, transparent);
  }

  .aa-build-label {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--muted);
  }

  .aa-build-label.is-up {
    color: var(--positive);
  }

  .aa-build-label.is-down {
    color: var(--negative);
  }

  .aa-build-slot {
    position: relative;
    display: block;
    width: 100%;
    max-width: 7rem;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: inherit;
  }

  .aa-build-slot:disabled {
    cursor: default;
  }

  .aa-build-slot.is-target {
    cursor: pointer;
    box-shadow: 0 0 0 3px var(--accent-main), 0 0 18px color-mix(in srgb, var(--accent-main) 45%, transparent);
    animation: aa-pulse 1.2s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .aa-build-slot.is-target {
      animation: none;
    }
  }

  @keyframes aa-pulse {
    50% {
      transform: translateY(-2px);
    }
  }

  .aa-build-empty {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    aspect-ratio: 100 / 140;
    border-radius: 10px;
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--muted) 35%, transparent);
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--muted);
  }

  .aa-build-arrow {
    font-size: 1.75rem;
    line-height: 1;
  }

  .aa-build-next {
    font-size: 0.75rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .aa-joker-hint {
    position: absolute;
    left: 50%;
    bottom: -10px;
    transform: translateX(-50%);
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--accent-main);
    color: #fff;
    font-size: 0.6875rem;
    font-weight: 700;
    white-space: nowrap;
  }

  /* Eigene Karten */
  .aa-mine {
    display: grid;
    gap: 12px;
  }

  .aa-mine-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 24px;
    align-items: flex-end;
  }

  .aa-own {
    display: grid;
    gap: 6px;
  }

  .aa-own--discards {
    flex: 1 1 16rem;
  }

  .aa-own-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--muted);
  }

  .aa-own-label strong {
    color: var(--text);
  }

  .aa-card-btn {
    position: relative;
    display: block;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: transform 140ms ease, box-shadow 140ms ease;
  }

  .aa-card-btn:disabled {
    cursor: default;
  }

  .aa-card-btn:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .aa-card-btn.is-selected {
    transform: translateY(-6px);
    box-shadow: 0 0 0 3px var(--accent-main);
  }

  .aa-stock {
    width: clamp(4.5rem, 20vw, 6.5rem);
  }

  .aa-discards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 5.5rem));
    gap: 8px;
  }

  .aa-discard-col {
    display: grid;
    gap: 4px;
    justify-items: center;
    min-width: 0;
  }

  .aa-discard {
    width: 100%;
  }

  .aa-peek {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    background: var(--pill-neutral-bg);
    color: var(--pill-neutral-ink);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .aa-peek:focus-visible,
  .aa-mini-btn:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .aa-mini-btn {
    position: relative;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }

  .aa-mini-btn :global(.stufen-badge) {
    right: -5px;
    top: -5px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 0.625rem;
    line-height: 16px;
  }

  @media (hover: hover) {
    .aa-peek:hover {
      background: color-mix(in srgb, var(--accent-main) 18%, var(--pill-neutral-bg));
    }

    .aa-mini-btn:hover {
      transform: translateY(-2px);
    }
  }

  .aa-viewer {
    max-width: 560px;
  }

  .aa-viewer-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .aa-viewer-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 700;
  }

  .aa-viewer-text {
    margin: 6px 0 14px;
    font-size: 0.875rem;
    color: var(--muted);
  }

  .aa-viewer-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4rem, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .aa-viewer-item {
    display: grid;
    justify-items: center;
    gap: 4px;
  }

  .aa-viewer-card {
    display: block;
    width: 100%;
    max-width: 4.5rem;
  }

  .aa-viewer-pos {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .aa-viewer-item.is-top .aa-viewer-card {
    border-radius: 10px;
    box-shadow: 0 0 0 3px var(--accent-main);
  }

  .aa-viewer-item.is-top .aa-viewer-pos {
    font-weight: 700;
    color: var(--accent-main);
  }

  .aa-discard.is-target {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-main) 70%, transparent);
  }

  .aa-under {
    position: absolute;
    inset: 0;
    transform: translate(3px, -6px);
    opacity: 0.6;
  }

  .aa-hand-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 36px;
  }

  .aa-hand {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .aa-hand-card {
    width: clamp(3.75rem, 16vw, 5.5rem);
  }

  .aa-hand-card:not(:disabled):hover {
    transform: translateY(-3px);
  }

  .aa-hand-card.is-selected:hover {
    transform: translateY(-6px);
  }

  .aa-hand-card.fits::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -7px;
    width: 6px;
    height: 6px;
    margin-left: -3px;
    border-radius: 50%;
    background: var(--positive);
  }

  /* Ende */
  .aa-final-list {
    display: grid;
    gap: 6px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .aa-final-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .aa-final-row strong {
    margin-left: auto;
  }
</style>
