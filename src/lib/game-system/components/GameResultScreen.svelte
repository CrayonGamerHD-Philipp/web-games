<script>
  import { Gamepad2, RotateCcw, Trophy } from '@lucide/svelte';

  /** @typedef {{ id: string, name: string, score?: number, isHost?: boolean }} ScorePlayer */
  /** @typedef {{ status: 'won' | 'lost' | 'draw' | 'cancelled', winnerId?: string, winnerName?: string, title?: string, message?: string, score?: number, metadata?: Record<string, unknown> }} GameResult */
  /** @typedef {{ rematch: string[], newGame: string[] }} EndRequests */
  /** @typedef {{ playerId: string, score: number }} RoundScore */
  /** @typedef {{ enabled?: boolean, targetScore?: number, round?: number, totalScores?: RoundScore[], lastRoundScores?: RoundScore[], matchFinished?: boolean, winnerIds?: string[] }} SkyjoMatch */

  /** @type {GameResult} */
  export let result = { status: 'cancelled', title: 'Spiel beendet' };
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {ScorePlayer[]} */
  export let players = [];
  /** @type {boolean} */
  export let isHost = false;
  /** @type {EndRequests} */
  export let requests = { rematch: [], newGame: [] };
  /** @type {RoundScore[]} */
  export let roundScores = [];
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {() => void} */
  export let onPlayAgain = () => {};
  /** @type {() => void} */
  export let onBackToGames = () => {};
  /** @type {() => void} */
  export let onRequestRematch = () => {};
  /** @type {() => void} */
  export let onRequestNewGame = () => {};

  /**
   * @param {Record<string, unknown> | undefined} metadata
   * @returns {SkyjoMatch | null}
   */
  function getSkyjoMatch(metadata) {
    const value = metadata?.skyjoMatch;
    if (!value || typeof value !== 'object') return null;
    return /** @type {SkyjoMatch} */ (value);
  }

  $: winner = players.find((player) => player.id === result.winnerId);
  $: currentPlayerWon = result.winnerId === currentPlayerId;
  $: currentPlayerLost = Boolean(result.winnerId && result.winnerId !== currentPlayerId);
  $: isDraw = result.status === 'draw';
  $: alreadyRequestedRematch = requests.rematch.includes(currentPlayerId);
  $: alreadyRequestedNewGame = requests.newGame.includes(currentPlayerId);
  $: endDecorImage = isDraw ? '/images/decor/lobby.png' : currentPlayerWon ? '/images/decor/winner.png' : currentPlayerLost ? '/images/decor/loser.png' : winner ? '/images/decor/winner.png' : '/images/decor/lobby.png';
  $: endDecorLabel = isDraw ? 'Unentschieden' : currentPlayerWon ? 'Gewonnen' : currentPlayerLost ? 'Verloren' : 'Spiel beendet';
  $: sortedPlayers = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name));
  $: scoreRows = roundScores.length
    ? [...roundScores]
        .map((roundScore) => ({
          ...roundScore,
          player: players.find((player) => player.id === roundScore.playerId)
        }))
        .sort((a, b) => a.score - b.score)
    : [];
  $: skyjoMatch = getSkyjoMatch(result.metadata);
  $: skyjoRows = skyjoMatch?.totalScores
    ? [...skyjoMatch.totalScores]
        .map((totalScore) => ({
          playerId: totalScore.playerId,
          total: totalScore.score,
          lastRound: skyjoMatch.lastRoundScores?.find((roundScore) => roundScore.playerId === totalScore.playerId)?.score ?? 0,
          player: players.find((player) => player.id === totalScore.playerId)
        }))
        .sort((a, b) => a.total - b.total || a.lastRound - b.lastRound || (a.player?.name ?? '').localeCompare(b.player?.name ?? ''))
    : [];
</script>

