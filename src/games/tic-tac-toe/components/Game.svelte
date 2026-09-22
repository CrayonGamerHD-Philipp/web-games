<script>
  /** @typedef {import('../types').TicTacToeSession} TicTacToeSession */
  /** @typedef {import('../types').TicTacToeMove} TicTacToeMove */

  /** @type {TicTacToeSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: TicTacToeMove) => void} */
  export let onMove = () => {};

  let lastFinishedGameId = '';

  const soundSources = {
    mark: '/sounds/select1.mp3',
    win: '/sounds/win2.mp3',
    lose: '/sounds/lose1.mp3',
    draw: '/sounds/ping.mp3'
  };

  const audioCache = new Map();
  $: board = game?.state.board ?? [];
  $: myGamePlayer = game?.players.find((player) => player.id === currentPlayerId);
  $: isMyTurn = Boolean(game && myGamePlayer && game.state.currentPlayerId === currentPlayerId && game.status === 'running');
  $: currentTurnPlayer = game?.players.find((player) => player.id === game.state.currentPlayerId);
  $: statusText = getStatusText(game, isMyTurn, currentTurnPlayer);
  $: if (game?.status === 'finished' && game.id !== lastFinishedGameId) {
    lastFinishedGameId = game.id;
    playSound(game.state.isDraw ? 'draw' : game.state.winnerId === currentPlayerId ? 'win' : 'lose');
  }

  /**
   * @param {TicTacToeSession | null} session
   * @param {boolean} myTurn
   * @param {{ name: string } | undefined} turnPlayer
   */
  function getStatusText(session, myTurn, turnPlayer) {
    if (!session) return '';
    if (session.status === 'finished') {
      if (session.state.isDraw) return 'Unentschieden.';
      const winner = session.players.find((player) => player.id === session.state.winnerId);
      return winner ? `${winner.name} hat gewonnen.` : 'Die Partie ist beendet.';
    }
    if (myTurn) return 'Du bist am Zug.';
    return turnPlayer ? `${turnPlayer.name} ist am Zug.` : 'Das Spiel läuft.';
  }

  /** @param {keyof typeof soundSources} name */
  function getAudio(name) {
    if (typeof Audio === 'undefined') return null;

    const cached = audioCache.get(name);
    if (cached) return cached;

    const audio = new Audio(soundSources[name]);
    audio.preload = 'metadata';
    audioCache.set(name, audio);
    return audio;
  }

  function effectVolume() {
    if (typeof localStorage === 'undefined') return 0.85;
    const value = Number(localStorage.getItem('web-games:effects-volume') ?? '0.85');
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.85;
  }

  /** @param {keyof typeof soundSources} name */
  function playSound(name) {
    const audio = getAudio(name);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    audio.volume = effectVolume();
    void audio.play().catch(() => {});
  }

  /** @param {number} cellIndex */
  function makeMove(cellIndex) {
    if (!game || game.status !== 'running' || board[cellIndex]) return;
    if (!myGamePlayer || game.state.currentPlayerId !== currentPlayerId) return;
    playSound('mark');
    onMove({ cellIndex });
  }

  /** @param {number} cellIndex */
  function isWinningCell(cellIndex) {
    return Boolean(game?.state.winningLine?.includes(cellIndex));
  }

  /** @param {number} cellIndex */
  function canUseCell(cellIndex) {
    return Boolean(isMyTurn && game && !board[cellIndex] && !isLoading);
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
  function markImage(cellIndex, mark) {
    const variant = (cellIndex % 4) + 1;
    if (mark === 'X') return '/images/tictactoe/x-' + variant + '.png';
    if (mark === 'O') return '/images/tictactoe/o-' + variant + '.png';
    return '';
  }
</script>

{#if !game}
  <div class="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
    Tic Tac Toe wird ueber eine Party gestartet, damit zwei Spieler verbunden sind.
  </div>
{:else}
  <div class="relative mt-4 flex justify-center px-1 sm:mt-6 lg:mt-8">
    <img src="/images/tictactoe/x-2.png" alt="" aria-hidden="true" class="pointer-events-none absolute left-0 top-1/2 hidden h-36 w-36 -translate-x-1/4 -translate-y-1/2 -rotate-12 opacity-[0.05] lg:block xl:h-48 xl:w-48" />
    <img src="/images/tictactoe/o-2.png" alt="" aria-hidden="true" class="pointer-events-none absolute right-0 top-1/2 hidden h-36 w-36 translate-x-1/4 -translate-y-1/2 rotate-12 opacity-[0.05] lg:block xl:h-48 xl:w-48" />
    <div class="w-full max-w-[26rem] sm:max-w-[28rem] lg:max-w-[34rem] xl:max-w-[36rem]">
      <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 lg:p-8">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-4">
          <div class="min-w-0">
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Tic Tac Toe</p>
            <p class="mt-1 min-h-5 truncate text-sm font-medium text-slate-600">{statusText}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            {#each game.players as player (player.id)}
              {@const isTurn = game.status === 'running' && game.state.currentPlayerId === player.id}
              <span class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold {isTurn ? 'border-cyan-300 bg-cyan-50 text-cyan-800 ring-1 ring-cyan-100' : 'border-slate-200 bg-slate-50 text-slate-600'}">
                <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[0.65rem] font-black ring-1 ring-slate-200 {player.mark === 'X' ? 'text-cyan-700' : 'text-emerald-700'}">{player.mark}</span>
                <span class="max-w-24 truncate">{player.name}{player.id === currentPlayerId ? ' (Du)' : ''}</span>
              </span>
            {/each}
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-inner sm:p-3 lg:p-4">
          <div class="grid aspect-square grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            {#each board as cell, cellIndex (cellIndex)}
              <button
                type="button"
                on:click={() => makeMove(cellIndex)}
                disabled={!canUseCell(cellIndex)}
                class="group relative flex aspect-square touch-manipulation select-none items-center justify-center rounded-xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_20px_-14px_rgba(15,23,42,0.35)] transition duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-100 {isWinningCell(cellIndex) ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100' : 'border-slate-200'} {canUseCell(cellIndex) ? 'hover:-translate-y-1 hover:border-cyan-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_18px_30px_-16px_rgba(8,145,178,0.35)] active:translate-y-0 active:scale-[0.97]' : 'disabled:cursor-default disabled:opacity-90'}"
                aria-label={`Feld ${cellIndex + 1}`}
              >
                {#if cell === 'X' || cell === 'O'}
                  {#key cell}
                    <img
                      src={markImage(cellIndex, cell)}
                      alt={cell === 'X' ? 'Kreuz' : 'Kreis'}
                      class="h-[72%] w-[72%] animate-ttt-mark-in object-contain drop-shadow-sm"
                      style={markStyle(cellIndex, cell)}
                    />
                  {/key}
                {:else}
                  <span class="h-10 w-10 rounded-xl border border-dashed border-slate-200 opacity-0 transition group-hover:opacity-100 sm:h-12 sm:w-12 lg:h-16 lg:w-16"></span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}





