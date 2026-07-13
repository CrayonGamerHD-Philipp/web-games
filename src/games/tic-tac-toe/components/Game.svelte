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
  $: boardVersion = game ? `${game.id}:${board.join('|')}:${game.state.currentPlayerId}:${game.status}` : '';
  $: if (game?.status === 'finished' && game.id !== lastFinishedGameId) {
    lastFinishedGameId = game.id;
    playSound(game.state.isDraw ? 'draw' : game.state.winnerId === currentPlayerId ? 'win' : 'lose');
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
  <div class="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
    Tic Tac Toe wird ueber eine Party gestartet, damit zwei Spieler verbunden sind.
  </div>
{:else}
  <div class="mt-8 flex justify-center">
    <div class="w-full max-w-[31rem] rounded-xl border border-slate-200 bg-slate-100 p-2 shadow-inner sm:p-4">
      <div class="grid aspect-square grid-cols-3 gap-2 sm:gap-3">
        {#key boardVersion}
          {#each board as cell, cellIndex}
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





