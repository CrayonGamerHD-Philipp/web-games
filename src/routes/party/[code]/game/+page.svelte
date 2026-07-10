<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft, LoaderCircle, RotateCcw, Trophy } from '@lucide/svelte';
  import GameEndScreen from '$lib/components/GameEndScreen.svelte';
  import SkyjoBoard from '$lib/components/SkyjoBoard.svelte';
  import { onDestroy, onMount, tick } from 'svelte';

  /** @typedef {{ id: string, name: string, isHost: boolean, joinedAt: string, score: number }} Player */
  /** @typedef {{ id: string, name: string, mark?: string }} GamePlayer */
  /** @typedef {{ board?: (string | null)[], currentPlayerId: string | null, winnerId: string | null, winningLine?: number[], isDraw: boolean, roundScores?: { playerId: string, score: number }[] }} GameState */
  /** @typedef {{ id: string, gameId: string, name: string, status: string, players: GamePlayer[], state: GameState, requests: { rematch: string[], newGame: string[] } }} ActiveGame */
  /** @typedef {{ code: string, players: Player[], activeGame: ActiveGame | null }} Party */

  /** @type {Party | null} */
  let party = null;
  let error = '';
  let gameError = '';
  let isLoading = true;
  let isActionLoading = false;
  let playerId = '';
  let renderNonce = 0;
  /** @type {EventSource | null} */
  let events = null;

  $: code = $page.params.code?.toUpperCase() ?? '';
  $: currentPlayer = party?.players.find((player) => player.id === playerId);
  $: isCurrentHost = Boolean(currentPlayer?.isHost);
  $: activeGame = party?.activeGame ?? null;
  $: myGamePlayer = activeGame?.players.find((player) => player.id === playerId);
  $: currentTurnPlayer = activeGame?.players.find((player) => player.id === activeGame.state.currentPlayerId);
  $: winnerPlayer = activeGame?.players.find((player) => player.id === activeGame.state.winnerId);
  $: isMyTurn = Boolean(activeGame && myGamePlayer && activeGame.state.currentPlayerId === playerId && activeGame.status === 'running');
  $: ticTacToeBoard = activeGame?.state.board ?? [];
  $: boardVersion = activeGame
    ? `${activeGame.id}:${ticTacToeBoard.join('|')}:${activeGame.state.currentPlayerId}:${activeGame.status}`
    : '';
  $: skyjoVersion = activeGame?.gameId === 'skyjo'
    ? `${activeGame.id}:${JSON.stringify(/** @type {any} */ (activeGame).state)}:${JSON.stringify(activeGame.players)}:${renderNonce}`
    : '';
  $: gameScorePlayers = activeGame
    ? activeGame.players.map((gamePlayer) => {
        const partyPlayer = party?.players.find((player) => player.id === gamePlayer.id);
        return {
          id: gamePlayer.id,
          name: gamePlayer.name,
          score: partyPlayer?.score ?? 0,
          isHost: partyPlayer?.isHost ?? false
        };
      })
    : [];
  $: activeGameImage = gameImage(activeGame?.gameId);

  /** @param {string | undefined} gameId */
  function gameImage(gameId) {
    if (gameId === 'skyjo') return '/images/skyjo-scene.png';
    if (gameId === 'tic-tac-toe') return '/images/tic-tac-toe-scene.png';
    return '/images/party-hero.png';
  }


  async function flushGameRender() {
    renderNonce += 1;
    await tick();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        renderNonce += 1;
      });
    }
  }
  function connectEvents() {
    events?.close();
    events = new EventSource(`/api/parties/${code}/events`);

    events.addEventListener('party', async (event) => {
      const data = JSON.parse(event.data);
      party = data.party;
      error = '';
      gameError = '';
      isActionLoading = false;
      isLoading = false;
      await flushGameRender();
    });

    events.addEventListener('error', () => {
      if (!party) {
        error = 'Die Live-Verbindung zur Party konnte nicht hergestellt werden.';
        isLoading = false;
      }
    });
  }

  /**
   * @param {'restart' | 'move' | 'request-rematch' | 'request-new-game' | 'close'} action
   * @param {Record<string, unknown>} payload
   */
  async function sendGameAction(action, payload = {}) {
    gameError = '';
    isActionLoading = true;

    try {
      const response = await fetch(`/api/parties/${code}/game`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, playerId, ...payload })
      });
      const data = await response.json();

      if (!response.ok) {
        gameError = data.message ?? 'Die Spielaktion konnte nicht ausgefuehrt werden.';
        return;
      }

      party = data.party;
      await flushGameRender();
    } catch {
      gameError = 'Die Spielaktion konnte nicht ausgefuehrt werden.';
    } finally {
      isActionLoading = false;
    }
  }

  function restartActiveGame() {
    sendGameAction('restart');
  }

  /** @param {{ type: string, source?: string, cardIndex?: number }} move */
  function sendSkyjoMove(move) {
    sendGameAction('move', { move });
  }

  function requestRematch() {
    sendGameAction('request-rematch');
  }

  function requestNewGame() {
    sendGameAction('request-new-game');
  }

  async function chooseNewGame() {
    await sendGameAction('close');
    await goto(`/party/${code}`);
  }

  /** @param {number} cellIndex */
  function makeMove(cellIndex) {
    if (!activeGame || activeGame.status !== 'running' || ticTacToeBoard[cellIndex]) return;
    if (!myGamePlayer || activeGame.state.currentPlayerId !== playerId) return;
    sendGameAction('move', { cellIndex });
  }

  /** @param {number} cellIndex */
  function isWinningCell(cellIndex) {
    return Boolean(activeGame?.state.winningLine?.includes(cellIndex));
  }

  /** @param {number} cellIndex */
  function canUseCell(cellIndex) {
    return Boolean(isMyTurn && activeGame && !ticTacToeBoard[cellIndex] && !isActionLoading);
  }

  /**
   * @param {number} cellIndex
   * @param {string | null | undefined} mark
   */
  function markStyle(cellIndex, mark) {
    const rotations = mark === 'X' ? [-8, 5, -3, 7, -6, 4, 2, -5, 6] : [4, -5, 3, -4, 5, -2, 6, -3, 2];
    return `--mark-rotate: ${rotations[cellIndex] ?? 0}deg;`;
  }

  /**
   * @param {number} cellIndex
   * @param {string | null | undefined} mark
   */
  function markVariantClass(cellIndex, mark) {
    if (mark === 'X') {
      return cellIndex % 3 === 0 ? 'w-[72%]' : cellIndex % 3 === 1 ? 'w-[66%]' : 'w-[78%]';
    }

    return cellIndex % 3 === 0 ? 'h-[62%] w-[62%] border-[9px]' : cellIndex % 3 === 1 ? 'h-[70%] w-[70%] border-[10px]' : 'h-[66%] w-[66%] border-[8px]';
  }

  /** @param {string | null | undefined} mark */
  function markClass(mark) {
    if (mark === 'X') return 'text-cyan-700';
    if (mark === 'O') return 'text-emerald-700';
    return 'text-slate-300';
  }

  /**
   * @param {number} cellIndex
   * @param {string | null | undefined} mark
   */
  function markImage(cellIndex, mark) {
    const variant = (cellIndex % 4) + 1;
    if (mark === 'X') return '/images/tictactoe/x-' + variant + '.png';
    if (mark === 'O') return '/images/tictactoe/o-' + variant + '.png';
    return '';
  }

  onMount(() => {
    playerId = localStorage.getItem(`party-player:${code}`) ?? '';
    connectEvents();
  });

  onDestroy(() => {
    events?.close();
  });
