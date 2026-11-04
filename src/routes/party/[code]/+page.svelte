<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft, Check, Crown, LoaderCircle, Lock, LockOpen, Palette, QrCode, UserMinus, X } from '@lucide/svelte';
  import { onDestroy, onMount, tick } from 'svelte';
  import QRCode from 'qrcode';
  import { initials, playerHex } from '$lib/player-colors.js';

  /** @typedef {{ id: string, name: string, isHost: boolean, joinedAt: string, score: number, color: string }} Player */
  /** @typedef {{ id: string, name: string, description?: string, previewImage?: string, minPlayers: number, maxPlayers: number }} GameInfo */
  /** @typedef {{ id: string, gameId: string, name: string, status: string }} ActiveGame */
  /** @typedef {{ code: string, createdAt: string, locked: boolean, players: Player[], availableGames: GameInfo[], activeGame: ActiveGame | null }} Party */

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
  let hostError = '';
  let hostActionKey = '';
  /** @type {{ message: string, confirmLabel: string, run: () => void } | null} */
  let pendingConfirmation = null;
  let copyError = '';
  let liveMessage = '';
  /** @type {HTMLElement | null} */
  let returnFocusEl = null;
  let playerId = '';
  let token = '';
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
  $: playerCount = party?.players.length ?? 0;
  $: selectedGameBlocker = selectedGame ? missingPlayersText(selectedGame, playerCount) : 'Wähle ein Spiel aus.';
  $: canStartSelectedGame = Boolean(party && selectedGame && !selectedGameBlocker);
  $: occupiedColors = new Set(party?.players.filter((player) => player.id !== playerId).map((player) => player.color) ?? []);
  $: statusLine = !party
    ? ''
    : activeGame
      ? `${activeGame.name} läuft gerade`
      : !currentPlayer
        ? 'Du bist noch nicht dabei'
        : isCurrentHost
          ? 'Wähle ein Spiel'
          : 'Warte auf den Host';
  $: showStartBar = Boolean(party && !activeGame && isCurrentHost);

  /**
   * Grund, warum ein Spiel noch nicht startbar ist (leer = startbar).
   * @param {GameInfo} game
   * @param {number} count
   */
  function missingPlayersText(game, count) {
    if (count >= game.minPlayers) return '';
    const missing = game.minPlayers - count;
    return `Noch ${missing} Spieler nötig (ab ${game.minPlayers})`;
  }

  /**
   * Hinweis, wenn mehr Leute da sind, als mitspielen können.
   * @param {GameInfo} game
   * @param {number} count
   */
  function overflowText(game, count) {
    return count > game.maxPlayers ? `Nur die ersten ${game.maxPlayers} spielen mit` : '';
  }

  /** @param {GameInfo} game */
  function playerRange(game) {
    return game.minPlayers === game.maxPlayers ? `${game.minPlayers} Spieler` : `${game.minPlayers}–${game.maxPlayers} Spieler`;
  }

  /** @param {string | undefined} gameId */
  function gameImage(gameId) {
    const game = party?.availableGames.find((candidate) => candidate.id === gameId);
    return game?.previewImage ?? '/images/party-hero.png';
  }

  function connectEvents() {
    events?.close();
    events = new EventSource(`/api/parties/${code}/events?token=${encodeURIComponent(token)}`);

    events.addEventListener('party', (event) => {
      const data = JSON.parse(event.data);
      /** @type {Party} */
      const next = data.party;
      party = next;
      if (!selectedGameId && next) {
        const firstPlayable = next.availableGames.find((game) => !missingPlayersText(game, next.players.length));
        selectedGameId = (firstPlayable ?? next.availableGames[0])?.id ?? '';
      }
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

  /**
   * Copies text, falling back to execCommand where the async clipboard API is
   * unavailable (e.g. plain HTTP on a LAN).
   * @param {string} text
   */
  async function writeClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to the legacy fallback
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    try {
      textarea.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      textarea.remove();
      previousFocus?.focus();
    }
  }

  /** @param {string} message */
  function announce(message) {
    liveMessage = '';
    void tick().then(() => {
      liveMessage = message;
    });
  }

  async function copyCode() {
    if (!browser) return;
    copyError = '';

    if (!(await writeClipboard(code))) {
      copyError = 'Kopieren nicht möglich. Bitte markiere den Code und kopiere ihn manuell.';
      return;
    }
    copied = true;
    announce('Code kopiert');
    setTimeout(() => {
      copied = false;
    }, 1600);
  }

  async function copyPartyLink() {
    if (!browser) return;
    copyError = '';

    if (!(await writeClipboard(joinUrl || `${window.location.origin}/party/beitreten?code=${code}`))) {
      copyError = 'Kopieren nicht möglich. Bitte teile den Link manuell oder nutze den QR-Code.';
      return;
    }
    copiedLink = true;
    announce('Link kopiert');
    setTimeout(() => {
      copiedLink = false;
    }, 1600);
  }

  function rememberFocus() {
    returnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  function restoreFocus() {
    const element = returnFocusEl;
    returnFocusEl = null;
    void tick().then(() => {
      if (element?.isConnected) element.focus();
    });
  }

  /** @param {HTMLElement} node */
  function initialFocus(node) {
    node.focus();
  }

  function openColorMenu() {
    rememberFocus();
    colorError = '';
    isColorMenuOpen = true;
  }

  function closeColorMenu() {
    if (!isColorMenuOpen) return;
    isColorMenuOpen = false;
    restoreFocus();
  }

  /** @param {{ message: string, confirmLabel: string, run: () => void }} confirmation */
  function requestConfirmation(confirmation) {
    if (!pendingConfirmation && !isColorMenuOpen) rememberFocus();
    pendingConfirmation = confirmation;
  }

  function cancelConfirmation() {
    pendingConfirmation = null;
    restoreFocus();
  }

  /** @param {KeyboardEvent} event */
  function handleWindowKeydown(event) {
    if (event.key !== 'Escape') return;
    if (pendingConfirmation) {
      event.preventDefault();
      cancelConfirmation();
    } else if (isColorMenuOpen) {
      event.preventDefault();
      closeColorMenu();
    }
  }

  function requestCloseActiveGame() {
    if (!isCurrentHost || isGameActionLoading) return;
    requestConfirmation({
      message: `${activeGame?.name ?? 'Das laufende Spiel'} wirklich abbrechen? Der aktuelle Spielstand geht verloren.`,
      confirmLabel: 'Spiel abbrechen',
      run: closeActiveGame
    });
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
        body: JSON.stringify({ action: 'change-color', token, color })
      });
      const data = await response.json();
      if (!response.ok) {
        colorError = data.message ?? 'Die Farbe konnte nicht geändert werden.';
        return;
      }
      party = data.party;
      closeColorMenu();
    } catch {
      colorError = 'Die Farbe konnte nicht geändert werden.';
    } finally {
      isColorLoading = false;
    }
  }

  /**
   * @param {'set-locked' | 'transfer-host' | 'remove-player'} action
   * @param {Record<string, unknown>} payload
   * @param {string} [confirmation]
   * @param {string} [confirmLabel]
   */
  async function performHostAction(action, payload = {}, confirmation = '', confirmLabel = 'Bestätigen') {
    if (!isCurrentHost || hostActionKey) return;
    if (confirmation) {
      requestConfirmation({ message: confirmation, confirmLabel, run: () => performHostAction(action, payload) });
      return;
    }

    hostError = '';
    hostActionKey = `${action}:${payload.targetPlayerId ?? ''}`;
    try {
      const response = await fetch(`/api/parties/${code}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, token, ...payload })
      });
      const data = await response.json();
      if (!response.ok) {
        hostError = data.message ?? 'Die Host-Aktion konnte nicht ausgeführt werden.';
        return;
      }
      party = data.party;
    } catch {
      hostError = 'Die Host-Aktion konnte nicht ausgeführt werden.';
    } finally {
      hostActionKey = '';
    }
  }

  function confirmPendingAction() {
    const run = pendingConfirmation?.run;
    pendingConfirmation = null;
    restoreFocus();
    run?.();
  }

  async function closeActiveGame() {
    gameError = '';
    isGameActionLoading = true;

    try {
      const response = await fetch(`/api/parties/${code}/game`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'close', token })
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
        body: JSON.stringify({ action: 'start', token, gameId: selectedGameId, settings: selectedGameId === 'skyjo' ? { playToHundred: skyjoPlayToHundred } : {} })
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
    token = localStorage.getItem(`party-token:${code}`) ?? '';
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

<svelte:window on:keydown={handleWindowKeydown} />

<p class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</p>

<main class="lobby min-h-dvh">
  <div class="ui-page {showStartBar ? 'pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-24' : ''}">
    <a href="/" class="lobby-back">
      <ArrowLeft size={18} aria-hidden="true" />
      Startseite
    </a>

    {#if isLoading}
      <div role="status" class="flex min-h-[60vh] items-center justify-center" style="color: var(--muted)">
        <LoaderCircle class="animate-spin" size={28} aria-hidden="true" />
        <span class="sr-only">Lädt…</span>
      </div>
    {:else if error}
      <div class="mt-10 max-w-xl">
        <h1 class="ui-title">Party nicht erreichbar</h1>
        <p class="ui-lead" role="alert">{error}</p>
        <a href="/party/beitreten" class="ui-btn ui-btn--primary ui-btn--lg mt-6">Anderen Code eingeben</a>
      </div>
    {:else if party}
      <header class="mt-6 sm:mt-10">
        <h1 class="ui-title">Party <span class="ui-num">{party.code}</span></h1>
        <p class="ui-lead" aria-live="polite">
          {party.players.length} Spieler dabei · {statusLine}
        </p>
      </header>

      <div class="mt-6 grid gap-4 sm:mt-8 lg:grid-cols-12 lg:gap-6">
        <!-- Einladen + Spieler: auf dem Handy zuerst, auf dem Desktop rechte Spalte -->
        <div class="flex flex-col gap-4 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:gap-6">
          <section class="ui-panel" aria-labelledby="invite-title">
            <div class="flex items-start gap-4">
              <div class="lobby-qr">
                {#if qrCodeDataUrl}
                  <img src={qrCodeDataUrl} width="320" height="320" alt={`QR-Code zum Beitritt in Party ${party.code}`} class="h-full w-full" />
                {:else}
                  <QrCode size={36} aria-hidden="true" style="color: var(--muted)" />
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <h2 id="invite-title" class="ui-section-title">Freunde einladen</h2>
                <p class="mt-1 text-sm leading-5 ui-muted">QR-Code scannen oder den Code eingeben.</p>
                <p class="lobby-code ui-num" aria-label={`Party-Code ${party.code.split('').join(' ')}`}>{party.code}</p>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button type="button" on:click={copyCode} class="ui-btn !px-3">
                {#if copied}<Check size={18} aria-hidden="true" class="shrink-0" /> Kopiert{:else}Code kopieren{/if}
              </button>
              <button type="button" on:click={copyPartyLink} class="ui-btn !px-3">
                {#if copiedLink}<Check size={18} aria-hidden="true" class="shrink-0" /> Kopiert{:else}Link kopieren{/if}
              </button>
            </div>
            {#if copyError}
              <p role="alert" class="ui-alert mt-3">{copyError}</p>
            {/if}
          </section>

          <section class="ui-panel" aria-labelledby="players-title">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <h2 id="players-title" class="ui-section-title">Spieler <span class="ui-num ui-muted">{party.players.length}</span></h2>
                <p class="mt-0.5 text-sm ui-muted">{party.locked ? 'Gesperrt – niemand kann neu beitreten' : 'Offen für neue Spieler'}</p>
              </div>
              {#if isCurrentHost}
                <button
                  type="button"
                  on:click={() => performHostAction('set-locked', { locked: !party?.locked })}
                  disabled={Boolean(hostActionKey)}
                  title={party.locked ? 'Lobby für neue Spieler öffnen' : 'Lobby für neue Spieler sperren'}
                  aria-label={party.locked ? 'Lobby öffnen' : 'Lobby sperren'}
                  class="ui-btn shrink-0 !px-4"
                >
                  {#if hostActionKey === 'set-locked:'}<LoaderCircle class="animate-spin" size={17} aria-hidden="true" />{:else if party.locked}<LockOpen size={17} aria-hidden="true" />{:else}<Lock size={17} aria-hidden="true" />{/if}
                  {party.locked ? 'Öffnen' : 'Sperren'}
                </button>
              {/if}
            </div>

            {#if hostError}<p role="alert" class="ui-alert mt-3">{hostError}</p>{/if}

            <ul class="mt-3 flex flex-col">
              {#each party.players as player (player.id)}
                {@const isMe = player.id === playerId}
                <li class="lobby-player">
                  <span class="ui-avatar lobby-avatar" style="--player: {playerHex(player.color)}" aria-hidden="true">{initials(player.name)}</span>
                  <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="truncate font-medium">{player.name}</span>
                    {#if player.isHost}<span class="lobby-chip"><Crown size={12} aria-hidden="true" /> Host</span>{/if}
                    {#if isMe}<span class="lobby-chip">Du</span>{/if}
                    {#if player.score}<span class="text-sm ui-muted ui-num">{player.score} Pkt.</span>{/if}
                  </span>
                  <span class="flex shrink-0">
                    {#if isMe}
                      <button type="button" on:click={openColorMenu} aria-haspopup="dialog" title="Spielerfarbe ändern" aria-label="Spielerfarbe ändern" class="ui-btn ui-btn--ghost ui-btn--icon lobby-icon-btn">
                        <Palette size={18} aria-hidden="true" />
                      </button>
                    {:else if isCurrentHost}
                      <button
                        type="button"
                        on:click={() => performHostAction('transfer-host', { targetPlayerId: player.id }, `Host-Rolle wirklich an ${player.name} übertragen?`, 'Host übertragen')}
                        disabled={Boolean(hostActionKey)}
                        aria-haspopup="dialog"
                        title={`${player.name} zum Host machen`}
                        aria-label={`${player.name} zum Host machen`}
                        class="ui-btn ui-btn--ghost ui-btn--icon lobby-icon-btn"
                      >
                        {#if hostActionKey === `transfer-host:${player.id}`}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" />{:else}<Crown size={18} aria-hidden="true" />{/if}
                      </button>
                      <button
                        type="button"
                        on:click={() => performHostAction('remove-player', { targetPlayerId: player.id }, `${player.name} wirklich aus der Party entfernen?`, 'Entfernen')}
                        disabled={Boolean(hostActionKey) || Boolean(activeGame)}
                        aria-haspopup="dialog"
                        title={activeGame ? 'Während eines laufenden Spiels nicht möglich' : `${player.name} entfernen`}
                        aria-label={`${player.name} aus der Party entfernen`}
                        class="ui-btn ui-btn--ghost ui-btn--icon lobby-icon-btn"
                      >
                        {#if hostActionKey === `remove-player:${player.id}`}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" />{:else}<UserMinus size={18} aria-hidden="true" />{/if}
                      </button>
                    {/if}
                  </span>
                </li>
              {/each}
            </ul>

            {#if !currentPlayer}
              <p class="mt-3 text-sm">
                Dieses Gerät ist noch nicht als Spieler verbunden.
                <a class="font-semibold underline underline-offset-2" style="color: var(--accent-text)" href={`/party/beitreten?code=${code}`}>Jetzt beitreten</a>
              </p>
            {/if}
          </section>
        </div>

        <!-- Spiel: auf dem Desktop linke, breite Spalte -->
        <section class="ui-panel lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:self-start" aria-labelledby="game-title">
          {#if activeGame}
            <h2 id="game-title" class="ui-section-title">Laufendes Spiel</h2>
            <div class="mt-3 flex items-center gap-4">
              <div class="lobby-thumb">
                <img src={selectedGameImage} width="1536" height="1024" alt="" />
              </div>
              <div class="min-w-0">
                <p class="text-lg font-semibold">{activeGame.name}</p>
                <p class="text-sm ui-muted">läuft gerade</p>
              </div>
            </div>
            {#if gameError}<p role="alert" class="ui-alert mt-4">{gameError}</p>{/if}
            <div class="mt-5 flex flex-col gap-2 sm:flex-row">
              <a href={`/party/${party.code}/game`} class="ui-btn ui-btn--primary ui-btn--lg">Zum Spiel</a>
              {#if isCurrentHost}
                <button type="button" on:click={requestCloseActiveGame} disabled={isGameActionLoading} aria-haspopup="dialog" class="ui-btn ui-btn--danger ui-btn--lg">
                  {#if isGameActionLoading}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" />{/if}
                  Spiel abbrechen
                </button>
              {/if}
            </div>
          {:else if isCurrentHost}
            <h2 id="game-title" class="ui-section-title">Spiel wählen</h2>
            <ul class="mt-3 flex flex-col gap-2">
              {#each party.availableGames as game (game.id)}
                {@const selected = selectedGameId === game.id}
                {@const blocker = missingPlayersText(game, party.players.length)}
                {@const overflow = overflowText(game, party.players.length)}
                <li>
                  <button
                    type="button"
                    on:click={() => (selectedGameId = game.id)}
                    aria-pressed={selected}
                    disabled={Boolean(blocker)}
                    class="lobby-game {selected && !blocker ? 'is-selected' : ''}"
                  >
                    <span class="lobby-thumb">
                      <img src={game.previewImage ?? '/images/party-hero.png'} width="1536" height="1024" alt="" loading="lazy" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block font-semibold leading-tight">{game.name}</span>
                      <span class="lobby-desc">{game.description ?? 'Gemeinsam in der Party spielen.'}</span>
                      <span class="mt-1 block text-sm font-medium" style="color: {blocker ? 'var(--warning)' : 'var(--muted)'}">
                        {playerRange(game)}{#if blocker}{` · ${blocker}`}{:else if overflow}{` · ${overflow}`}{/if}
                      </span>
                    </span>
                    <span class="lobby-radio" aria-hidden="true">{#if selected && !blocker}<Check size={14} strokeWidth={3} />{/if}</span>
                  </button>
                </li>
              {/each}
            </ul>

            {#if selectedGameId === 'skyjo'}
              <label class="lobby-option mt-3">
                <input type="checkbox" bind:checked={skyjoPlayToHundred} />
                <span class="min-w-0">
                  <span class="block font-semibold">Bis 100 Punkte spielen</span>
                  <span class="mt-0.5 block text-sm leading-5 ui-muted">Rundenpunkte werden addiert. Der niedrigste Gesamtstand gewinnt.</span>
                </span>
              </label>
            {/if}

            {#if gameError}<p role="alert" class="ui-alert mt-4">{gameError}</p>{/if}

            <!-- Hauptaktion: auf dem Handy als feste Leiste unten, ab lg im Panel -->
            <div class="lobby-startbar">
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{selectedGame?.name ?? 'Kein Spiel gewählt'}</p>
                <p class="truncate text-sm ui-muted">
                  {selectedGameBlocker || `${party.players.length} Spieler${selectedGameId === 'skyjo' && skyjoPlayToHundred ? ' · bis 100 Punkte' : ''}`}
                </p>
              </div>
              <button
                type="button"
                on:click={startSelectedGame}
                disabled={!canStartSelectedGame || isGameActionLoading}
                class="ui-btn ui-btn--primary ui-btn--lg shrink-0"
              >
                {#if isGameActionLoading}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" /> Startet…{:else}Spiel starten{/if}
              </button>
            </div>
          {:else}
            <h2 id="game-title" class="ui-section-title">Spiel</h2>
            <div class="lobby-waiting mt-3" role="status">
              <span class="lobby-pulse" aria-hidden="true"></span>
              <p>
                <span class="block font-medium">Der Host wählt gerade ein Spiel.</span>
                <span class="mt-0.5 block text-sm ui-muted">Sobald es losgeht, erscheint hier „Zum Spiel“.</span>
              </p>
            </div>
            {#if gameError}<p role="alert" class="ui-alert mt-4">{gameError}</p>{/if}
          {/if}
        </section>
      </div>
    {/if}
  </div>
</main>

{#if isColorMenuOpen && currentPlayer}
  <div class="ui-dialog-backdrop">
    <button type="button" tabindex="-1" class="absolute inset-0 cursor-default" on:click={closeColorMenu} aria-label="Farbmenü schließen"></button>
    <div class="ui-dialog relative animate-modal-in outline-none" role="dialog" aria-modal="true" aria-labelledby="color-menu-title" aria-describedby="color-menu-hint" tabindex="-1" use:initialFocus>
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 id="color-menu-title" class="text-lg font-semibold">Spielerfarbe wählen</h2>
          <p id="color-menu-hint" class="mt-0.5 text-sm ui-muted">Belegte Farben sind durchgestrichen.</p>
        </div>
        <button type="button" on:click={closeColorMenu} class="ui-btn ui-btn--ghost ui-btn--icon -mr-2 -mt-2 shrink-0" aria-label="Schließen"><X size={20} aria-hidden="true" /></button>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {#each playerColorOptions as option (option.id)}
          {@const occupied = occupiedColors.has(option.id)}
          {@const current = currentPlayer.color === option.id}
          <button
            type="button"
            on:click={() => changeColor(option.id)}
            disabled={occupied || isColorLoading}
            aria-label={occupied ? `${option.name} ist bereits vergeben` : `${option.name} wählen`}
            aria-pressed={current}
            class="lobby-swatch {current ? 'is-current' : ''}"
          >
            <span class="lobby-swatch-dot" style="background: {option.hex}">
              {#if current}<Check size={16} strokeWidth={3} aria-hidden="true" />{/if}
            </span>
            <span class="min-w-0 text-left">
              <span class="block truncate text-sm font-medium {occupied ? 'line-through' : ''}">{option.name}</span>
              <span class="block text-xs ui-muted">{occupied ? 'Vergeben' : current ? 'Deine Farbe' : 'Frei'}</span>
            </span>
          </button>
        {/each}
      </div>
      {#if colorError}<p role="alert" class="ui-alert mt-3">{colorError}</p>{/if}
      {#if isColorLoading}<p role="status" class="mt-3 flex items-center justify-center gap-2 text-sm ui-muted"><LoaderCircle class="animate-spin" size={16} aria-hidden="true" /> Farbe wird gespeichert…</p>{/if}
    </div>
  </div>
{/if}

{#if pendingConfirmation}
  <div class="ui-dialog-backdrop" style="z-index: 94">
    <button type="button" tabindex="-1" class="absolute inset-0 cursor-default" on:click={cancelConfirmation} aria-label="Bestätigung schließen"></button>
    <div class="ui-dialog relative animate-modal-in" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
      <h2 id="confirm-dialog-title" class="text-lg font-semibold">Bist du sicher?</h2>
      <p id="confirm-dialog-message" class="mt-2 leading-6">{pendingConfirmation.message}</p>
      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" on:click={cancelConfirmation} use:initialFocus class="ui-btn">Abbrechen</button>
        <button type="button" on:click={confirmPendingAction} class="ui-btn ui-btn--danger">{pendingConfirmation.confirmLabel}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .lobby {
    background: var(--ground);
    color: var(--text);
  }

  .lobby-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--muted);
    text-decoration: none;
  }
  .lobby-back:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 2px; border-radius: 6px; }

  /* Einladen */
  .lobby-qr {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 104px;
    height: 104px;
    padding: 4px;
    border-radius: var(--radius-inner);
    background: #fff;
    overflow: hidden;
  }
  .lobby-code {
    margin: 8px 0 0;
    font-size: 1.75rem;
    line-height: 1.1;
    font-weight: 600;
    letter-spacing: 0.06em;
    user-select: all;
  }

  /* Spieler */
  .lobby-player {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 6px 0;
  }
  .lobby-player + .lobby-player { border-top: 1px solid var(--border); }
  .lobby-avatar { width: 40px; height: 40px; font-size: 0.875rem; }
  .lobby-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .lobby-icon-btn { color: var(--muted); }

  /* Spielauswahl */
  .lobby-game {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 10px 14px 10px 10px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-inner);
    background: var(--raised);
    color: var(--text);
    text-align: left;
    cursor: pointer;
    transition: border-color 150ms ease, transform 120ms ease;
    -webkit-tap-highlight-color: transparent;
  }
  .lobby-game:active:not(:disabled) { transform: scale(0.99); }
  .lobby-game:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 2px; }
  .lobby-game.is-selected { border-color: var(--accent-main); box-shadow: inset 0 0 0 1px var(--accent-main); }
  .lobby-game:disabled { cursor: not-allowed; background: transparent; }
  .lobby-game:disabled .lobby-thumb { opacity: 0.55; }

  .lobby-thumb {
    display: block;
    flex-shrink: 0;
    width: 84px;
    aspect-ratio: 4 / 3;
    border-radius: 10px;
    overflow: hidden;
    background: var(--surface-2);
  }
  .lobby-thumb img { width: 100%; height: 100%; object-fit: cover; }
  @media (min-width: 640px) {
    .lobby-thumb { width: 120px; }
  }

  .lobby-desc {
    display: -webkit-box;
    margin-top: 2px;
    font-size: 0.875rem;
    line-height: 1.35;
    color: var(--muted);
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .lobby-radio {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 1.5px solid var(--control);
    color: #fff;
  }
  .lobby-game.is-selected .lobby-radio { background: var(--accent-main); border-color: var(--accent-main); }
  .lobby-game:disabled .lobby-radio { opacity: 0.4; }

  .lobby-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-inner);
    background: var(--raised);
    border: 1px solid var(--border);
    cursor: pointer;
  }
  .lobby-option input { width: 20px; height: 20px; margin-top: 2px; flex-shrink: 0; accent-color: var(--accent-main); }

  /* Startleiste: Handy fest unten, ab lg im Panel */
  .lobby-startbar {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    background: var(--ground);
    border-top: 1px solid var(--border);
  }
  @media (min-width: 1024px) {
    /* Im Panel, klebt aber am unteren Rand, solange die Spielliste länger als der Bildschirm ist. */
    .lobby-startbar {
      position: sticky;
      margin: 20px calc(var(--pad) * -1) calc(var(--pad) * -1);
      padding: 16px var(--pad) var(--pad);
      background: var(--surface);
      border-radius: 0 0 var(--radius-card) var(--radius-card);
    }
  }

  /* Warten (Nicht-Host) */
  .lobby-waiting {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border-radius: var(--radius-inner);
    background: var(--raised);
    border: 1px solid var(--border);
  }
  .lobby-pulse {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    margin-top: 7px;
    border-radius: 999px;
    background: var(--accent-main);
    animation: lobby-pulse 1.8s ease-in-out infinite;
  }
  @keyframes lobby-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* Farbwahl */
  .lobby-swatch {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding: 8px 12px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-inner);
    background: var(--raised);
    color: var(--text);
    cursor: pointer;
    transition: border-color 150ms ease;
  }
  .lobby-swatch:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 2px; }
  .lobby-swatch.is-current { border-color: var(--accent-main); }
  .lobby-swatch:disabled { cursor: not-allowed; opacity: 0.45; }
  .lobby-swatch-dot {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    color: #fff;
  }

  @media (hover: hover) and (pointer: fine) {
    .lobby-back:hover { color: var(--text); }
    .lobby-game:hover:not(:disabled):not(.is-selected) { border-color: var(--control); }
    .lobby-swatch:hover:not(:disabled):not(.is-current) { border-color: var(--control); }
    .lobby-icon-btn:hover:not(:disabled) { color: var(--text); }
  }

  @media (prefers-reduced-motion: reduce) {
    .lobby-pulse { animation: none; }
    .lobby-game, .lobby-swatch { transition: none; }
  }
</style>
