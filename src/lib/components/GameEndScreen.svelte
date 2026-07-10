<script>
  import { Gamepad2, RotateCcw, Trophy } from '@lucide/svelte';

  /** @typedef {{ id: string, name: string, score: number, isHost?: boolean }} ScorePlayer */
  /** @typedef {{ rematch: string[], newGame: string[] }} EndRequests */
  /** @typedef {{ playerId: string, score: number }} RoundScore */

  /** @type {string} */
  export let title = 'Spiel beendet';
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {ScorePlayer[]} */
  export let players = [];
  /** @type {string | null} */
  export let winnerId = null;
  /** @type {boolean} */
  export let isDraw = false;
  /** @type {boolean} */
  export let isHost = false;
  /** @type {EndRequests} */
  export let requests = { rematch: [], newGame: [] };
  /** @type {RoundScore[]} */
  export let roundScores = [];
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {() => void} */
  export let onRequestRematch = () => {};
  /** @type {() => void} */
  export let onRequestNewGame = () => {};
  /** @type {() => void} */
  export let onStartRematch = () => {};
  /** @type {() => void} */
  export let onChooseNewGame = () => {};

  $: winner = players.find((player) => player.id === winnerId);
  $: loser = winnerId ? players.find((player) => player.id !== winnerId) : null;
  $: currentPlayerWon = winnerId === currentPlayerId;
  $: currentPlayerLost = Boolean(winnerId && loser?.id === currentPlayerId);
  $: alreadyRequestedRematch = requests.rematch.includes(currentPlayerId);
  $: alreadyRequestedNewGame = requests.newGame.includes(currentPlayerId);
  $: sortedPlayers = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  $: scoreRows = roundScores.length
    ? [...roundScores]
        .map((roundScore) => ({
          ...roundScore,
          player: players.find((player) => player.id === roundScore.playerId)
        }))
        .sort((a, b) => a.score - b.score)
    : [];
</script>

<div class="animate-ui-pop-in rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
  <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{title}</p>
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
        {#if isDraw}
          Niemand bekommt einen Siegpunkt. Der Host entscheidet, wie es weitergeht.
        {:else if winner}
          {winner.name} bekommt einen Siegpunkt. Danach kann eine Revanche oder ein neues Spiel angefragt werden.
        {/if}
      </p>
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

  <div class="mt-7 grid gap-6 lg:grid-cols-[1fr_1fr]">
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
              <span class="rounded-md bg-white px-3 py-1 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
                {row.score}
              </span>
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
            <span class="rounded-md bg-white px-3 py-1 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
              {player.score}
            </span>
          </div>
        {/each}
      </div>
    </div>

    <div>
      <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Wuensche</h3>
      <div class="mt-3 space-y-2 text-sm text-slate-600">
        <p class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          Revanche: <span class="font-semibold text-slate-950">{requests.rematch.length}</span>
        </p>
        <p class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          Neues Spiel: <span class="font-semibold text-slate-950">{requests.newGame.length}</span>
        </p>
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
    <div class="mt-7 rounded-md border border-cyan-200 bg-cyan-50 p-4">
      <p class="text-sm font-semibold text-cyan-950">Host-Entscheidung</p>
      <div class="mt-3 flex flex-col gap-3 sm:flex-row">
        <button type="button" on:click={onStartRematch} disabled={isLoading} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-cyan-300">
          <RotateCcw size={18} />
          Revanche starten
        </button>
        <button type="button" on:click={onChooseNewGame} disabled={isLoading} class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-emerald-300">
          <Gamepad2 size={18} />
          Zur Spielauswahl
        </button>
      </div>
    </div>
  {/if}
</div>