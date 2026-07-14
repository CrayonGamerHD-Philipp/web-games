<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft, Check, Copy, Gamepad2, LoaderCircle, Palette, Play, QrCode, SquareX, UserRound, X } from '@lucide/svelte';
  import { onDestroy, onMount } from 'svelte';
  import QRCode from 'qrcode';

  /** @typedef {{ id: string, name: string, isHost: boolean, joinedAt: string, score: number, color: string }} Player */
  /** @typedef {{ id: string, name: string, description?: string, previewImage?: string, minPlayers: number, maxPlayers: number }} GameInfo */
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
  let qrCodeDataUrl = '';
  let joinUrl = '';
  let colorError = '';
  let isColorLoading = false;
  let isColorMenuOpen = false;
  let playerId = '';
  let selectedGameId = '';
  let skyjoPlayToHundred = false;
  /** @type {EventSource | null} */
  let events = null;
  const playerColorOptions = [
    { id: 'cyan', name: 'Türkis', hex: '#0891b2' },
    { id: 'violet', name: 'Violett', hex: '#7c3aed' },
    { id: 'rose', name: 'Rosa', hex: '#e11d48' },
    { id: 'emerald', name: 'Grün', hex: '#059669' },
    { id: 'orange', name: 'Orange', hex: '#ea580c' },
    { id: 'blue', name: 'Blau', hex: '#2563eb' },
    { id: 'amber', name: 'Gold', hex: '#d97706' },
    { id: 'lime', name: 'Limette', hex: '#65a30d' },
    { id: 'teal', name: 'Petrol', hex: '#0d9488' },
    { id: 'sky', name: 'Himmelblau', hex: '#0284c7' },
    { id: 'fuchsia', name: 'Fuchsia', hex: '#c026d3' },
    { id: 'red', name: 'Rot', hex: '#dc2626' }
  ];

  $: code = $page.params.code?.toUpperCase() ?? '';
  $: currentPlayer = party?.players.find((player) => player.id === playerId);
  $: isCurrentHost = Boolean(currentPlayer?.isHost);
  $: activeGame = party?.activeGame ?? null;
  $: selectedGame = party?.availableGames.find((game) => game.id === selectedGameId);
  $: selectedGameImage = gameImage(activeGame?.gameId ?? selectedGameId);
  $: canStartSelectedGame = Boolean(party && selectedGame && party.players.length >= selectedGame.minPlayers);
  $: occupiedColors = new Set(party?.players.filter((player) => player.id !== playerId).map((player) => player.color) ?? []);
  $: currentColorOption = playerColorOptions.find((option) => option.id === currentPlayer?.color);

  /** @param {string | undefined} gameId */
  function gameImage(gameId) {
    const game = party?.availableGames.find((candidate) => candidate.id === gameId);
    return game?.previewImage ?? '/images/party-hero.png';
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

    await navigator.clipboard.writeText(joinUrl || `${window.location.origin}/party/beitreten?code=${code}`);
    copiedLink = true;
    setTimeout(() => {
      copiedLink = false;
    }, 1600);
  }

  async function createQrCode() {
    if (!browser || !code) return;
    joinUrl = `${window.location.origin}/party/beitreten?code=${code}`;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    } catch {
      qrCodeDataUrl = '';
    }
  }

  /** @param {string} color */
  async function changeColor(color) {
    if (!currentPlayer || color === currentPlayer.color || occupiedColors.has(color) || isColorLoading) return;
    colorError = '';
    isColorLoading = true;
    try {
      const response = await fetch(`/api/parties/${code}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'change-color', playerId, color })
      });
      const data = await response.json();
      if (!response.ok) {
        colorError = data.message ?? 'Die Farbe konnte nicht geändert werden.';
        return;
      }
      party = data.party;
      isColorMenuOpen = false;
    } catch {
      colorError = 'Die Farbe konnte nicht geändert werden.';
    } finally {
      isColorLoading = false;
    }
  }

  /** @param {string} color */
  function playerColor(color) {
    return playerColorOptions.find((option) => option.id === color)?.hex ?? '#64748b';
  }


  async function closeActiveGame() {
    gameError = '';
    isGameActionLoading = true;

    try {
      const response = await fetch(`/api/parties/${code}/game`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'close', playerId })
      });
      const data = await response.json();

      if (!response.ok) {
        gameError = data.message ?? 'Das Spiel konnte nicht abgebrochen werden.';
        return;
      }

      party = data.party;
    } catch {
      gameError = 'Das Spiel konnte nicht abgebrochen werden.';
    } finally {
      isGameActionLoading = false;
    }
  }
  async function startSelectedGame() {
    gameError = '';
    isGameActionLoading = true;

    try {
      const response = await fetch(`/api/parties/${code}/game`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', playerId, gameId: selectedGameId, settings: selectedGameId === 'skyjo' ? { playToHundred: skyjoPlayToHundred } : {} })
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
    void createQrCode();
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
  <section class="mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
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
      <div class="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="space-y-6">
          <div class="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <img src="/images/decor/lobby.png" alt="" aria-hidden="true" class="pointer-events-none absolute right-4 top-4 h-20 w-20 animate-decor-float object-contain opacity-90 sm:h-24 sm:w-24" />
            <p class="relative z-10 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">Party-Raum</p>
            <div class="relative z-10 mt-4 flex flex-col gap-4 pr-16 sm:pr-20 sm:flex-row sm:items-end sm:justify-between">
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

            <div class="relative z-10 mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
              <div class="mx-auto grid h-32 w-32 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                {#if qrCodeDataUrl}
                  <img src={qrCodeDataUrl} alt={`QR-Code zum Beitritt in Party ${party.code}`} class="h-full w-full" />
                {:else}
                  <QrCode size={42} class="text-slate-400" />
                {/if}
              </div>
              <div>
                <div class="flex items-center gap-2 text-sm font-semibold text-slate-900"><QrCode size={18} /> Per QR-Code beitreten</div>
                <p class="mt-2 text-sm leading-6 text-slate-600">Mit der Handykamera scannen und direkt mit vorausgefülltem Party-Code beitreten.</p>
                <p class="mt-2 break-all text-xs text-slate-400">{joinUrl}</p>
              </div>
            </div>

            {#if currentPlayer}
              <div class="mt-6 flex flex-col gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex min-w-0 items-center gap-3">
                  <span class="h-9 w-9 shrink-0 rounded-full border-2 border-white shadow-sm" style={`background: ${playerColor(currentPlayer.color)}`}></span>
                  <div class="min-w-0">
                    <p class="truncate">Du bist als <span class="font-semibold">{currentPlayer.name}</span> in dieser Party.</p>
                    <p class="mt-0.5 text-xs text-cyan-700">Spielerfarbe: {currentColorOption?.name ?? 'Standard'}</p>
                  </div>
                </div>
                <button type="button" on:click={() => { colorError = ''; isColorMenuOpen = true; }} class="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-semibold text-cyan-800 shadow-sm transition hover:border-cyan-500 hover:text-cyan-900 focus:outline-none focus:ring-4 focus:ring-cyan-100">
                  <Palette size={16} /> Farbe ändern
                </button>
              </div>
            {:else}
              <div class="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Dieses Geraet ist noch nicht als Spieler verbunden.
                <a class="font-semibold underline underline-offset-2" href={`/party/beitreten?code=${code}`}>Jetzt beitreten</a>
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

            {#if activeGame}
              <div class="game-image-frame mt-6 aspect-[21/9] rounded-xl border border-slate-200">
                <img src={selectedGameImage} alt="Vorschau des laufenden Spiels" class="h-full w-full object-cover object-center" />
              </div>
            {/if}

            {#if gameError}
              <p class="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{gameError}</p>
            {/if}

            {#if activeGame}
              <div class="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                <span class="font-semibold">{activeGame.name}</span> laeuft gerade.
              </div>
              <div class="mt-5 flex flex-col gap-2 sm:flex-row">
                <a
                  href={`/party/${party.code}/game`}
                  class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:w-auto"
                >
                  <Gamepad2 size={20} />
                  Zum Spiel
                </a>
                {#if isCurrentHost}
                  <button
                    type="button"
                    on:click={closeActiveGame}
                    disabled={isGameActionLoading}
                    class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-5 py-3 font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <SquareX size={20} />
                    Spiel abbrechen
                  </button>
                {/if}
              </div>
            {:else if isCurrentHost}
              <div class="mt-6">
                <div class="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 class="text-lg font-semibold text-slate-950">Verfügbare Spiele</h3>
                    <p class="mt-1 text-sm text-slate-500">Wähle eine Karte aus und starte die Runde.</p>
                  </div>
                  <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{party.players.length} Spieler in der Lobby</span>
                </div>

                <div class="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {#each party.availableGames as game (game.id)}
                    {@const selected = selectedGameId === game.id}
                    {@const enoughPlayers = party.players.length >= game.minPlayers}
                    <button
                      type="button"
                      on:click={() => (selectedGameId = game.id)}
                      aria-pressed={selected}
                      class="group overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-100 {selected ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-emerald-300'}"
                    >
                      <span class="game-image-frame relative block aspect-[16/9] border-b border-slate-200">
                        <img src={game.previewImage ?? '/images/party-hero.png'} alt={`Vorschau von ${game.name}`} class="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.03]" />
                        {#if selected}
                          <span class="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow"><Check size={14} /> Ausgewählt</span>
                        {/if}
                      </span>
                      <span class="block p-4">
                        <span class="flex items-start justify-between gap-3">
                          <span class="text-lg font-semibold text-slate-950">{game.name}</span>
                          <span class="shrink-0 rounded-md px-2 py-1 text-xs font-semibold {enoughPlayers ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}">{game.minPlayers}–{game.maxPlayers}</span>
                        </span>
                        <span class="mt-2 block min-h-10 text-sm leading-5 text-slate-600">{game.description ?? 'Gemeinsam in der Party spielen.'}</span>
                        <span class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold {enoughPlayers ? 'text-emerald-700' : 'text-amber-700'}"><UserRound size={14} /> {enoughPlayers ? 'Spielbereit' : `Noch ${game.minPlayers - party.players.length} Spieler benötigt`}</span>
                      </span>
                    </button>
                  {/each}
                </div>

                <div class="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {#if selectedGameId === 'skyjo'}
                    <label class="mb-4 block rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
                      <span class="flex items-start gap-3">
                        <input type="checkbox" bind:checked={skyjoPlayToHundred} class="mt-1 h-4 w-4 shrink-0 rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500" />
                        <span class="min-w-0"><span class="block font-semibold">Skyjo bis 100 Gesamtpunkte</span><span class="mt-1 block leading-5 text-cyan-800">Rundenpunkte werden addiert. Der niedrigste Gesamtstand gewinnt.</span></span>
                      </span>
                    </label>
                  {/if}
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="font-semibold text-slate-950">{selectedGame?.name ?? 'Kein Spiel ausgewählt'}</p>
                      <p class="mt-1 text-sm text-slate-500">{canStartSelectedGame ? 'Alle Voraussetzungen sind erfüllt.' : `Mindestens ${selectedGame?.minPlayers ?? 2} Spieler erforderlich.`}</p>
                    </div>
                    <button
                      type="button"
                      on:click={startSelectedGame}
                      disabled={!canStartSelectedGame || isGameActionLoading}
                      class="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      {#if isGameActionLoading}<LoaderCircle class="animate-spin" size={20} /> Startet{:else}<Play size={20} /> {selectedGame?.name ?? 'Spiel'} starten{/if}
                    </button>
                  </div>
                </div>
              </div>

              {#if !canStartSelectedGame}
                <p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Fuer {selectedGame?.name ?? 'dieses Spiel'} muessen mindestens {selectedGame?.minPlayers ?? 2} Spieler in der Party sein.
                </p>
              {/if}
            {:else}
              <div class="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                Warte darauf, dass der Host ein Spiel startet.
              </div>
            {/if}
          </div>
        </div>

        <aside class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 xl:sticky xl:top-8 xl:self-start">
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-xl font-semibold text-slate-950">Spieler</h2>
            <span class="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700">
              {party.players.length}
            </span>
          </div>

          <ul class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
            {#each party.players as player (player.id)}
              <li class="relative flex items-center gap-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 {player.id === playerId ? 'ring-2 ring-cyan-200' : ''}">
                <span class="absolute inset-y-0 left-0 w-1.5" style={`background: ${playerColor(player.color)}`}></span>
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-white" style={`background: ${playerColor(player.color)}`}>
                  <UserRound size={19} />
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

{#if isColorMenuOpen && currentPlayer}
  <button type="button" class="fixed inset-0 z-[89] bg-slate-950/40 backdrop-blur-sm" on:click={() => (isColorMenuOpen = false)} aria-label="Farbmenü schließen"></button>
  <div class="fixed inset-x-2 bottom-2 z-[90] max-h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-h-[min(88vh,42rem)] sm:w-[min(92vw,30rem)] sm:-translate-x-1/2 sm:-translate-y-1/2" role="dialog" aria-modal="true" aria-labelledby="color-menu-title">
    <div class="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
      <div class="flex items-center gap-3">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-cyan-600 text-white"><Palette size={20} /></span>
        <div><h2 id="color-menu-title" class="font-semibold text-slate-950">Spielerfarbe wählen</h2><p class="mt-0.5 text-xs text-slate-500">Belegte Farben können nicht gewählt werden.</p></div>
      </div>
      <button type="button" on:click={() => (isColorMenuOpen = false)} class="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-cyan-100" aria-label="Schließen"><X size={19} /></button>
    </div>

    <div class="max-h-[calc(100dvh-6rem)] overscroll-contain overflow-y-auto p-3 sm:max-h-[calc(min(88vh,42rem)-5rem)] sm:p-5">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {#each playerColorOptions as option (option.id)}
          {@const occupied = occupiedColors.has(option.id)}
          <button
            type="button"
            on:click={() => changeColor(option.id)}
            disabled={occupied || isColorLoading}
            aria-label={occupied ? `${option.name} ist bereits vergeben` : `${option.name} wählen`}
            aria-pressed={currentPlayer.color === option.id}
            class="relative flex min-h-16 items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 text-left transition focus:outline-none focus:ring-4 focus:ring-cyan-100 {occupied ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md'} {currentPlayer.color === option.id ? 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-200' : ''}"
          >
            <span class="relative h-8 w-8 shrink-0 rounded-full border-2 border-white shadow-sm" style={`background: ${option.hex}`}>
              {#if currentPlayer.color === option.id}<Check class="absolute inset-0 m-auto text-white drop-shadow" size={16} strokeWidth={3} />{/if}
              {#if occupied}<span class="absolute left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-slate-700"></span>{/if}
            </span>
            <span class="min-w-0"><span class="block truncate text-xs font-semibold {occupied ? 'line-through' : ''}">{option.name}</span><span class="block text-[0.65rem] {occupied ? 'font-bold uppercase tracking-wide' : 'text-slate-500'}">{occupied ? 'Vergeben' : currentPlayer.color === option.id ? 'Ausgewählt' : 'Frei'}</span></span>
          </button>
        {/each}
      </div>
      {#if colorError}<p class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{colorError}</p>{/if}
      {#if isColorLoading}<p class="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle class="animate-spin" size={16} /> Farbe wird gespeichert …</p>{/if}
    </div>
  </div>
{/if}
