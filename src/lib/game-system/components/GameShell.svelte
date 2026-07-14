<script>
  import { ArrowLeft, LoaderCircle, RotateCcw, SquareX, Trophy } from '@lucide/svelte';
  import { getGameDefinition } from '../../../games/registry';
  import GameResultScreen from './GameResultScreen.svelte';

  /** @typedef {{ id: string, name: string, score: number, isHost?: boolean, color?: string }} Player */
  /** @typedef {{ id: string, value: number | null, revealed: boolean, removed: boolean }} SkyjoSlot */
  /** @typedef {{ id: string, name: string, mark?: string, grid?: SkyjoSlot[] }} GamePlayer */
  /** @typedef {import('../types').GameResult} GameResult */
  /** @typedef {{ winnerId?: string | null, isDraw?: boolean, currentPlayerId?: string | null, roundScores?: { playerId: string, score: number }[], match?: { enabled?: boolean, targetScore?: number, round?: number, totalScores?: { playerId: string, score: number }[], lastRoundScores?: { playerId: string, score: number }[], matchFinished?: boolean, winnerIds?: string[] } }} ActiveGameState */
  /** @typedef {{ id: string, gameId: string, name: string, status: string, players: GamePlayer[], state: ActiveGameState, requests: { rematch: string[], newGame: string[] } }} ActiveGame */

  /** @type {string} */
  export let code = '';
  /** @type {Player[]} */
  export let partyPlayers = [];
  /** @type {ActiveGame | null} */
  export let activeGame = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isHost = false;
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {boolean} */
  export let isActionLoading = false;
  /** @type {string} */
  export let error = '';
  /** @type {string} */
  export let gameError = '';
  /** @type {number} */
  export let renderNonce = 0;
  /** @type {string} */
  export let lobbyHref = '/';
  /** @type {(move: Record<string, unknown>) => void} */
  export let onMove = () => {};
  /** @type {() => void} */
  export let onRestart = () => {};
  /** @type {() => void} */
  export let onRequestRematch = () => {};
  /** @type {() => void} */
  export let onRequestNewGame = () => {};
  /** @type {() => void} */
  export let onChooseNewGame = () => {};

  $: definition = getGameDefinition(activeGame?.gameId);
  $: GameComponent = definition?.component;
  $: myGamePlayer = activeGame?.players.find((player) => player.id === currentPlayerId);
  $: currentTurnPlayer = activeGame?.players.find((player) => player.id === activeGame.state.currentPlayerId);
  $: winnerPlayer = activeGame?.players.find((player) => player.id === activeGame.state.winnerId);
  $: isMyTurn = Boolean(activeGame && myGamePlayer && activeGame.state.currentPlayerId === currentPlayerId && activeGame.status === 'running');
  $: isSkyjo = activeGame?.gameId === 'skyjo';
  $: isNochMal = activeGame?.gameId === 'noch-mal';
  $: isTicTacToe = activeGame?.gameId === 'tic-tac-toe';
  $: identityPlayers = activeGame
    ? activeGame.players.map((gamePlayer) => ({
        ...gamePlayer,
        color: partyPlayers.find((player) => player.id === gamePlayer.id)?.color ?? 'slate'
      }))
    : [];
  $: gameScorePlayers = activeGame
    ? activeGame.players.map((gamePlayer) => {
        const partyPlayer = partyPlayers.find((player) => player.id === gamePlayer.id);
        return {
          id: gamePlayer.id,
          name: gamePlayer.name,
          score: partyPlayer?.score ?? 0,
          isHost: partyPlayer?.isHost ?? false
        };
      })
    : [];
  $: result = createResult(activeGame, currentPlayerId, winnerPlayer?.name);

  /**
   * @param {ActiveGame | null} game
   * @param {string} playerId
   * @param {string | undefined} winnerName
   * @returns {GameResult}
   */
  function createResult(game, playerId, winnerName) {
    const status = /** @type {'won' | 'lost' | 'draw' | 'cancelled'} */ (
      game?.state.isDraw ? 'draw' : game?.state.winnerId === playerId ? 'won' : game?.state.winnerId ? 'lost' : 'cancelled'
    );

    const match = game?.state.match;
    const skyjoBoards = game?.gameId === 'skyjo'
      ? game.players.map((gamePlayer) => ({
          playerId: gamePlayer.id,
          playerName: gamePlayer.name,
          cards: gamePlayer.grid ?? []
        }))
      : [];
    const matchLeaderNames = match?.winnerIds?.length
      ? match.winnerIds
          .map((winnerId) => game?.players.find((player) => player.id === winnerId)?.name)
          .filter(Boolean)
          .join(', ')
      : winnerName;

    return {
      status,
      winnerId: game?.state.winnerId ?? undefined,
      winnerName: matchLeaderNames || winnerName,
      title: match?.enabled && !match.matchFinished ? `Skyjo Runde ${match.round} beendet` : game?.name ?? 'Spiel beendet',
      message: match?.enabled
        ? match.matchFinished
          ? `${matchLeaderNames} gewinnt das Match mit dem niedrigsten Gesamtstand.`
          : `Zwischenstand nach Runde ${match.round ?? 1}. Der Host kann die naechste Runde starten.`
        : game?.state.isDraw
          ? 'Das Spiel endet unentschieden. Der Host entscheidet, wie es weitergeht.'
          : winnerName
            ? `${winnerName} hat gewonnen. Danach kann eine Revanche oder ein neues Spiel angefragt werden.`
            : 'Die Runde wurde beendet.',
      metadata: match?.enabled || skyjoBoards.length ? { skyjoMatch: match, skyjoBoards } : undefined
    };
  }

  /** @param {string | null | undefined} mark */
  function markClass(mark) {
    if (mark === 'X') return 'text-cyan-700';
    if (mark === 'O') return 'text-emerald-700';
    return 'text-slate-300';
  }

  /** @param {string | undefined} color */
  function playerColor(color) {
    /** @type {Record<string, string>} */
    const colors = {
      cyan: '#0891b2', violet: '#7c3aed', rose: '#e11d48', emerald: '#059669',
      orange: '#ea580c', blue: '#2563eb', amber: '#d97706', lime: '#65a30d',
      teal: '#0d9488', sky: '#0284c7', fuchsia: '#c026d3', red: '#dc2626'
    };
    return colors[color ?? ''] ?? '#64748b';
  }
