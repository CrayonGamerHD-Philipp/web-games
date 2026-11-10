<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import GameShell from '$lib/game-system/components/GameShell.svelte';
  import { onDestroy, onMount, tick } from 'svelte';

  /** @typedef {{ id: string, name: string, isHost: boolean, joinedAt: string, score: number, color: string, avatar?: import('$lib/party-features.js').Avatar }} Player */
  /** @typedef {{ id: string, gameId: string, name: string, status: string, players: { id: string, name: string, mark?: string }[], state: Record<string, unknown>, requests: { rematch: string[], newGame: string[] } }} ActiveGame */
  /** @typedef {{ code: string, players: Player[], activeGame: ActiveGame | null, history?: { id: string, gameId: string, gameName: string, winnerIds: string[], isDraw: boolean, playerIds: string[], finishedAt: string }[], reactions?: { id: string, playerId: string, emoji: string, at: number }[], rounds?: import('$lib/round-stats.js').RoundRecord[] }} Party */

  /** @type {Party | null} */
  let party = null;
  let error = '';
  let gameError = '';
  let isLoading = true;
  let isActionLoading = false;
  let playerId = '';
  let token = '';
  let renderNonce = 0;
  /** @type {EventSource | null} */
  let events = null;

  $: code = $page.params.code?.toUpperCase() ?? '';
  $: currentPlayer = party?.players.find((player) => player.id === playerId);
  $: isCurrentHost = Boolean(currentPlayer?.isHost);
  $: activeGame = party?.activeGame ?? null;
  $: shellMaxWidth = activeGame?.gameId === 'noch-mal' ? 'max-w-[1800px] 2xl:max-w-[96vw]' : activeGame?.gameId === 'skyjo' || activeGame?.gameId === 'kunterbunt' ? 'max-w-5xl' : activeGame?.gameId === 'schiffe-versenken' || activeGame?.gameId === 'moosgeister' || activeGame?.gameId === 'auf-und-ab' ? 'max-w-6xl' : activeGame?.gameId === 'tic-tac-toe' || activeGame?.gameId === 'vier-in-einer-reihe' ? 'max-w-3xl' : activeGame?.gameId === 'ab-nach-hause' ? 'max-w-5xl' : activeGame?.gameId === 'sudoku-duell' || activeGame?.gameId === 'wuerfelblock' ? 'max-w-4xl' : 'max-w-6xl lg:px-10';

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
    events = new EventSource(`/api/parties/${code}/events?token=${encodeURIComponent(token)}`);

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
        body: JSON.stringify({ action, token, ...payload })
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

  /** @param {Record<string, unknown>} move */
  function sendMove(move) {
    sendGameAction('move', { move });
  }

  async function chooseNewGame() {
    await sendGameAction('close');
    await goto(`/party/${code}`);
  }

  onMount(() => {
    playerId = localStorage.getItem(`party-player:${code}`) ?? '';
    token = localStorage.getItem(`party-token:${code}`) ?? '';
    connectEvents();
  });

  onDestroy(() => {
    events?.close();
  });
</script>

<svelte:head>
  <title>Spiel {code} | Web Games</title>
</svelte:head>

<main class="min-h-screen" style="background: var(--ground); color: var(--text)">
  <section class="mx-auto w-full px-3 pb-8 pt-3 sm:px-5 sm:pt-5 {shellMaxWidth}">
    <GameShell
      {code}
      partyPlayers={party?.players ?? []}
      {activeGame}
      currentPlayerId={playerId}
      {token}
      history={party?.history ?? []}
      rounds={party?.rounds ?? []}
      reactions={party?.reactions ?? []}
      isHost={isCurrentHost}
      {isLoading}
      {isActionLoading}
      {error}
      {gameError}
      {renderNonce}
      lobbyHref={`/party/${code}`}
      onMove={sendMove}
      onRestart={() => sendGameAction('restart')}
      onRequestRematch={() => sendGameAction('request-rematch')}
      onRequestNewGame={() => sendGameAction('request-new-game')}
      onChooseNewGame={chooseNewGame}
    />
  </section>
</main>