</script>

<svelte:head>
  <title>Spiel {code} | Web Games</title>
</svelte:head>

<main class="min-h-screen bg-slate-50 text-slate-950">
  <section class="mx-auto w-full px-3 py-3 sm:px-5 sm:py-5 {activeGame?.gameId === 'skyjo' ? 'max-w-5xl' : 'max-w-6xl lg:px-10'}">
    <a href={`/party/${code}`} class="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
      <ArrowLeft size={18} />
      Zur Lobby
    </a>

    {#if isLoading}
      <div class="flex min-h-[70vh] items-center justify-center text-slate-500">
        <LoaderCircle class="animate-spin" size={28} />
      </div>
    {:else if error}
      <div class="mt-8 rounded-lg border border-red-200 bg-white p-6 shadow-sm sm:p-8">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">Fehler</p>
        <h1 class="mt-3 text-3xl font-semibold text-slate-950">Spiel nicht erreichbar</h1>
        <p class="mt-2 text-sm leading-6 text-slate-600">{error}</p>
      </div>
    {:else if party && !activeGame}
      <div class="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Kein Spiel</p>
        <h1 class="mt-3 text-3xl font-semibold text-slate-950">Es laeuft gerade kein Spiel.</h1>
        <p class="mt-2 text-sm leading-6 text-slate-600">Zurueck in die Lobby, damit der Host ein Spiel starten kann.</p>
        <a href={`/party/${code}`} class="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200">Zur Lobby</a>
      </div>
    {:else if party && activeGame}
      <div class="mt-4 grid gap-4 {activeGame.gameId === 'skyjo' ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_20rem]'}">
        <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">{party.code}</p>
              <h1 class="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">{activeGame.name}</h1>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                {#if activeGame.state.winnerId}
                  {winnerPlayer?.name} hat gewonnen.
                {:else if activeGame.state.isDraw}
                  Das Spiel endet unentschieden.
                {:else if isMyTurn}
                  Du bist am Zug.
                {:else if currentTurnPlayer}
                  {currentTurnPlayer.name} ist am Zug.
                {:else if activeGame.gameId === 'skyjo'}
                  Jeder Spieler deckt zwei Startkarten auf.
                {/if}
              </p>
            </div>

            <img
              src={activeGameImage}
              alt="Spielmotiv"
              class="{activeGame.gameId === 'skyjo' ? 'hidden' : 'hidden aspect-[10/7] h-28 w-40 shrink-0 rounded-lg border border-slate-200 object-cover object-center shadow-sm md:block'}"
            />

            {#if isCurrentHost && activeGame.status !== 'finished'}
              <button type="button" on:click={restartActiveGame} disabled={isActionLoading} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:border-cyan-300 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60">
                <RotateCcw size={18} />
                Neu starten
              </button>
            {/if}
          </div>

          {#if gameError}
            <p class="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{gameError}</p>
          {/if}

          {#if activeGame.gameId === 'skyjo'}
            <div class="mt-3">
              {#key skyjoVersion}
                <SkyjoBoard game={/** @type {any} */ (activeGame)} currentPlayerId={playerId} isLoading={isActionLoading} onMove={sendSkyjoMove} />
              {/key}
            </div>
          {:else if activeGame.status === 'finished'}
            <div class="mt-8">
              <GameEndScreen
                title={activeGame.name}
                currentPlayerId={playerId}
                players={gameScorePlayers}
                winnerId={activeGame.state.winnerId}
                isDraw={activeGame.state.isDraw}
                isHost={isCurrentHost}
                requests={activeGame.requests}
                roundScores={activeGame.state.roundScores ?? []}
                isLoading={isActionLoading}
                onRequestRematch={requestRematch}
                onRequestNewGame={requestNewGame}
                onStartRematch={restartActiveGame}
                onChooseNewGame={chooseNewGame}
              />
            </div>
          {:else}
            <div class="mt-8 flex justify-center">
              <div class="w-full max-w-[31rem] rounded-xl border border-slate-200 bg-slate-100 p-2 shadow-inner sm:p-4">
                <div class="grid aspect-square grid-cols-3 gap-2 sm:gap-3">
                  {#key boardVersion}
                    {#each ticTacToeBoard as cell, cellIndex}
                      <button
                        type="button"
                        on:click={() => makeMove(cellIndex)}
                        disabled={!canUseCell(cellIndex)}
                        class="group flex aspect-square items-center justify-center rounded-xl border bg-white shadow-sm transition duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-100 {isWinningCell(cellIndex) ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100' : 'border-slate-200'} {canUseCell(cellIndex) ? 'hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md active:scale-[0.98]' : 'disabled:cursor-default'}"
                        aria-label={`Feld ${cellIndex + 1}`}
                      >
                        {#if cell === 'X' || cell === 'O'}
                          <img
                            src={markImage(cellIndex, cell)}
                            alt={cell === 'X' ? 'Kreuz' : 'Kreis'}
                            class="h-[72%] w-[72%] animate-ttt-mark-in object-contain drop-shadow-sm"
                            style={markStyle(cellIndex, cell)}
                          />
                        {:else}
                          <span class="h-14 w-14 rounded-xl border border-dashed border-slate-200 opacity-0 transition group-hover:opacity-100"></span>
                        {/if}
                      </button>
                    {/each}
                  {/key}
                </div>
              </div>
            </div>
          {/if}
        </div>

        {#if activeGame.gameId === 'skyjo' && activeGame.status === 'finished'}
          <div class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-8">
            <div class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl shadow-2xl animate-modal-in">
              <GameEndScreen
                title={activeGame.name}
                currentPlayerId={playerId}
                players={gameScorePlayers}
                winnerId={activeGame.state.winnerId}
                isDraw={activeGame.state.isDraw}
                isHost={isCurrentHost}
                requests={activeGame.requests}
                roundScores={activeGame.state.roundScores ?? []}
                isLoading={isActionLoading}
                onRequestRematch={requestRematch}
                onRequestNewGame={requestNewGame}
                onStartRematch={restartActiveGame}
                onChooseNewGame={chooseNewGame}
              />
            </div>
          </div>
        {/if}

        <aside class="space-y-4 {activeGame.gameId === 'skyjo' ? 'hidden' : ''}">
          <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-lg font-semibold text-slate-950">Status</h2>
            <div class="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              {#if activeGame.state.winnerId}
                <p class="flex items-center gap-2 text-sm font-medium text-slate-600"><Trophy size={17} /> Gewinner</p>
                <p class="mt-1 text-xl font-semibold text-emerald-700">{winnerPlayer?.name}</p>
              {:else if activeGame.state.isDraw}
                <p class="text-sm font-medium text-slate-600">Ergebnis</p>
                <p class="mt-1 text-xl font-semibold text-slate-950">Unentschieden</p>
              {:else if currentTurnPlayer}
                <p class="text-sm font-medium text-slate-600">Am Zug</p>
                <p class="mt-1 text-xl font-semibold text-slate-950">{currentTurnPlayer.name}</p>
              {:else}
                <p class="text-sm font-medium text-slate-600">Setup</p>
                <p class="mt-1 text-xl font-semibold text-slate-950">Startkarten</p>
              {/if}
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-lg font-semibold text-slate-950">Spieler</h2>
            <div class="mt-4 space-y-3">
              {#each activeGame.players as gamePlayer (gamePlayer.id)}
                <div class="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <div class="min-w-0">
                    <p class="truncate font-semibold text-slate-950">{gamePlayer.name}</p>
                    <p class="text-xs text-slate-500">{gamePlayer.id === playerId ? 'Du' : 'Spieler'}</p>
                  </div>
                  {#if gamePlayer.mark}
                    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white font-semibold ring-1 ring-slate-200 {markClass(gamePlayer.mark)}">{gamePlayer.mark}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          {#if !myGamePlayer}
            <p class="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">Du schaust diese Runde zu.</p>
          {/if}
        </aside>
      </div>
    {/if}
  </section>
</main>

