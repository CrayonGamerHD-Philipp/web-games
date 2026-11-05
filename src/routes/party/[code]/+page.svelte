<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ArrowLeft, Check, Crown, LoaderCircle, Lock, LockOpen, Pencil, QrCode, UserMinus, X } from '@lucide/svelte';
  import { onDestroy, onMount, tick } from 'svelte';
  import QRCode from 'qrcode';
  import { playerHex } from '$lib/player-colors.js';
  import { randomAvatar } from '$lib/party-features.js';
  import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
  import AvatarEditor from '$lib/components/AvatarEditor.svelte';
  import GameSettingsForm from '$lib/components/GameSettingsForm.svelte';
  import Leaderboard from '$lib/components/Leaderboard.svelte';
  import PartyStats from '$lib/components/PartyStats.svelte';
  import ReactionBar from '$lib/components/ReactionBar.svelte';
  import ReactionBubbles from '$lib/components/ReactionBubbles.svelte';
  import ReactionAnnouncer from '$lib/components/ReactionAnnouncer.svelte';
  import { loadStoredSettings, storeSettings, summarizeSettings } from '$lib/components/game-settings.js';

  /** @typedef {import('$lib/party-features.js').Avatar} Avatar */
  /** @typedef {import('$lib/party-features.js').GameSetting} GameSetting */
  /** @typedef {{ id: string, name: string, isHost: boolean, joinedAt: string, score: number, color: string, avatar?: Avatar }} Player */
  /** @typedef {{ id: string, name: string, description?: string, previewImage?: string, minPlayers: number, maxPlayers: number, settings?: GameSetting[] }} GameInfo */
  /** @typedef {{ id: string, gameId: string, name: string, status: string, settings?: Record<string, string | number | boolean> }} ActiveGame */
  /** @typedef {{ id: string, playerId: string, emoji: string, at: number }} Reaction */
  /** @typedef {{ id: string, gameId: string, gameName: string, winnerIds: string[], isDraw: boolean, playerIds: string[], finishedAt: string }} HistoryEntry */
  /** @typedef {{ code: string, createdAt: string, locked: boolean, players: Player[], availableGames: GameInfo[], activeGame: ActiveGame | null, reactions?: Reaction[], history?: HistoryEntry[], rounds?: import('$lib/round-stats.js').RoundRecord[] }} Party */

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
  let isProfileOpen = false;
  /** @type {Avatar | null} */
  let avatarDraft = null;
  let isAvatarSaving = false;
  let avatarError = '';
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
  /** Einstellungen des Hosts für das gewählte Spiel (pro Spiel im localStorage gemerkt). @type {Record<string, string | number | boolean>} */
  let settingsDraft = {};
  let settingsDraftFor = '';
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
  $: selectedSettingsSchema = selectedGame?.settings ?? [];
  $: if (browser && selectedGame && settingsDraftFor !== selectedGame.id) {
    settingsDraft = loadStoredSettings(selectedGame.id, selectedGame.settings);
    settingsDraftFor = selectedGame.id;
  }
  $: draftSummary = summarizeSettings(selectedSettingsSchema, settingsDraft);
  $: activeGameSettings = activeGame
    ? summarizeSettings(party?.availableGames.find((game) => game.id === activeGame?.gameId)?.settings ?? [], activeGame.settings)
    : [];
  $: reactions = party?.reactions ?? [];
  $: profileColors = playerColorOptions.map((option) => ({ id: option.id, hex: option.hex, taken: occupiedColors.has(option.id) }));

  /** @param {CustomEvent<Record<string, string | number | boolean>>} event */
  function handleSettingsChange(event) {
    settingsDraft = event.detail;
    if (selectedGameId) storeSettings(selectedGameId, settingsDraft);
  }

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

  function openProfile() {
    if (!currentPlayer) return;
    rememberFocus();
    colorError = '';
    avatarError = '';
    avatarDraft = { ...(currentPlayer.avatar ?? randomAvatar()) };
    isProfileOpen = true;
  }

  function closeProfile() {
    if (!isProfileOpen) return;
    isProfileOpen = false;
    restoreFocus();
  }

  async function saveProfile() {
    if (!avatarDraft || isAvatarSaving) return;
    avatarError = '';
    isAvatarSaving = true;
    try {
      const response = await fetch(`/api/parties/${code}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set-avatar', token, avatar: avatarDraft })
      });
      const data = await response.json();
      if (!response.ok) {
        avatarError = data.message ?? 'Der Avatar konnte nicht gespeichert werden.';
        return;
      }
      party = data.party;
      announce('Profil gespeichert');
      closeProfile();
    } catch {
      avatarError = 'Der Avatar konnte nicht gespeichert werden.';
    } finally {
      isAvatarSaving = false;
    }
  }

  /** @param {CustomEvent<string>} event */
  function handleProfileColor(event) {
    void changeColor(event.detail);
  }

  /** @param {{ message: string, confirmLabel: string, run: () => void }} confirmation */
  function requestConfirmation(confirmation) {
    if (!pendingConfirmation && !isProfileOpen) rememberFocus();
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
    } else if (isProfileOpen) {
      event.preventDefault();
      closeProfile();
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
      announce('Farbe geändert');
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
  /** Nur Einstellungen senden, die zum gestarteten Spiel gehören. @param {string} gameId */
  function settingsFor(gameId) {
    return settingsDraftFor === gameId ? settingsDraft : {};
  }

  async function startSelectedGame() {
    gameError = '';
    isGameActionLoading = true;

    try {
      const response = await fetch(`/api/parties/${code}/game`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', token, gameId: selectedGameId, settings: settingsFor(selectedGameId) })
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
<ReactionAnnouncer {reactions} players={party?.players ?? []} currentPlayerId={playerId} />

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
                  <span class="lobby-avatar">
                    <PlayerAvatar avatar={player.avatar} name={player.name} color={playerHex(player.color)} size={40} />
                    <ReactionBubbles {reactions} playerId={player.id} />
                  </span>
                  <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="truncate font-medium">{player.name}</span>
                    {#if player.isHost}<span class="lobby-chip"><Crown size={12} aria-hidden="true" /> Host</span>{/if}
                    {#if isMe}<span class="lobby-chip">Du</span>{/if}
                    {#if player.score}<span class="text-sm ui-muted ui-num">{player.score} Pkt.</span>{/if}
                  </span>
                  <span class="flex shrink-0">
                    {#if isMe}
                      <button type="button" on:click={openProfile} aria-haspopup="dialog" title="Avatar und Farbe ändern" class="ui-btn ui-btn--ghost lobby-edit-btn">
                        <Pencil size={16} aria-hidden="true" />
                        <span class="lobby-edit-label">Avatar bearbeiten</span>
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

            {#if currentPlayer}
              <div class="lobby-react">
                <ReactionBar {code} {token} label="Reaktion an alle senden" />
              </div>
            {/if}

            {#if !currentPlayer}
              <p class="mt-3 text-sm">
                Dieses Gerät ist noch nicht als Spieler verbunden.
                <a class="font-semibold underline underline-offset-2" style="color: var(--accent-text)" href={`/party/beitreten?code=${code}`}>Jetzt beitreten</a>
              </p>
            {/if}
          </section>
        </div>

        <!-- Spiel + Bestenliste: auf dem Desktop linke, breite Spalte -->
        <div class="flex flex-col gap-4 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:gap-6">
        <section class="ui-panel" aria-labelledby="game-title">
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
            {#if activeGameSettings.length}
              <ul class="lobby-settings-summary" aria-label="Einstellungen">
                {#each activeGameSettings as item (item.key)}
                  <li>{item.text}</li>
                {/each}
              </ul>
            {/if}
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
                  <!-- Einstellungen direkt unter dem gewählten Spiel, damit der Host nicht scrollen muss -->
                  {#if selected && !blocker && selectedSettingsSchema.length}
                    <div class="mt-2 mb-1 px-1">
                      <h3 class="ui-section-title mb-2">Einstellungen für {game.name}</h3>
                      <GameSettingsForm settings={selectedSettingsSchema} values={settingsDraft} idPrefix={`lobby-setting-${game.id}`} on:change={handleSettingsChange} />
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>


            {#if gameError}<p role="alert" class="ui-alert mt-4">{gameError}</p>{/if}

            <!-- Hauptaktion: auf dem Handy als feste Leiste unten, ab lg im Panel -->
            <div class="lobby-startbar">
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{selectedGame?.name ?? 'Kein Spiel gewählt'}</p>
                <p class="truncate text-sm ui-muted">
                  {selectedGameBlocker || [`${party.players.length} Spieler`, ...draftSummary.map((item) => item.short)].join(' · ')}
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
                <span class="mt-0.5 block text-sm ui-muted">Sobald es losgeht, erscheinen hier das Spiel, seine Einstellungen und „Zum Spiel“.</span>
              </p>
            </div>
            {#if gameError}<p role="alert" class="ui-alert mt-4">{gameError}</p>{/if}
          {/if}
        </section>

        <section class="ui-panel" aria-label="Bestenliste">
          <Leaderboard history={party.history ?? []} players={party.players} currentPlayerId={playerId} idPrefix="lobby-leaderboard" />
        </section>

        <section class="ui-panel" aria-label="Statistik">
          <PartyStats rounds={party.rounds ?? []} players={party.players} currentPlayerId={playerId} idPrefix="lobby-stats" />
        </section>
        </div>
      </div>
    {/if}
  </div>
</main>

{#if isProfileOpen && currentPlayer && avatarDraft}
  <div class="ui-dialog-backdrop">
    <button type="button" tabindex="-1" class="absolute inset-0 cursor-default" on:click={closeProfile} aria-label="Profil schließen"></button>
    <div class="ui-dialog lobby-profile relative animate-modal-in outline-none" role="dialog" aria-modal="true" aria-labelledby="profile-title" aria-describedby="profile-hint" tabindex="-1" use:initialFocus>
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 id="profile-title" class="text-lg font-semibold">Profil</h2>
          <p id="profile-hint" class="mt-0.5 text-sm ui-muted">Avatar und Spielerfarbe. Die Farbe gilt sofort, den Avatar speicherst du unten.</p>
        </div>
        <button type="button" on:click={closeProfile} class="ui-btn ui-btn--ghost ui-btn--icon -mr-2 -mt-2 shrink-0" aria-label="Schließen"><X size={20} aria-hidden="true" /></button>
      </div>

      <div class="mt-4">
        <AvatarEditor
          bind:avatar={avatarDraft}
          color={playerHex(currentPlayer.color)}
          name={currentPlayer.name}
          colors={profileColors}
          on:color={handleProfileColor}
        />
      </div>

      {#if colorError}<p role="alert" class="ui-alert mt-3">{colorError}</p>{/if}
      {#if avatarError}<p role="alert" class="ui-alert mt-3">{avatarError}</p>{/if}
      {#if isColorLoading}<p role="status" class="mt-3 flex items-center justify-center gap-2 text-sm ui-muted"><LoaderCircle class="animate-spin" size={16} aria-hidden="true" /> Farbe wird gespeichert…</p>{/if}

      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" on:click={closeProfile} class="ui-btn">Abbrechen</button>
        <button type="button" on:click={saveProfile} disabled={isAvatarSaving} class="ui-btn ui-btn--primary">
          {#if isAvatarSaving}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" /> Speichert…{:else}Speichern{/if}
        </button>
      </div>
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
  .lobby-avatar { position: relative; display: inline-flex; flex-shrink: 0; }
  .lobby-edit-btn { min-height: 40px; padding: 0 12px; gap: 6px; color: var(--muted); font-size: 0.875rem; }
  @media (max-width: 420px) {
    .lobby-edit-btn { width: var(--control-height); min-height: var(--control-height); padding: 0; }
    .lobby-edit-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  }
  .lobby-react { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
  .lobby-settings-summary { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; padding: 0; list-style: none; }
  .lobby-settings-summary li { padding: 4px 12px; border-radius: 999px; background: var(--raised); border: 1px solid var(--border); font-size: 0.875rem; font-weight: 500; }
  .lobby-profile { max-width: 520px; }
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

  @media (hover: hover) and (pointer: fine) {
    .lobby-back:hover { color: var(--text); }
    .lobby-game:hover:not(:disabled):not(.is-selected) { border-color: var(--control); }
    .lobby-icon-btn:hover:not(:disabled), .lobby-edit-btn:hover:not(:disabled) { color: var(--text); }
  }

  @media (prefers-reduced-motion: reduce) {
    .lobby-pulse { animation: none; }
    .lobby-game { transition: none; }
  }
</style>
