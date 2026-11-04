<script>
  import { LoaderCircle } from '@lucide/svelte';
  import PlayingCard from '../../components/PlayingCard.svelte';
  import { initials, playerHex } from '../../player-colors.js';

  /** @typedef {{ id: string, name: string, score?: number, isHost?: boolean, color?: string }} ScorePlayer */
  /** @typedef {{ status: 'won' | 'lost' | 'draw' | 'cancelled', winnerId?: string, winnerName?: string, title?: string, message?: string, score?: number, metadata?: Record<string, unknown> }} GameResult */
  /** @typedef {{ rematch: string[], newGame: string[] }} EndRequests */
  /** @typedef {{ playerId: string, score: number }} RoundScore */
  /** @typedef {{ id: string, value: number | null, revealed: boolean, removed: boolean }} SkyjoCardSlot */
  /** @typedef {{ playerId: string, playerName: string, cards: SkyjoCardSlot[] }} SkyjoBoard */
  /** @typedef {{ round: number, scores: RoundScore[] }} SkyjoRoundHistoryEntry */
  /** @typedef {{ enabled?: boolean, targetScore?: number, round?: number, totalScores?: RoundScore[], lastRoundScores?: RoundScore[], roundHistory?: SkyjoRoundHistoryEntry[], matchFinished?: boolean, winnerIds?: string[] }} SkyjoMatch */

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
  /** Überschriftsebene: h1 auf der Seite, h2 im Skyjo-Modal. @type {'h1' | 'h2'} */
  export let headingLevel = 'h1';

  /**
   * @param {Record<string, unknown> | undefined} metadata
   * @returns {SkyjoMatch | null}
   */
  function getSkyjoMatch(metadata) {
    const value = metadata?.skyjoMatch;
    if (!value || typeof value !== 'object') return null;
    return /** @type {SkyjoMatch} */ (value);
  }

  /**
   * @param {Record<string, unknown> | undefined} metadata
   * @returns {SkyjoBoard[]}
   */
  function getSkyjoBoards(metadata) {
    const value = metadata?.skyjoBoards;
    if (!Array.isArray(value)) return [];
    return /** @type {SkyjoBoard[]} */ (value).filter((board) => Array.isArray(board.cards));
  }

  $: winner = players.find((player) => player.id === result.winnerId);
  $: currentPlayerWon = result.winnerId === currentPlayerId;
  $: currentPlayerLost = Boolean(result.winnerId && result.winnerId !== currentPlayerId);
  $: isDraw = result.status === 'draw';
  $: alreadyRequestedRematch = requests.rematch.includes(currentPlayerId);
  $: alreadyRequestedNewGame = requests.newGame.includes(currentPlayerId);
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
  $: skyjoBoards = getSkyjoBoards(result.metadata);
  $: isSkyjoRoundBreak = Boolean(skyjoMatch?.enabled && !skyjoMatch?.matchFinished);
  $: skyjoHistoryPlayers = skyjoMatch?.totalScores
    ? skyjoMatch.totalScores.map((score) => players.find((player) => player.id === score.playerId) ?? { id: score.playerId, name: 'Spieler' })
    : [];
  $: skyjoRoundHistory = skyjoMatch?.roundHistory ?? [];
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
  $: headline = createHeadline(result, winner, isDraw, isSkyjoRoundBreak, skyjoMatch);
  $: lead = winner && !skyjoMatch?.enabled && winner.id === currentPlayerId
    ? 'Du bekommst einen Siegpunkt.'
    : result.message ?? (isDraw ? 'Niemand bekommt einen Siegpunkt.' : 'Das Spiel wurde beendet.');
  $: heroPlayer = isSkyjoRoundBreak || isDraw ? null : winner ?? null;
  $: primaryLabel = isSkyjoRoundBreak ? 'Nächste Runde starten' : 'Revanche starten';
  $: requestSummary = [
    requests.rematch.length ? `${requests.rematch.length} ${requests.rematch.length === 1 ? 'möchte' : 'möchten'} eine Revanche` : '',
    requests.newGame.length ? `${requests.newGame.length} ${requests.newGame.length === 1 ? 'möchte' : 'möchten'} ein neues Spiel` : ''
  ].filter(Boolean).join(' · ');

  /**
   * @param {GameResult} res
   * @param {ScorePlayer | undefined} winningPlayer
   * @param {boolean} draw
   * @param {boolean} roundBreak
   * @param {SkyjoMatch | null} match
   */
  function createHeadline(res, winningPlayer, draw, roundBreak, match) {
    if (roundBreak) return `Runde ${match?.round ?? 1} beendet`;
    if (draw) return 'Unentschieden';
    if (winningPlayer) return winningPlayer.id === currentPlayerId ? 'Du gewinnst' : `${winningPlayer.name} gewinnt`;
    if (res.winnerName) return res.winnerName.includes(',') ? `${res.winnerName} gewinnen` : `${res.winnerName} gewinnt`;
    return 'Runde beendet';
  }

  /** @param {string} playerId */
  function playerColor(playerId) {
    return playerHex(players.find((player) => player.id === playerId)?.color);
  }

  /**
   * @param {SkyjoRoundHistoryEntry} round
   * @param {string} playerId
   */
  function scoreForRound(round, playerId) {
    return round.scores.find((score) => score.playerId === playerId)?.score ?? '–';
  }
