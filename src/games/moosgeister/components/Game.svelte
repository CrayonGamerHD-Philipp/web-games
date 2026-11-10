<script>
  import { onMount } from 'svelte';
  import GeistCard from './GeistCard.svelte';
  import ScoreExplainer from './ScoreExplainer.svelte';
  import { MOOS_COLOR_NAMES, spiritOf, applyPlacement, filledCount, groupMultiplier, largestGroup, moosCardName, placementOptions, scoreLayout } from '../rules.js';
  import { playerHexById } from '$lib/player-colors.js';
  import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';

  /** @typedef {import('../types').MoosSession} MoosSession */
  /** @typedef {import('../types').MoosPlayer} MoosPlayer */
  /** @typedef {import('../types').MoosCard} MoosCard */
  /** @typedef {import('../types').MoosSlot} MoosSlot */
  /** @typedef {import('../types').MoosMove} MoosMove */
  /** @typedef {import('../types').MoosEvent} MoosEvent */

  /** @type {MoosSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: MoosMove) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** @type {{ id: string, name?: string, color?: string, avatar?: import('$lib/party-features.js').Avatar | null }[]} */
  export let players = [];

  $: void renderNonce;

  const soundSources = { take: '/sounds/take_card1.mp3', end: '/sounds/ping.mp3' };
  /** @type {Map<string, HTMLAudioElement>} */
  const audioCache = new Map();

  /** Lokale Auswahl, erst „Bestätigen“ schickt den Zug. */
  /** @type {string | null} */
  let draftCardId = null;
  /** @type {number | null} */
  let draftSlot = null;
  /** @type {boolean | null} */
  let draftFlipOld = null;
  let lastSeq = -1;

  /** „So wird gerechnet“ – am großen Bildschirm offen, am Handy auf Wunsch. */
  let explainOpen = false;
  /** @type {number[]} */
  let mineHighlight = [];
  /** Aufgeklappte Rechnung in der Wertungstabelle. */
  /** @type {string | null} */
  let expandedRow = null;
  /** @type {number[]} */
  let rowHighlight = [];

  onMount(() => {
    try {
      const stored = localStorage.getItem('moosgeister:explain');
      explainOpen = stored === null ? matchMedia('(min-width: 1000px)').matches : stored === '1';
    } catch {
      explainOpen = false;
    }
  });

  function toggleExplain() {
    explainOpen = !explainOpen;
    if (!explainOpen) mineHighlight = [];
    try {
      localStorage.setItem('moosgeister:explain', explainOpen ? '1' : '0');
    } catch {}
  }

  /** @param {string} playerId */
  function toggleRow(playerId) {
    expandedRow = expandedRow === playerId ? null : playerId;
    rowHighlight = [];
  }

  $: state = game?.state ?? null;
  $: isRunning = game?.status === 'running';
  $: phase = state?.phase ?? 'drafting';
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: isMyTurn = Boolean(isRunning && phase === 'drafting' && me && state?.currentPlayerId === currentPlayerId);
  $: canAct = isMyTurn && !isLoading;
  $: market = state?.market ?? [];
  $: if (draftCardId && (!canAct || !market.some((card) => card.id === draftCardId))) resetDraft();
  $: draftCard = draftCardId ? market.find((card) => card.id === draftCardId) ?? null : null;
  $: option = draftCard && me ? placementOptions(me.layout, draftCard) : null;
  $: legalSlots = getLegalSlots(option);
  $: draftReady = isDraftReady(option, draftSlot, draftFlipOld);
  $: previewLayout = draftCard && me && draftReady ? previewPlacement(me.layout, draftCard) : null;
  $: shownLayout = previewLayout ?? me?.layout ?? [];
  $: myScore = me ? scoreLayout(me.layout, state?.durchgang ?? 1) : null;
  $: previewScore = previewLayout ? scoreLayout(previewLayout, state?.durchgang ?? 1) : null;
  $: myGroup = largestGroup(shownLayout);
  $: opponents = orderOpponents(game, currentPlayerId);
  $: turnPlayer = game?.players.find((player) => player.id === state?.currentPlayerId) ?? null;
  $: lastResult = state?.results?.length ? state.results[state.results.length - 1] : null;
  $: showResults = phase !== 'drafting' && Boolean(lastResult);
  $: iConfirmed = Boolean(state?.confirmedPlayerIds?.includes(currentPlayerId));
  $: statusText = getStatusText(game, isMyTurn, Boolean(me), turnPlayer, option, iConfirmed);
  $: eventText = state?.lastEvent?.text ?? '';
  $: handleEvent(state?.lastEvent ?? null);

  function resetDraft() {
    draftCardId = null;
    draftSlot = null;
    draftFlipOld = null;
  }

  /** @param {import('../rules.js').MoosPlacement | null} current */
  function getLegalSlots(current) {
    if (!current) return new Set();
    if (current.kind === 'moss') return new Set(current.slots);
    if (current.kind === 'discard') return new Set();
    return new Set([current.slot]);
  }

  /**
   * @param {import('../rules.js').MoosPlacement | null} current
   * @param {number | null} slot
   * @param {boolean | null} flipOld
   */
  function isDraftReady(current, slot, flipOld) {
    if (!current) return false;
    if (current.kind === 'choose') return flipOld !== null;
    if (current.kind === 'moss') return slot !== null && current.slots.includes(slot);
    return true;
  }

  /**
   * @param {MoosSlot[]} layout
   * @param {MoosCard} card
   */
  function previewPlacement(layout, card) {
    const placed = applyPlacement(/** @type {any} */ (layout), card, { slot: draftSlot ?? undefined, flipOld: draftFlipOld ?? undefined });
    return 'error' in placed ? null : /** @type {MoosSlot[]} */ (placed.layout);
  }

  /** @param {MoosCard} card */
  function pickCard(card) {
    if (!canAct) return;
    if (draftCardId === card.id) {
      resetDraft();
      return;
    }
    draftCardId = card.id;
    draftSlot = null;
    draftFlipOld = null;
  }

  /** @param {number} index */
  function pickSlot(index) {
    if (!canAct || !option || !legalSlots.has(index)) return;
    if (option.kind === 'moss') draftSlot = draftSlot === index ? null : index;
  }

  function confirm() {
    if (!canAct || !draftCard || !draftReady) return;
    /** @type {MoosMove} */
    const move = { type: 'take', cardId: draftCard.id };
    if (option?.kind === 'moss' && draftSlot !== null) move.slot = draftSlot;
    if (option?.kind === 'choose' && draftFlipOld !== null) move.flipOld = draftFlipOld;
    onMove(move);
    resetDraft();
  }

  function continueGame() {
    if (isLoading || iConfirmed || phase !== 'scoring' || !me) return;
    onMove({ type: 'continue' });
  }

  /**
   * @param {MoosSession | null} session
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
      .map((player) => /** @type {MoosPlayer} */ (player));
  }

  /**
   * @param {MoosSession | null} session
   * @param {boolean} myTurn
   * @param {boolean} isPlayer
   * @param {MoosPlayer | null} turn
   * @param {import('../rules.js').MoosPlacement | null} current
   * @param {boolean} confirmed
   */
  function getStatusText(session, myTurn, isPlayer, turn, current, confirmed) {
    if (!session) return '';
    if (session.status === 'finished') return 'Alle drei Durchgänge sind gewertet.';
    if (session.state.phase === 'scoring') {
      if (!isPlayer) return 'Der Durchgang wird gewertet.';
      return confirmed ? 'Warte, bis alle bereit sind.' : 'Durchgang gewertet. Tippe „Weiter“, wenn du bereit bist.';
    }
    if (!myTurn) {
      const prefix = isPlayer ? '' : 'Du schaust zu. ';
      return turn ? `${prefix}${turn.name} wählt einen Geist.` : `${prefix}Das Spiel läuft.`;
    }
    if (!current) return market.length === 1 ? 'Die letzte Karte gehört dir. Tippe sie an.' : 'Wähle einen Geist aus der Mitte.';
    if (current.kind === 'place') return `Der Geist kommt auf Platz ${current.slot + 1}.`;
    if (current.kind === 'cover') return `Der Geist setzt sich auf das Moos auf Platz ${current.slot + 1}.`;
    if (current.kind === 'choose') return `Auf Platz ${current.slot + 1} sitzt schon ein Geist. Wer wird zu Moos?`;
    if (current.kind === 'moss') return `Platz ${draftCard ? draftCard.number : ''} ist voll. Lege die Karte als Moos auf einen freien Platz.`;
    return 'Kein Platz mehr frei. Die Karte wird abgeworfen.';
  }

  /** @param {MoosEvent | null} event */
  function handleEvent(event) {
    const seq = event?.seq ?? 0;
    if (seq === lastSeq) return;
    const isFirst = lastSeq === -1;
    lastSeq = seq;
    if (isFirst || !event) return;
    if (event.type === 'take') playSound('take');
    else if (event.type === 'durchgang-end' || event.type === 'win') playSound('end');
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

  /** @param {string} id */
  function avatarOf(id) {
    return players.find((player) => player.id === id)?.avatar ?? null;
  }

  /** @param {string} id */
  function nameOf(id) {
    return game?.players.find((player) => player.id === id)?.name ?? 'Jemand';
  }

  /** @param {MoosCard} card */
  function cardLabel(card) {
    const parts = [moosCardName(card), spiritOf(card).name];
    if (card.spirals) parts.push(`${card.spirals} ${card.spirals === 1 ? 'Spirale' : 'Spiralen'}`);
    if (card.crosses) parts.push(`${card.crosses} ${card.crosses === 1 ? 'Kreuz' : 'Kreuze'}`);
    if (card.bonus) parts.push(`+1 je ${MOOS_COLOR_NAMES[card.bonus]}`);
    return parts.join(', ');
  }

  /** @param {MoosSlot} slot @param {number} index */
  function slotLabel(slot, index) {
    const base = `Platz ${index + 1}`;
    if (!slot.face && !slot.moss) return `${base}, leer`;
    if (!slot.face) return `${base}, Moos`;
    return `${base}: ${cardLabel(slot.face)}${slot.moss ? ', auf Moos' : ''}`;
  }

  /** @param {number} value */
  function signed(value) {
    return value > 0 ? `+${value}` : String(value);
  }

  /** @param {string} id */
  function totalOf(id) {
    return state?.totals?.find((total) => total.playerId === id)?.score ?? 0;
  }
</script>

{#if !game || !state}
  <div class="ui-alert" role="status">Moosgeister wird über eine Party gestartet, damit alle Mitspieler verbunden sind.</div>
{:else}
  <div class="mg">
    <header class="mg-status">
      <div class="mg-status-text" aria-live="polite" aria-atomic="true">
        <p class="mg-status-main">{statusText}</p>
        {#if eventText && eventText !== statusText}
          <p class="mg-status-event">{eventText}</p>
        {/if}
      </div>
      <div class="mg-chips">
        <span class="ui-chip">Durchgang {state.durchgang}/{state.totalDurchgaenge}</span>
        {#if phase === 'drafting'}<span class="ui-chip ui-num">Stapel {state.deckCount}</span>{/if}
        {#if isMyTurn}<span class="ui-chip ui-chip--accent">Du bist dran</span>{/if}
      </div>
    </header>

    {#if showResults && lastResult}
      <section class="ui-panel mg-results" aria-labelledby="mg-results-title">
        <h3 id="mg-results-title" class="ui-section-title">
          {phase === 'finished' ? 'Endstand' : `Wertung Durchgang ${lastResult.durchgang}`}
        </h3>
        <div class="mg-table-wrap touch-scroll-x">
          <table class="mg-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" title="Zahlen der Geister auf Moos">Zahlen</th>
                <th scope="col">Spiralen</th>
                <th scope="col">Kreuze</th>
                <th scope="col">Farbbonus</th>
                <th scope="col">Gruppe ×{groupMultiplier(lastResult.durchgang)}</th>
                <th scope="col">Durchgang</th>
                <th scope="col">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {#each [...lastResult.scores].sort((a, b) => totalOf(b.playerId) - totalOf(a.playerId)) as row (row.playerId)}
                {@const rowPlayer = game.players.find((player) => player.id === row.playerId)}
                <tr class:is-me={row.playerId === currentPlayerId} class:is-expanded={expandedRow === row.playerId}>
                  <th scope="row">
                    <span class="mg-who">
                      <PlayerAvatar avatar={avatarOf(row.playerId)} name={nameOf(row.playerId)} color={playerHexById(players, row.playerId)} size={24} />
                      {nameOf(row.playerId)}
                      {#if phase === 'scoring' && state.confirmedPlayerIds.includes(row.playerId)}<span class="mg-ready">bereit</span>{/if}
                    </span>
                    {#if rowPlayer}
                      <button type="button" class="mg-row-toggle" aria-expanded={expandedRow === row.playerId} on:click={() => toggleRow(row.playerId)}>
                        {expandedRow === row.playerId ? 'Rechnung schließen' : 'Rechnung zeigen'}
                      </button>
                    {/if}
                  </th>
                  <td class="ui-num">{row.breakdown.numbers}</td>
                  <td class="ui-num">+{row.breakdown.spirals}</td>
                  <td class="ui-num">−{row.breakdown.crosses}</td>
                  <td class="ui-num">+{row.breakdown.bonus}</td>
                  <td class="ui-num">{row.breakdown.groupSize} → {row.breakdown.group}</td>
                  <td class="ui-num mg-strong">{row.breakdown.total}</td>
                  <td class="ui-num mg-strong">{totalOf(row.playerId)}</td>
                </tr>
                {#if expandedRow === row.playerId && rowPlayer}
                  <tr class="mg-explain-row">
                    <td colspan="8">
                      <div class="mg-explain-detail">
                        <div class="mg-grid mg-grid--detail" aria-label={`Auslage von ${nameOf(row.playerId)}`}>
                          {#each rowPlayer.layout as slot, index (index)}
                            <div class="mg-slot mg-slot--small" class:is-explained={rowHighlight.includes(index)} role="img" aria-label={slotLabel(slot, index)}>
                              {#if slot.moss}
                                <span class="mg-layer mg-layer--moss">
                                  {#if 'hidden' in slot.moss}<GeistCard back />{:else}<GeistCard card={slot.moss} dim />{/if}
                                </span>
                              {/if}
                              {#if slot.face}
                                <span class="mg-layer mg-layer--face" class:on-moss={Boolean(slot.moss)}><GeistCard card={slot.face} /></span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                        <ScoreExplainer layout={rowPlayer.layout} durchgang={lastResult.durchgang} bind:highlight={rowHighlight} idPrefix={`mg-row-${row.playerId}`} />
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
        {#if state.results.length > 1}
          <p class="mg-history">
            {#each state.results as result (result.durchgang)}
              <span>D{result.durchgang}: {result.scores.map((score) => `${nameOf(score.playerId)} ${score.breakdown.total}`).join(' · ')}</span>
            {/each}
          </p>
        {/if}
        {#if phase === 'scoring' && me}
          <button type="button" class="ui-btn ui-btn--primary mg-continue" disabled={iConfirmed || isLoading} on:click={continueGame}>
            {iConfirmed ? 'Warte auf die anderen …' : `Weiter zu Durchgang ${state.durchgang + 1}`}
          </button>
        {/if}
      </section>
    {/if}

    {#if phase === 'drafting'}
      <section class="ui-panel mg-market" aria-label="Karten in der Mitte">
        <h3 class="ui-section-title">Mitte</h3>
        <ul class="mg-market-list">
          {#each market as card (card.id)}
            <li>
              <button
                type="button"
                class="mg-market-card"
                class:is-selected={draftCardId === card.id}
                disabled={!canAct}
                aria-pressed={draftCardId === card.id}
                aria-label={cardLabel(card)}
                on:click={() => pickCard(card)}
              >
                <GeistCard {card} />
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <div class="mg-main">
      {#if me}
        <section class="ui-panel mg-mine" aria-label="Deine Auslage">
          <div class="mg-mine-head">
            <h3 class="ui-section-title">Dein Wald</h3>
            {#if myScore && phase === 'drafting'}
              <span class="mg-live ui-num">
                {myScore.total} Punkte{#if previewScore && previewScore.total !== myScore.total}<span class="mg-live-delta">{' → '}{previewScore.total} ({signed(previewScore.total - myScore.total)})</span>{/if}
              </span>
            {/if}
          </div>
          <div class="mg-mine-body">
          <div class="mg-mine-play">
          <div class="mg-grid mg-grid--large">
            {#each shownLayout as slot, index (index)}
              {@const legal = legalSlots.has(index)}
              {@const chosen = option?.kind === 'moss' ? draftSlot === index : legal && draftReady}
              <button
                type="button"
                class="mg-slot"
                class:is-legal={legal && canAct}
                class:is-chosen={chosen && canAct}
                class:in-group={myGroup.slots.includes(index) && myGroup.size > 1}
                class:is-explained={mineHighlight.includes(index)}
                disabled={!canAct || !legal || option?.kind !== 'moss'}
                aria-label={slotLabel(slot, index)}
                on:click={() => pickSlot(index)}
              >
                <span class="mg-slot-num" aria-hidden="true">{index + 1}</span>
                {#if slot.moss}
                  <span class="mg-layer mg-layer--moss">
                    {#if phase !== 'drafting' && !('hidden' in slot.moss)}
                      <GeistCard card={slot.moss} dim />
                    {:else}
                      <GeistCard back />
                    {/if}
                  </span>
                {/if}
                {#if slot.face}
                  <span class="mg-layer mg-layer--face" class:on-moss={Boolean(slot.moss)}><GeistCard card={slot.face} /></span>
                {/if}
              </button>
            {/each}
          </div>
          {#if canAct && option}
            <div class="mg-actions">
              {#if option.kind === 'choose'}
                <div class="mg-choice" role="group" aria-label="Welche Karte wird zu Moos?">
                  <button type="button" class="ui-btn" class:ui-btn--primary={draftFlipOld === false} aria-pressed={draftFlipOld === false} on:click={() => (draftFlipOld = false)}>
                    Neue Karte wird Moos
                  </button>
                  <button type="button" class="ui-btn" class:ui-btn--primary={draftFlipOld === true} aria-pressed={draftFlipOld === true} on:click={() => (draftFlipOld = true)}>
                    Alter Geist wird Moos
                  </button>
                </div>
              {/if}
              <div class="mg-confirm-row">
                <button type="button" class="ui-btn ui-btn--ghost" on:click={resetDraft}>Abbrechen</button>
                <button type="button" class="ui-btn ui-btn--primary" disabled={!draftReady || isLoading} on:click={confirm}>
                  {option.kind === 'discard' ? 'Abwerfen' : 'Bestätigen'}
                </button>
              </div>
            </div>
          {/if}
          </div>
          {#if myScore}
            <div class="mg-explain">
              <button type="button" class="mg-explain-toggle" aria-expanded={explainOpen} on:click={toggleExplain}>
                <span>So wird gerechnet</span>
                <span class="mg-explain-sum ui-num">{myScore.total} Punkte</span>
              </button>
              {#if explainOpen}
                <p class="mg-explain-hint">Tippe auf eine Zeile – die Geister, die dafür zählen, leuchten im Wald auf.</p>
                <ScoreExplainer layout={me.layout} durchgang={state.durchgang} bind:highlight={mineHighlight} idPrefix="mg-mine" />
              {/if}
            </div>
          {/if}
          </div>
        </section>
      {/if}

      {#if opponents.length}
        <section class="mg-opps" aria-label="Mitspieler">
          {#each opponents as player (player.id)}
            {@const active = isRunning && phase === 'drafting' && state.currentPlayerId === player.id}
            {@const live = scoreLayout(player.layout, state.durchgang)}
            <article class="ui-panel mg-opp" class:is-active={active}>
              <header class="mg-opp-head">
                <PlayerAvatar avatar={avatarOf(player.id)} name={player.name} color={playerHexById(players, player.id)} size={30} {active} />
                <span class="mg-opp-meta">
                  <span class="mg-opp-name">{player.name}</span>
                  <span class="mg-opp-sub ui-num">
                    {phase === 'drafting' ? `${filledCount(player.layout)}/9 Plätze · ${live.total} P.` : `${totalOf(player.id)} P. gesamt`}{#if active}{' · wählt'}{/if}
                  </span>
                </span>
              </header>
              <div class="mg-grid">
                {#each player.layout as slot, index (index)}
                  <div class="mg-slot mg-slot--small" role="img" aria-label={slotLabel(slot, index)}>
                    {#if slot.moss}
                      <span class="mg-layer mg-layer--moss">
                        {#if 'hidden' in slot.moss || phase === 'drafting'}
                          <GeistCard back />
                        {:else}
                          <GeistCard card={slot.moss} dim />
                        {/if}
                      </span>
                    {/if}
                    {#if slot.face}
                      <span class="mg-layer mg-layer--face" class:on-moss={Boolean(slot.moss)}><GeistCard card={slot.face} /></span>
                    {/if}
                  </div>
                {/each}
              </div>
            </article>
          {/each}
        </section>
      {/if}
    </div>
  </div>
{/if}

<style>
  .mg {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin-top: 12px;
    color: var(--text);
    min-width: 0;
  }

  .mg-status {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px 12px;
    min-height: 44px;
  }

  .mg-status-text {
    min-width: 0;
  }

  .mg-status-main {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.35;
    font-weight: 600;
    text-wrap: balance;
  }

  .mg-status-event {
    margin: 2px 0 0;
    font-size: 0.875rem;
    line-height: 1.4;
    color: var(--muted);
  }

  .mg-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mg-market-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .mg-market-card {
    display: block;
    width: clamp(4.5rem, 18vw, 6.5rem);
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    transition: transform 140ms ease, box-shadow 140ms ease;
  }

  .mg-market-card:disabled {
    cursor: default;
  }

  .mg-market-card:not(:disabled):hover {
    transform: translateY(-3px);
  }

  .mg-market-card.is-selected {
    transform: translateY(-6px);
    box-shadow: 0 0 0 3px var(--accent-main);
  }

  .mg-market-card:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .mg-mine-body {
    display: grid;
    gap: 16px;
  }

  .mg-mine-play {
    display: grid;
    gap: 0;
    min-width: 0;
  }

  /* Breiter Bildschirm: Wald links, Rechnung rechts daneben. */
  @media (min-width: 1000px) {
    .mg-mine-body {
      grid-template-columns: minmax(0, 1fr) minmax(17rem, 22rem);
      align-items: start;
    }
  }

  .mg-explain {
    display: grid;
    gap: 8px;
    align-content: start;
  }

  .mg-explain-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }

  .mg-explain-toggle[aria-expanded='true'] {
    background: var(--accent-soft);
    color: var(--accent-ink);
  }

  .mg-explain-toggle:focus-visible,
  .mg-row-toggle:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .mg-explain-sum {
    font-weight: 700;
  }

  .mg-explain-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .mg-slot.is-explained {
    box-shadow: 0 0 0 3px var(--accent-main);
    z-index: 1;
  }

  .mg-slot.is-explained .mg-layer--face {
    filter: none;
  }

  .mg-row-toggle {
    display: block;
    margin-top: 4px;
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: var(--accent-text);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .mg-explain-row td {
    padding: 12px 8px 16px;
    text-align: left;
    white-space: normal;
  }

  .mg-explain-detail {
    display: grid;
    gap: 16px;
    max-width: 44rem;
  }

  .mg-grid--detail {
    width: min(100%, 13rem);
  }

  @media (min-width: 640px) {
    .mg-explain-detail {
      grid-template-columns: 13rem minmax(0, 1fr);
      align-items: start;
    }
  }

  .mg-main {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr);
  }



  .mg-mine-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .mg-live {
    font-weight: 700;
  }

  .mg-live-delta {
    color: var(--accent-main);
  }

  .mg-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .mg-grid--large {
    gap: 10px;
    width: 100%;
    max-width: min(28rem, max(16rem, 36dvh));
    margin: 0 auto;
  }

  @media (max-width: 640px) {
    .mg-grid--large {
      gap: 6px;
    }

    /* Bedienung bleibt beim Scrollen am unteren Rand sichtbar. */
    .mg-actions {
      position: sticky;
      bottom: 0;
      z-index: 4;
      margin: 12px calc(var(--pad) * -1) calc(var(--pad) * -1);
      padding: 12px var(--pad) calc(12px + env(safe-area-inset-bottom));
      border-radius: var(--radius-card) var(--radius-card) 0 0;
      background: var(--raised);
      box-shadow: 0 -8px 24px rgb(0 0 0 / 0.16);
    }

    .mg-choice .ui-btn,
    .mg-confirm-row .ui-btn {
      flex: 1 1 0;
    }

    .mg-market-list {
      flex-wrap: nowrap;
      justify-content: flex-start;
      overflow-x: auto;
      padding-bottom: 6px;
    }

    .mg-market-list li {
      flex: 0 0 auto;
    }
  }

  .mg-slot {
    position: relative;
    aspect-ratio: 100 / 150;
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: color-mix(in srgb, var(--surface-2, var(--ground)) 70%, transparent);
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--muted) 30%, transparent);
    color: inherit;
  }

  .mg-slot:disabled {
    cursor: default;
  }

  .mg-slot.is-legal {
    box-shadow: inset 0 0 0 3px var(--accent-main);
    background: color-mix(in srgb, var(--accent-main) 12%, transparent);
    cursor: pointer;
  }

  .mg-slot.is-chosen {
    box-shadow: 0 0 0 3px var(--accent-main);
  }

  .mg-slot.in-group .mg-layer--face {
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent-main) 70%, transparent));
  }

  .mg-slot-num {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 1.25rem;
    font-weight: 700;
    color: color-mix(in srgb, var(--muted) 60%, transparent);
  }

  .mg-layer {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
  }

  .mg-layer--face.on-moss {
    top: 7%;
  }

  .mg-actions {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .mg-choice,
  .mg-confirm-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }


  .mg-opps {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 15rem));
  }

  .mg-opp.is-active {
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .mg-opp-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    min-width: 0;
  }

  .mg-opp-meta {
    display: grid;
    min-width: 0;
  }

  .mg-opp-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .mg-opp-sub {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .mg-table-wrap {
    overflow-x: auto;
    margin-top: 8px;
  }

  .mg-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .mg-table th,
  .mg-table td {
    padding: 6px 8px;
    text-align: right;
    white-space: nowrap;
    border-bottom: 1px solid color-mix(in srgb, var(--muted) 20%, transparent);
  }

  .mg-table th[scope='row'],
  .mg-table thead th:first-child {
    text-align: left;
  }

  .mg-table thead th {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
  }

  .mg-table tr.is-me th[scope='row'] {
    color: var(--accent-main);
  }

  .mg-who {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .mg-ready {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--positive);
  }

  .mg-strong {
    font-weight: 700;
  }

  .mg-history {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 8px 0 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .mg-continue {
    margin-top: 12px;
  }
</style>
