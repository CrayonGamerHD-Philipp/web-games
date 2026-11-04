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
  /** Party-Spieler ({ id, name, color, … }) für Avatare in Spielerfarbe. */
  /** @type {{ id: string, name?: string, color?: string }[]} */
  export let players = [];
  // Teil der gemeinsamen Spiel-API; die Spielerleiste mit Avataren zeigt die Shell.
  $: void players;

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
  // Eigene Person zuerst, dann der Gegner.
  $: seats = game ? [...game.players].sort((a, b) => Number(b.id === currentPlayerId) - Number(a.id === currentPlayerId)) : [];
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
    if (myTurn) {
      const mine = session.players.find((player) => player.id === session.state.currentPlayerId)?.mark;
      return `Tippe ein freies Feld für ${mine === 'O' ? 'deinen Kreis' : 'dein Kreuz'}.`;
    }
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
  <p class="ui-panel ui-muted">
    Tic Tac Toe wird über eine Party gestartet, damit zwei Spieler verbunden sind.
  </p>
{:else}
  <div class="ttt">
    <header class="g-status">
      <p class="g-status-text" aria-live="polite">{statusText}</p>
      {#if isMyTurn}
        <span class="ui-chip ui-chip--accent">Du bist dran</span>
      {/if}
    </header>

    <section class="ttt-table" aria-label="Spielfeld">
      <div class="ttt-board">
        {#each board as cell, cellIndex (cellIndex)}
          <button
            type="button"
            on:click={() => makeMove(cellIndex)}
            disabled={!canUseCell(cellIndex)}
            class="ttt-cell"
            class:is-open={canUseCell(cellIndex)}
            class:is-win={isWinningCell(cellIndex)}
            aria-label={`Feld ${cellIndex + 1}: ${cell === 'X' ? 'Kreuz' : cell === 'O' ? 'Kreis' : 'leer'}${isWinningCell(cellIndex) ? ', Gewinnreihe' : ''}`}
          >
            {#if cell === 'X' || cell === 'O'}
              {#key cell}
                <img
                  src={markImage(cellIndex, cell)}
                  alt=""
                  aria-hidden="true"
                  class="ttt-mark animate-ttt-mark-in"
                  style={markStyle(cellIndex, cell)}
                />
              {/key}
            {/if}
          </button>
        {/each}
      </div>
    </section>

    <ul class="ttt-marks" aria-label="Zeichen">
      {#each seats as player (player.id)}
        <li>
          <img src={markImage(0, player.mark)} alt="" aria-hidden="true" class="ttt-seat-mark" />
          <span class="ttt-mark-name">{player.id === currentPlayerId ? 'Du' : player.name}</span>
          <span class="sr-only">{player.mark === 'X' ? 'spielt Kreuz' : 'spielt Kreis'}</span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  /* Rahmen nach DESIGN.md – dieselben g-* Regeln wie in Skyjo und Schiffe versenken. */
  .ttt {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    width: 100%;
    max-width: 30rem;
    margin: 12px auto 0;
    color: var(--text);
  }

  .g-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
  }

  .g-status-text {
    margin: 0;
    min-width: 0;
    font-size: 1rem;
    line-height: 1.35;
    font-weight: 600;
    color: var(--text);
    text-wrap: balance;
  }

  .g-status :global(.ui-chip) {
    flex-shrink: 0;
  }

  /* ---------- Tisch ---------- */
  .ttt-table {
    background: var(--surface);
    border-radius: var(--radius-card);
    padding: 12px;
  }

  .ttt-board {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    /* Brett bleibt auf kurzen Handys ganz sichtbar. */
    width: min(100%, calc(100dvh - 19rem));
    min-width: min(100%, 15rem);
    margin: 0 auto;
    aspect-ratio: 1;
  }

  .ttt-cell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    border-radius: var(--radius-inner);
    background: var(--raised);
    box-shadow: inset 0 0 0 1px var(--border);
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: background-color 150ms ease, box-shadow 150ms ease, transform 120ms ease;
  }

  .ttt-cell.is-open {
    cursor: pointer;
  }

  .ttt-cell.is-open:active {
    transform: scale(0.97);
  }

  .ttt-cell:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: 2px;
  }

  .ttt-cell.is-win {
    background: color-mix(in srgb, var(--positive) 14%, var(--raised));
    box-shadow: inset 0 0 0 2px var(--positive);
  }

  .ttt-mark {
    width: 72%;
    height: 72%;
    object-fit: contain;
    pointer-events: none;
  }

  /* ---------- Wer spielt welches Zeichen (Spielerleiste steht in der Shell) ---------- */
  .ttt-marks {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 20px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.875rem;
    color: var(--muted);
  }

  .ttt-marks li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .ttt-mark-name {
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ttt-seat-mark {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  @media (hover: hover) and (pointer: fine) {
    .ttt-cell.is-open:hover {
      background: var(--surface-2);
    }
  }

  @media (min-width: 640px) {
    .ttt { gap: 16px; margin-top: 16px; }
    .g-status-text { font-size: 1.0625rem; }
    .ttt-table { padding: 20px; }
    .ttt-board { gap: 12px; }
  }

  @media (min-width: 1024px) {
    .ttt { max-width: 34rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ttt-cell { transition: none; }
  }
</style>
