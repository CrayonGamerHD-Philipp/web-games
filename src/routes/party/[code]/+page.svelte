<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft, Check, Copy, Gamepad2, LoaderCircle, Play, UserRound } from '@lucide/svelte';
  import { onDestroy, onMount } from 'svelte';

  /** @typedef {{ id: string, name: string, isHost: boolean, joinedAt: string, score: number }} Player */
  /** @typedef {{ id: string, name: string, minPlayers: number, maxPlayers: number }} GameInfo */
  /** @typedef {{ id: string, gameId: string, name: string, status: string }} ActiveGame */
  /** @typedef {{ code: string, createdAt: string, players: Player[], availableGames: GameInfo[], activeGame: ActiveGame | null }} Party */

  /** @type {Party | null} */
  let party = null;
  let error = '';
  let gameError = '';
  let isLoading = true;
  let isGameActionLoading = false;
  let copied = false;
  let copiedLink = false;
  let playerId = '';
  let selectedGameId = '';
  /** @type {EventSource | null} */
  let events = null;

  $: code = $page.params.code?.toUpperCase() ?? '';
  $: currentPlayer = party?.players.find((player) => player.id === playerId);
  $: isCurrentHost = Boolean(currentPlayer?.isHost);
  $: activeGame = party?.activeGame ?? null;
  $: selectedGame = party?.availableGames.find((game) => game.id === selectedGameId);
  $: selectedGameImage = gameImage(activeGame?.gameId ?? selectedGameId);
  $: canStartSelectedGame = Boolean(party && selectedGame && party.players.length >= selectedGame.minPlayers);

  /** @param {string | undefined} gameId */
  function gameImage(gameId) {
    if (gameId === 'skyjo') return '/images/skyjo-scene.png';
    if (gameId === 'tic-tac-toe') return '/images/tic-tac-toe-scene.png';
    return '/images/party-hero.png';
  }

  function connectEvents() {
    events?.close();
    events = new EventSource(`/api/parties/${code}/events`);

    events.addEventListener('party', (event) => {
      const data = JSON.parse(event.data);
      party = data.party;
      selectedGameId ||= party?.availableGames[0]?.id ?? '';
      error = '';
      isLoading = false;
    });

    events.addEventListener('error', () => {
      if (!party) {
        error = 'Die Live-Verbindung zur Party konnte nicht hergestellt werden.';
        isLoading = false;
      }
    });
  }

  async function copyCode() {
    if (!browser) return;

    await navigator.clipboard.writeText(code);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1600);
  }

  async function copyPartyLink() {
    if (!browser) return;

    await navigator.clipboard.writeText(`${window.location.origin}/party/${code}`);
    copiedLink = true;
    setTimeout(() => {
      copiedLink = false;
    }, 1600);
  }

  async function startSelectedGame() {
    gameError = '';
    isGameActionLoading = true;

    try {
      const response = await fetch(`/api/parties/${code}/game`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', playerId, gameId: selectedGameId })
      });
      const data = await response.json();

      if (!response.ok) {
        gameError = data.message ?? 'Das Spiel konnte nicht gestartet werden.';
        return;
      }

      party = data.party;
      await goto(`/party/${code}/game`);
    } catch {
      gameError = 'Das Spiel konnte nicht gestartet werden.';
    } finally {
      isGameActionLoading = false;
    }
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
  <title>Party {code} | Web Games</title>
</svelte:head>

