<script>
  import { Check } from '@lucide/svelte';
  import PlayingCard from './PlayingCard.svelte';

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

  let draggedDrawnCard = false;
  let draggedDiscardCard = false;
  let drawnCardSelected = false;
  let lastDrawnCardId = '';

  $: me = /** @type {SkyjoPlayer | undefined} */ (game.players.find((/** @type {SkyjoPlayer} */ player) => player.id === currentPlayerId));
  $: orderedPlayers = me ? [me, ...game.players.filter((/** @type {SkyjoPlayer} */ player) => player.id !== currentPlayerId)] : game.players;
  $: opponents = orderedPlayers.filter((/** @type {SkyjoPlayer} */ player) => player.id !== currentPlayerId);
  $: isMyTurn = game.state.currentPlayerId === currentPlayerId;
  $: topDiscard = game.state.discardPile.at(-1) ?? null;
  $: canDraw = game.state.phase !== 'setup' && isMyTurn && !game.state.drawnCard && !isLoading;
  $: canUseDrawnCard = Boolean(isMyTurn && game.state.drawnCard && !isLoading);
  $: forcedReplace = game.state.drawnFrom === 'discard';
  $: currentDrawnCardId = game.state.drawnCard?.id ?? '';
  $: if (currentDrawnCardId !== lastDrawnCardId) {
    lastDrawnCardId = currentDrawnCardId;
    drawnCardSelected = forcedReplace;
  }
  $: if (forcedReplace) drawnCardSelected = true;
  $: currentTurnName = game.players.find((/** @type {SkyjoPlayer} */ player) => player.id === game.state.currentPlayerId)?.name ?? '';
  $: isFinished = game.status === 'finished' || game.state.phase === 'finished';
  $: actionText = getActionText();

  function getActionText() {
    if (game.state.phase === 'setup') return 'Decke zwei eigene Karten auf.';
    if (isFinished) return 'Die Runde ist beendet. Die restlichen Karten werden aufgedeckt.';
    if (!isMyTurn) return `${currentTurnName} ist am Zug.`;
    if (!game.state.drawnCard) return 'Ziehe vom Stapel oder nimm die Ablage.';
    if (forcedReplace) return 'Ablagekarte: waehle eine eigene Karte zum Tauschen.';
    if (drawnCardSelected) return 'Obere Karte aktiv: tippe eine eigene Karte zum Tauschen.';
    return 'Tippe eine verdeckte Karte zum Aufdecken oder waehle oben zum Tauschen.';
  }

  /** @param {SkyjoPlayer} player */
  function visibleScore(player) {
    return player.grid.reduce((score, slot) => (slot.removed ? score : score + (slot.revealed ? slot.value ?? 0 : 0)), 0);
  }

  /** @param {SkyjoPlayer} player */
  function revealedCount(player) {
    return player.grid.filter((slot) => slot.revealed).length;
  }

  /** @param {SkyjoSlot} slot */
  function canTargetSlot(slot) {
    if (slot.removed) return false;
    if (canDraw && topDiscard) return true;
    if (!canUseDrawnCard) return false;
    if (forcedReplace || drawnCardSelected || draggedDrawnCard) return true;
    return game.state.drawnFrom === 'deck' && !slot.revealed;
  }

  /** @param {SkyjoSlot} slot */
  function canDropOnSlot(slot) {
    if (slot.removed) return false;
    if (draggedDiscardCard) return Boolean(canDraw && topDiscard);
    if (draggedDrawnCard) return canUseDrawnCard;
    return false;
  }

  /** @param {number} cardIndex */
  function useDrawnCardOn(cardIndex) {
    if (!me || !game.state.drawnCard) return;
    const slot = me.grid[cardIndex];

    if (!canTargetSlot(slot)) return;

    if (forcedReplace || drawnCardSelected || draggedDrawnCard) {
      onMove({ type: 'replace', cardIndex });
      drawnCardSelected = false;
      return;
    }

    onMove({ type: 'discard-and-reveal', cardIndex });
  }

  /** @param {number} cardIndex */
  function handleOwnCardClick(cardIndex) {
    if (!me || isLoading) return;

    if (game.state.phase === 'setup') {
      if (revealedCount(me) < 2 && !me.grid[cardIndex].revealed) {
        onMove({ type: 'reveal-start', cardIndex });
      }
      return;
    }

    useDrawnCardOn(cardIndex);
  }

  function selectDrawnCard() {
    if (!canUseDrawnCard) return;
    drawnCardSelected = true;
  }

  /** @param {DragEvent} event */
  function handleDrawnDragStart(event) {
    if (!canUseDrawnCard) return;
    draggedDrawnCard = true;
    drawnCardSelected = true;
    event.dataTransfer?.setData('text/plain', 'drawn-card');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function handleDrawnDragEnd() {
    draggedDrawnCard = false;
  }

  /** @param {DragEvent} event */
  function handleDiscardDragStart(event) {
    if (!canDraw || !topDiscard) return;
    draggedDiscardCard = true;
    event.dataTransfer?.setData('text/plain', 'discard-card');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function handleDiscardDragEnd() {
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
    if (!draggedDrawnCard && !draggedDiscardCard) return;
    event.preventDefault();

    if (draggedDiscardCard) {
      draggedDiscardCard = false;
      onMove({ type: 'replace-from-discard', cardIndex });
      return;
    }

    draggedDrawnCard = false;
    useDrawnCardOn(cardIndex);
  }

  /** @param {number} column */
  function isClearedColumn(column) {
    if (!me) return false;
    const indexes = [column, column + 4, column + 8];
    return indexes.every((index) => me.grid[index]?.removed);
  }

  /** @param {number} row */
  function isClearedRow(row) {
    if (!me) return false;
    const start = row * 4;
    const indexes = [start, start + 1, start + 2, start + 3];
    return indexes.every((index) => me.grid[index]?.removed);
  }
</script>

<div class="space-y-3 sm:space-y-4">
  <section class="animate-ui-soft-rise rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div class="min-w-0">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold leading-tight text-slate-950 sm:text-xl">Skyjo</h2>
            <p class="mt-1 min-h-10 text-sm leading-5 text-slate-600 sm:min-h-5">{actionText}</p>
          </div>
          {#if isMyTurn && !isFinished}
            <span class="shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">Du bist dran</span>
          {/if}
        </div>

        {#if me}
          <div class="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm">
            <span class="rounded-md bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-800 ring-1 ring-cyan-200">Sichtbar: {visibleScore(me)}</span>
            <span class="rounded-md bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">Offen: {revealedCount(me)}</span>
            <span class="rounded-md bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">Deck: {game.state.deck.length}</span>
          </div>
        {/if}
      </div>

      <div class="mx-auto grid w-full max-w-[14rem] grid-cols-3 gap-1.5 justify-self-center sm:max-w-[18rem] sm:gap-2 lg:w-full">
        <div class="min-w-0">
          <p class="mb-1 text-center text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-xs">Stapel</p>
          <PlayingCard size="sm" hidden value={null} disabled={!canDraw} label="Vom Nachziehstapel ziehen" on:click={() => onMove({ type: 'draw', source: 'deck' })} />
        </div>
        <div class="min-w-0">
          <p class="mb-1 text-center text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-xs">Ablage</p>
          <PlayingCard
            size="sm"
            value={topDiscard?.value ?? null}
            disabled={!canDraw || !topDiscard}
            draggable={canDraw && Boolean(topDiscard)}
            label="Von der Ablage nehmen"
            on:click={() => onMove({ type: 'draw', source: 'discard' })}
            on:dragstart={handleDiscardDragStart}
            on:dragend={handleDiscardDragEnd}
          />
        </div>
        <div class="min-w-0">
          <p class="mb-1 text-center text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-xs">Oben</p>
          <PlayingCard
            size="sm"
            value={game.state.drawnCard?.value ?? null}
            hidden={!game.state.drawnCard}
            selected={drawnCardSelected}
            disabled={!canUseDrawnCard}
            draggable={canUseDrawnCard}
            label="Obere Karte zum Tauschen auswaehlen"
            on:click={selectDrawnCard}
            on:dragstart={handleDrawnDragStart}
            on:dragend={handleDrawnDragEnd}
          />
        </div>
      </div>
    </div>
  </section>

  {#if me}
    <section class="animate-ui-soft-rise rounded-lg border border-cyan-200 bg-white p-2.5 shadow-sm sm:p-4">
      <div class="mb-1.5 flex items-center justify-between gap-3 sm:mb-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 sm:text-sm">Dein Feld</p>
          <h3 class="truncate text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">{me.name}</h3>
        </div>
      </div>

      <div class="mx-auto grid max-w-[20rem] grid-cols-4 gap-1.5 sm:max-w-[30rem] sm:gap-3">
        {#each me.grid as slot, cardIndex (slot.id)}
          <div class="relative">
            {#if cardIndex < 4 && isClearedColumn(cardIndex)}
              <span class="absolute -top-1.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[0.58rem] font-semibold text-white shadow-sm sm:-top-2 sm:px-2 sm:text-[0.65rem]">
                <Check size={11} />
              </span>
            {/if}
            {#if cardIndex % 4 === 0 && isClearedRow(Math.floor(cardIndex / 4))}
              <span class="absolute left-1 top-1 z-10 inline-flex items-center rounded-full bg-cyan-600 px-1.5 py-0.5 text-[0.58rem] font-semibold text-white shadow-sm sm:text-[0.65rem]">
                <Check size={11} />
              </span>
            {/if}
            <PlayingCard
              size="sm"
              value={slot.value}
              hidden={!slot.revealed}
              removed={slot.removed}
              dropTarget={canUseDrawnCard ? canTargetSlot(slot) : canDropOnSlot(slot)}
              revealDelayMs={isFinished && !slot.removed ? cardIndex * 70 : 0}
              disabled={slot.removed || isLoading || isFinished}
              label={`Deine Karte ${cardIndex + 1}`}
              on:click={() => handleOwnCardClick(cardIndex)}
              on:dragover={(event) => handleCardDragOver(event, cardIndex)}
              on:drop={(event) => handleCardDrop(event, cardIndex)}
            />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if opponents.length > 0}
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {#each opponents as player (player.id)}
        <section class="animate-ui-soft-rise rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h3 class="truncate text-base font-semibold text-slate-950">{player.name}</h3>
              <p class="text-xs text-slate-500">Sichtbar: {visibleScore(player)}</p>
            </div>
            {#if player.id === game.state.currentPlayerId}
              <span class="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">Am Zug</span>
            {/if}
          </div>

          <div class="mt-3 grid grid-cols-4 gap-1.5">
            {#each player.grid as slot, cardIndex (slot.id)}
              <PlayingCard size="sm" value={slot.value} hidden={!slot.revealed} removed={slot.removed} revealDelayMs={isFinished && !slot.removed ? 900 + cardIndex * 45 : 0} disabled label={`Karte ${cardIndex + 1} von ${player.name}`} />
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>