<div class="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-ui-pop-in sm:p-8">
  <span class="pointer-events-none absolute right-8 top-8 h-2 w-2 rounded-full bg-cyan-300 animate-decor-spark"></span>
  <span class="pointer-events-none absolute right-20 top-20 h-2.5 w-2.5 rounded-full bg-amber-300 animate-decor-spark [animation-delay:320ms]"></span>
  <span class="pointer-events-none absolute right-32 top-10 h-1.5 w-1.5 rounded-full bg-emerald-300 animate-decor-spark [animation-delay:640ms]"></span>

  <div class="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{result.title ?? 'Spiel beendet'}</p>
      <h2 class="mt-3 text-3xl font-semibold text-slate-950">
        {#if isDraw}
          Unentschieden
        {:else if winner}
          {winner.name} gewinnt
        {:else}
          Runde beendet
        {/if}
      </h2>
      <p class="mt-3 max-w-xl text-base leading-7 text-slate-600">
        {result.message ?? (isDraw ? 'Niemand bekommt einen Siegpunkt.' : winner ? `${winner.name} bekommt einen Siegpunkt.` : 'Das Spiel wurde beendet.')}
      </p>
    </div>

    <div class="relative mx-auto h-28 w-28 shrink-0 sm:h-32 sm:w-32 lg:mx-0">
      <img src={endDecorImage} alt={endDecorLabel} class="h-full w-full animate-decor-pop object-contain" />
    </div>

    {#if winner}
      <div class="flex min-w-40 items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
        <Trophy size={22} />
        <div>
          <p class="text-xs font-medium uppercase tracking-[0.16em]">Gewinner</p>
          <p class="font-semibold">{winner.name}</p>
        </div>
      </div>
    {/if}
  </div>

  {#if skyjoRows.length}
  <div class="relative z-10 mt-7 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-800">Skyjo Gesamtstand</h3>
        <p class="mt-1 text-sm text-cyan-900">
          Ziel: {skyjoMatch?.targetScore ?? 100} Punkte. Niedrigster Gesamtstand gewinnt, sobald mindestens ein Spieler das Ziel erreicht.
        </p>
      </div>
      <span class="rounded-md bg-white px-3 py-1 text-sm font-semibold text-cyan-900 ring-1 ring-cyan-200">
        {skyjoMatch?.matchFinished ? 'Match beendet' : 'Naechste Runde'}
      </span>
    </div>

    <div class="mt-4 overflow-hidden rounded-md border border-cyan-200 bg-white">
      <div class="grid grid-cols-[3rem_minmax(0,1fr)_5rem_5rem] bg-cyan-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-950">
        <span>Rang</span>
        <span>Spieler</span>
        <span class="text-right">Runde</span>
        <span class="text-right">Total</span>
      </div>
      {#each skyjoRows as row, index (row.playerId)}
        <div class="grid grid-cols-[3rem_minmax(0,1fr)_5rem_5rem] items-center border-t border-cyan-100 px-3 py-2 text-sm">
          <span class="font-semibold text-cyan-900">{index + 1}</span>
          <span class="truncate font-semibold text-slate-950">{row.player?.name ?? 'Spieler'}</span>
          <span class="text-right text-slate-600">{row.lastRound}</span>
          <span class="text-right font-bold text-slate-950">{row.total}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}
<div class="relative z-10 mt-7 grid gap-6 lg:grid-cols-[1fr_1fr]">
    <div>
      {#if scoreRows.length}
        <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Rundenpunkte</h3>
        <div class="mt-3 space-y-2">
          {#each scoreRows as row, index (row.playerId)}
            <div class="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-950">{index + 1}. {row.player?.name ?? 'Spieler'}</p>
                <p class="text-xs text-slate-500">{row.playerId === currentPlayerId ? 'Du' : 'Runde'}</p>
              </div>
              <span class="rounded-md bg-white px-3 py-1 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">{row.score}</span>
            </div>
          {/each}
        </div>
        <h3 class="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Gesamtsiege</h3>
      {:else}
        <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Punkte</h3>
      {/if}

      <div class="mt-3 space-y-2">
        {#each sortedPlayers as player, index (player.id)}
          <div class="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-950">{index + 1}. {player.name}</p>
              <p class="text-xs text-slate-500">{player.id === currentPlayerId ? 'Du' : player.isHost ? 'Host' : 'Spieler'}</p>
            </div>
            <span class="rounded-md bg-white px-3 py-1 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">{player.score ?? 0}</span>
          </div>
        {/each}
      </div>
    </div>

    <div>
      <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Aktionen</h3>
      <div class="mt-3 space-y-2 text-sm text-slate-600">
        <p class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">Revanche: <span class="font-semibold text-slate-950">{requests.rematch.length}</span></p>
        <p class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">Neues Spiel: <span class="font-semibold text-slate-950">{requests.newGame.length}</span></p>
      </div>

      <div class="mt-5 flex flex-col gap-3">
        {#if currentPlayerLost || isDraw}
          <button type="button" on:click={onRequestRematch} disabled={isLoading || alreadyRequestedRematch} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:border-cyan-300 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60">
            <RotateCcw size={18} />
            {alreadyRequestedRematch ? 'Revanche angefragt' : 'Revanche fordern'}
          </button>
        {/if}

        {#if currentPlayerWon || isDraw}
          <button type="button" on:click={onRequestNewGame} disabled={isLoading || alreadyRequestedNewGame} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:border-emerald-300 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">
            <Gamepad2 size={18} />
            {alreadyRequestedNewGame ? 'Neues Spiel angefragt' : 'Neues Spiel anfordern'}
          </button>
        {/if}
      </div>
    </div>
  </div>

  {#if isHost}
    <div class="relative z-10 mt-7 rounded-md border border-cyan-200 bg-cyan-50 p-4">
      <p class="text-sm font-semibold text-cyan-950">Host-Entscheidung</p>
      <div class="mt-3 flex flex-col gap-3 sm:flex-row">
        <button type="button" on:click={onPlayAgain} disabled={isLoading} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-cyan-300">
          <RotateCcw size={18} />
          {skyjoMatch?.enabled && !skyjoMatch?.matchFinished ? 'Naechste Runde starten' : 'Erneut spielen'}
        </button>
        <button type="button" on:click={onBackToGames} disabled={isLoading} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-emerald-300">
          <Gamepad2 size={18} />
          Zur Spielauswahl
        </button>
      </div>
    </div>
  {/if}
</div>