<main class="min-h-screen bg-slate-50 text-slate-950">
  <section class="mx-auto w-full max-w-5xl px-6 py-8 sm:px-8 lg:px-10">
    <a href="/" class="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
      <ArrowLeft size={18} />
      Startseite
    </a>

    {#if isLoading}
      <div class="flex min-h-[70vh] items-center justify-center text-slate-500">
        <LoaderCircle class="animate-spin" size={28} />
      </div>
    {:else if error}
      <div class="mt-8 rounded-lg border border-red-200 bg-white p-6 shadow-sm sm:p-8">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">Fehler</p>
        <h1 class="mt-3 text-3xl font-semibold text-slate-950">Party nicht erreichbar</h1>
        <p class="mt-3 text-base leading-7 text-slate-600">{error}</p>
        <a
          href="/party/beitreten"
          class="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
        >
          Anderen Code eingeben
        </a>
      </div>
    {:else if party}
      <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="space-y-6">
          <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">Party-Raum</p>
            <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 class="text-3xl font-semibold text-slate-950 sm:text-4xl">Code {party.code}</h1>
                <p class="mt-3 max-w-xl text-base leading-7 text-slate-600">
                  Teile diesen Code mit anderen Spielern. Der Host waehlt ein Spiel aus, gespielt wird danach auf der Spielseite.
                </p>
              </div>
              <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  on:click={copyCode}
                  class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:border-cyan-300 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100 sm:w-auto"
                >
                  {#if copied}
                    <Check size={19} />
                    Kopiert
                  {:else}
                    <Copy size={19} />
                    Code kopieren
                  {/if}
                </button>
                <button
                  type="button"
                  on:click={copyPartyLink}
                  class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 sm:w-auto"
                >
                  {#if copiedLink}
                    <Check size={19} />
                    Link kopiert
                  {:else}
                    <Copy size={19} />
                    Link kopieren
                  {/if}
                </button>
              </div>
            </div>

            {#if currentPlayer}
              <div class="mt-8 rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                Du bist als <span class="font-semibold">{currentPlayer.name}</span> in dieser Party.
              </div>
            {:else}
              <div class="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Dieses Geraet ist noch nicht als Spieler verbunden.
                <a class="font-semibold underline underline-offset-2" href="/party/beitreten">Jetzt beitreten</a>
              </div>
            {/if}
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div class="flex items-start gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
                <Gamepad2 size={23} />
              </span>
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Spiel</p>
                <h2 class="mt-2 text-2xl font-semibold text-slate-950">
                  {activeGame ? activeGame.name : 'Spiel auswaehlen'}
                </h2>
              </div>
            </div>

            <div class="game-image-frame mt-6 aspect-[16/9] rounded-lg border border-slate-200">
              <img src={selectedGameImage} alt="Vorschau des ausgewaehlten Spiels" class="h-full w-full object-cover object-center" />
            </div>

            {#if gameError}
              <p class="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{gameError}</p>
            {/if}

            {#if activeGame}
              <div class="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                <span class="font-semibold">{activeGame.name}</span> laeuft gerade.
              </div>
              <a
                href={`/party/${party.code}/game`}
                class="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:w-auto"
              >
                <Gamepad2 size={20} />
                Zum Spiel
              </a>
            {:else if isCurrentHost}
              <div class="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label class="block">
                  <span class="text-sm font-medium text-slate-700">Verfuegbare Spiele</span>
                  <select
                    bind:value={selectedGameId}
                    class="mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  >
                    {#each party.availableGames as game (game.id)}
                      <option value={game.id}>{game.name}</option>
                    {/each}
                  </select>
                </label>

                <button
                  type="button"
                  on:click={startSelectedGame}
                  disabled={!canStartSelectedGame || isGameActionLoading}
                  class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {#if isGameActionLoading}
                    <LoaderCircle class="animate-spin" size={20} />
                    Startet
                  {:else}
                    <Play size={20} />
                    Spiel starten
                  {/if}
                </button>
              </div>

              {#if !canStartSelectedGame}
                <p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Fuer Tic Tac Toe muessen mindestens zwei Spieler in der Party sein.
                </p>
              {/if}
            {:else}
              <div class="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                Warte darauf, dass der Host ein Spiel startet.
              </div>
            {/if}
          </div>
        </div>

        <aside class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-xl font-semibold text-slate-950">Spieler</h2>
            <span class="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700">
              {party.players.length}
            </span>
          </div>

          <ul class="mt-5 space-y-3">
            {#each party.players as player (player.id)}
              <li class="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-600 ring-1 ring-slate-200">
                  <UserRound size={18} />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-semibold text-slate-950">{player.name}</span>
                  <span class="block text-xs text-slate-500">{player.isHost ? 'Host' : 'Beigetreten'}</span>
                </span>
                <span class="rounded-md bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
                  {player.score}
                </span>
              </li>
            {/each}
          </ul>
        </aside>
      </div>
    {/if}
  </section>
</main>