</script>

<section class="result animate-ui-pop-in" class:result--wide={skyjoRows.length || skyjoBoards.length}>
  <div class="result-head">
    {#if heroPlayer}
      <span class="ui-avatar result-hero" style="--player: {playerColor(heroPlayer.id)}" aria-hidden="true">{initials(heroPlayer.name)}</span>
    {/if}
    <svelte:element this={headingLevel} id="result-title" class="ui-title">{headline}</svelte:element>
    <p class="ui-lead">{lead}</p>
  </div>

  {#if skyjoRows.length}
    <div class="result-block">
      <div class="result-block-head">
        <h3 class="ui-section-title">Gesamtstand</h3>
        <p class="ui-muted text-sm">Ziel {skyjoMatch?.targetScore ?? 100} Punkte · niedrigster Stand gewinnt</p>
      </div>
      <ol class="rank-list">
        <li class="rank-row rank-row--head" aria-hidden="true">
          <span></span><span>Spieler</span><span class="rank-num">Runde</span><span class="rank-num">Gesamt</span>
        </li>
        {#each skyjoRows as row, index (row.playerId)}
          <li class="rank-row rank-row--4">
            <span class="rank-pos ui-num">{index + 1}</span>
            <span class="rank-who">
              <span class="ui-avatar rank-avatar" style="--player: {playerColor(row.playerId)}" aria-hidden="true">{initials(row.player?.name)}</span>
              <span class="rank-name">{row.player?.name ?? 'Spieler'}</span>
              {#if row.playerId === currentPlayerId}<span class="rank-you">du</span>{/if}
            </span>
            <span class="rank-num ui-num ui-muted"><span class="sr-only">Runde: </span>{row.lastRound}</span>
            <span class="rank-num rank-score ui-num"><span class="sr-only">Gesamt: </span>{row.total}</span>
          </li>
        {/each}
      </ol>
    </div>
  {:else}
    {#if scoreRows.length}
      <div class="result-block">
        <h3 class="ui-section-title">Rundenpunkte</h3>
        <ol class="rank-list">
          {#each scoreRows as row, index (row.playerId)}
            <li class="rank-row">
              <span class="rank-pos ui-num">{index + 1}</span>
              <span class="rank-who">
                <span class="ui-avatar rank-avatar" style="--player: {playerColor(row.playerId)}" aria-hidden="true">{initials(row.player?.name)}</span>
                <span class="rank-name">{row.player?.name ?? 'Spieler'}</span>
                {#if row.playerId === currentPlayerId}<span class="rank-you">du</span>{/if}
              </span>
              <span class="rank-num rank-score ui-num">{row.score}</span>
            </li>
          {/each}
        </ol>
      </div>
    {/if}

    <div class="result-block">
      <h3 class="ui-section-title">{scoreRows.length ? 'Siege in dieser Party' : 'Siege'}</h3>
      <ol class="rank-list">
        {#each sortedPlayers as player, index (player.id)}
          <li class="rank-row">
            <span class="rank-pos ui-num">{index + 1}</span>
            <span class="rank-who">
              <span class="ui-avatar rank-avatar" style="--player: {playerHex(player.color)}" aria-hidden="true">{initials(player.name)}</span>
              <span class="rank-name">{player.name}</span>
              {#if player.id === currentPlayerId}<span class="rank-you">du</span>{:else if player.isHost}<span class="rank-you">Host</span>{/if}
            </span>
            <span class="rank-num rank-score ui-num">{player.score ?? 0}</span>
          </li>
        {/each}
      </ol>
    </div>
  {/if}

  <div class="result-next">
  <div class="result-actions">
    {#if isHost}
      <button type="button" on:click={onPlayAgain} disabled={isLoading} class="ui-btn ui-btn--primary ui-btn--lg">
        {#if isLoading}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" />{/if}
        {primaryLabel}
      </button>
      <button type="button" on:click={onBackToGames} disabled={isLoading} class="ui-btn ui-btn--lg">Zur Spielauswahl</button>
    {:else}
      {#if currentPlayerLost || isDraw}
        <button type="button" on:click={onRequestRematch} disabled={isLoading || alreadyRequestedRematch} class="ui-btn ui-btn--lg">
          {#if isLoading}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" />{/if}
          {alreadyRequestedRematch ? 'Revanche angefragt' : 'Revanche fordern'}
        </button>
      {/if}
      {#if currentPlayerWon || isDraw}
        <button type="button" on:click={onRequestNewGame} disabled={isLoading || alreadyRequestedNewGame} class="ui-btn ui-btn--lg">
          {#if isLoading}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" />{/if}
          {alreadyRequestedNewGame ? 'Neues Spiel angefragt' : 'Neues Spiel vorschlagen'}
        </button>
      {/if}
    {/if}
  </div>

  <p class="result-wait" aria-live="polite">
    {#if !isHost}
      <LoaderCircle class="animate-spin" size={16} aria-hidden="true" />
      Warte auf den Host{requestSummary ? ` · ${requestSummary}` : '.'}
    {:else if requestSummary}
      {requestSummary}.
    {/if}
  </p>
  </div>

  {#if skyjoRoundHistory.length && skyjoHistoryPlayers.length}
    <div class="result-block">
      <h3 class="ui-section-title">Runden im Überblick</h3>
      <div class="history-scroll">
        <table class="history">
          <thead>
            <tr>
              <th scope="col">Runde</th>
              {#each skyjoHistoryPlayers as player (player.id)}
                <th scope="col" class="history-num">{player.name}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each skyjoRoundHistory as round (round.round)}
              <tr>
                <th scope="row" class="ui-num">{round.round}</th>
                {#each skyjoHistoryPlayers as player (player.id)}
                  <td class="history-num ui-num">{scoreForRound(round, player.id)}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if skyjoBoards.length}
    <div class="result-block">
      <div class="result-block-head">
        <h3 class="ui-section-title">Aufgedeckte Karten</h3>
        <p class="ui-muted text-sm">Alle Felder am Ende der Runde</p>
      </div>
      <div class="boards">
        {#each skyjoBoards as board (board.playerId)}
          <section class="ui-card board">
            <div class="board-head">
              <span class="ui-avatar rank-avatar" style="--player: {playerColor(board.playerId)}" aria-hidden="true">{initials(board.playerName)}</span>
              <h4 class="rank-name">{board.playerName}</h4>
              <span class="rank-score ui-num">{roundScores.find((score) => score.playerId === board.playerId)?.score ?? 0}</span>
            </div>
            <div class="grid grid-cols-4 gap-1.5">
              {#each board.cards as card, cardIndex (cardIndex)}
                <PlayingCard
                  size="sm"
                  value={card.value}
                  hidden={false}
                  removed={card.removed}
                  disabled
                  revealDelayMs={card.removed ? 0 : cardIndex * 35}
                  label={`Endkarte ${cardIndex + 1} von ${board.playerName}`}
                />
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .result { display: flex; flex-direction: column; gap: 28px; max-width: 640px; margin-inline: auto; padding: 16px 0 32px; color: var(--text); }
  .result--wide { max-width: none; padding: 0; }
  @media (min-width: 768px) { .result { padding-top: 40px; } .result--wide { padding-top: 0; } }

  .result-head { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .result-hero { width: 56px; height: 56px; margin-bottom: 12px; font-size: 1.125rem; }

  .result-block { display: flex; flex-direction: column; gap: 10px; }
  .result-block-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; }

  .rank-list { margin: 0; padding: 6px; list-style: none; border-radius: var(--radius-card); background: var(--surface); }
  .rank-row { display: grid; grid-template-columns: 1.75rem minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 52px; padding: 6px 12px; }
  .rank-row--4, .rank-row--head { grid-template-columns: 1.75rem minmax(0, 1fr) 4rem 4rem; }
  .rank-row--head { min-height: 32px; font-size: 0.8125rem; font-weight: 600; color: var(--muted); }
  .rank-pos { font-size: 0.9375rem; font-weight: 600; color: var(--muted); }
  .rank-who { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .rank-avatar { width: 30px; height: 30px; font-size: 0.75rem; }
  .rank-name { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9375rem; font-weight: 600; }
  .rank-you { flex-shrink: 0; font-size: 0.8125rem; color: var(--muted); }
  .rank-num { text-align: right; }
  .rank-score { font-size: 1.0625rem; font-weight: 600; font-variant-numeric: tabular-nums; }

  .result-actions { display: flex; flex-direction: column; gap: 10px; }
  .result-actions:empty { display: none; }
  @media (min-width: 640px) { .result-actions { flex-direction: row; flex-wrap: wrap; } }

  .result-next { display: flex; flex-direction: column; gap: 12px; }
  .result-wait { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 0.9375rem; color: var(--muted); }

  .history-scroll { overflow-x: auto; border-radius: var(--radius-inner); background: var(--surface); }
  .history { width: 100%; min-width: 28rem; border-collapse: collapse; font-size: 0.9375rem; }
  .history th, .history td { padding: 10px 14px; text-align: left; white-space: nowrap; }
  .history thead th { font-size: 0.8125rem; font-weight: 600; color: var(--muted); }
  .history tbody tr { border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent); }
  .history tbody th { font-weight: 600; color: var(--muted); }
  .history-num { text-align: right !important; font-variant-numeric: tabular-nums; }

  .boards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); }
  .board-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .board-head .rank-name { flex: 1; font-size: 0.875rem; }
</style>
