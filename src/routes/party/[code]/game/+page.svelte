<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import GameShell from '$lib/game-system/components/GameShell.svelte';
  import { onDestroy, onMount, tick } from 'svelte';

  /** @typedef {{ id: string, name: string, isHost: boolean, joinedAt: string, score: number }} Player */
  /** @typedef {{ id: string, gameId: string, name: string, status: string, players: { id: string, name: string, mark?: string }[], state: Record<string, unknown>, requests: { rematch: string[], newGame: string[] } }} ActiveGame */
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
  $: shellMaxWidth = activeGame?.gameId === 'noch-mal' ? 'max-w-[100rem]' : activeGame?.gameId === 'skyjo' ? 'max-w-5xl' : 'max-w-6xl lg:px-10';

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
  <section class="mx-auto w-full px-3 py-3 sm:px-5 sm:py-5 {shellMaxWidth}">
    <GameShell
      {code}
      partyPlayers={party?.players ?? []}
      {activeGame}
      currentPlayerId={playerId}
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