</script>

<a href={lobbyHref} class="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
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
{:else if !activeGame}
  <div class="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <p class="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Kein Spiel</p>
    <h1 class="mt-3 text-3xl font-semibold text-slate-950">Es laeuft gerade kein Spiel.</h1>
    <p class="mt-2 text-sm leading-6 text-slate-600">Zurueck in die Lobby, damit der Host ein Spiel starten kann.</p>
    <a href={lobbyHref} class="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200">Zur Lobby</a>
  </div>
{:else if !definition || !GameComponent}
  <div class="mt-8 rounded-lg border border-red-200 bg-white p-6 shadow-sm sm:p-8">
    <p class="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">Unbekanntes Spiel</p>
    <h1 class="mt-3 text-3xl font-semibold text-slate-950">Dieses Spiel ist nicht registriert.</h1>
    <p class="mt-2 text-sm leading-6 text-slate-600">Die Spiel-ID <span class="font-semibold">{activeGame.gameId}</span> existiert in der zentralen Registry nicht.</p>
  </div>
{:else}
  <div class="mt-4 grid gap-4 {isSkyjo || isNochMal || isTicTacToe ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_20rem]'}">
    <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">{code}</p>
          <h1 class="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">{definition.name}</h1>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            {#if activeGame.state.winnerId}
              {winnerPlayer?.name} hat gewonnen.
            {:else if activeGame.state.isDraw}
              Das Spiel endet unentschieden.
            {:else if isMyTurn}
              Du bist am Zug.
            {:else if currentTurnPlayer}
              {currentTurnPlayer.name} ist am Zug.
            {:else if isSkyjo}
              Jeder Spieler deckt zwei Startkarten auf.
            {:else}
              Das Spiel laeuft.
            {/if}
          </p>
        </div>

        {#if definition.previewImage && !isSkyjo && !isNochMal}
          <img src={definition.previewImage} alt="Spielmotiv" class="hidden aspect-[10/7] h-28 w-40 shrink-0 rounded-lg border border-slate-200 object-cover object-center shadow-sm md:block" />
        {/if}

        {#if isHost && activeGame.status !== 'finished'}
          <div class="flex flex-col gap-2 sm:flex-row">
            <button type="button" on:click={onRestart} disabled={isActionLoading} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:border-cyan-300 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60">
              <RotateCcw size={18} />
              Neu starten
            </button>
            <button type="button" on:click={onChooseNewGame} disabled={isActionLoading} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60">
              <SquareX size={18} />
              Spiel abbrechen
            </button>
          </div>
        {/if}
      </div>

      {#if gameError}
        <p class="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{gameError}</p>
      {/if}

      <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
        <div class="flex flex-wrap gap-2" aria-label="Spielerfarben">
          {#each identityPlayers as player (player.id)}
            <div class="flex min-h-9 items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 shadow-sm {activeGame.state.currentPlayerId === player.id ? 'border-cyan-300 ring-2 ring-cyan-100' : 'border-slate-200'}">
              <span class="h-5 w-5 shrink-0 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200" style={`background: ${playerColor(player.color)}`}></span>
              <span class="max-w-32 truncate text-xs font-semibold text-slate-800">{player.name}</span>
              {#if player.id === currentPlayerId}<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-slate-500">Du</span>{/if}
              {#if activeGame.state.currentPlayerId === player.id && activeGame.status === 'running'}<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" title="Am Zug"></span>{/if}
            </div>
          {/each}
        </div>
      </div>

      {#if activeGame.status === 'finished' && !isSkyjo}
        <div class="mt-8">
          <GameResultScreen
            {result}
            {currentPlayerId}
            players={gameScorePlayers}
            {isHost}
            requests={activeGame.requests}
            roundScores={activeGame.state.roundScores ?? []}
            isLoading={isActionLoading}
            onPlayAgain={onRestart}
            onBackToGames={onChooseNewGame}
            {onRequestRematch}
            {onRequestNewGame}
          />
        </div>
      {:else}
        <svelte:component this={GameComponent} game={activeGame} {currentPlayerId} isLoading={isActionLoading} onMove={onMove} {renderNonce} />
      {/if}
    </div>

    {#if isSkyjo && activeGame.status === 'finished'}
      <div class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-8">
        <div class="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl shadow-2xl animate-modal-in">
          <GameResultScreen
            {result}
            {currentPlayerId}
            players={gameScorePlayers}
            {isHost}
            requests={activeGame.requests}
            roundScores={activeGame.state.roundScores ?? []}
            isLoading={isActionLoading}
            onPlayAgain={onRestart}
            onBackToGames={onChooseNewGame}
            {onRequestRematch}
            {onRequestNewGame}
          />
        </div>
      </div>
    {/if}

    <aside class="space-y-4 {isSkyjo || isNochMal || isTicTacToe ? 'hidden' : ''}">
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
                <p class="text-xs text-slate-500">{gamePlayer.id === currentPlayerId ? 'Du' : 'Spieler'}</p>
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


