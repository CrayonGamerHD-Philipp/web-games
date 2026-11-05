<script>
  import { tick } from 'svelte';
  import { ArrowLeft, Ellipsis, LoaderCircle, RotateCcw, SmilePlus, SquareX } from '@lucide/svelte';
  import { getGameDefinition } from '../../../games/registry';
  import { playerHex } from '../../player-colors.js';
  import { GAME_SETTINGS } from '../../party-features.js';
  import PlayerAvatar from '../../components/PlayerAvatar.svelte';
  import ReactionBar from '../../components/ReactionBar.svelte';
  import ReactionBubbles from '../../components/ReactionBubbles.svelte';
  import ReactionAnnouncer from '../../components/ReactionAnnouncer.svelte';
  import { summarizeSettings } from '../../components/game-settings.js';
  import GameResultScreen from './GameResultScreen.svelte';

  /** @typedef {{ id: string, name: string, score: number, isHost?: boolean, color?: string, avatar?: import('../../party-features.js').Avatar | null }} Player */
  /** @typedef {{ id: string, gameId: string, gameName: string, winnerIds: string[], isDraw: boolean, playerIds: string[], finishedAt: string }} HistoryEntry */
  /** @typedef {{ id: string, playerId: string, emoji: string, at: number }} Reaction */
  /** @typedef {{ id: string, value: number | null, revealed: boolean, removed: boolean }} SkyjoSlot */
  /** @typedef {{ id: string, name: string, mark?: string, grid?: SkyjoSlot[] }} GamePlayer */
  /** @typedef {import('../types').GameResult} GameResult */
  /** @typedef {{ winnerId?: string | null, isDraw?: boolean, currentPlayerId?: string | null, roundScores?: { playerId: string, score: number }[], match?: { enabled?: boolean, targetScore?: number, round?: number, totalScores?: { playerId: string, score: number }[], lastRoundScores?: { playerId: string, score: number }[], matchFinished?: boolean, winnerIds?: string[] } }} ActiveGameState */
  /** @typedef {{ id: string, gameId: string, name: string, status: string, players: GamePlayer[], state: ActiveGameState, requests: { rematch: string[], newGame: string[] }, settings?: Record<string, string | number | boolean>, roundStats?: import('../../round-stats.js').RoundRecord }} ActiveGame */

  /** @type {string} */
  export let code = '';
  /** @type {Player[]} */
  export let partyPlayers = [];
  /** @type {ActiveGame | null} */
  export let activeGame = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isHost = false;
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {boolean} */
  export let isActionLoading = false;
  /** @type {string} */
  export let error = '';
  /** @type {string} */
  export let gameError = '';
  /** @type {number} */
  export let renderNonce = 0;
  /** @type {string} */
  export let lobbyHref = '/';
  /** Spieler-Token (für Reaktionen) */
  export let token = '';
  /** @type {HistoryEntry[]} */
  export let history = [];
  /** @type {Reaction[]} */
  export let reactions = [];
  /** Rundenprotokoll der Party @type {import('../../round-stats.js').RoundRecord[]} */
  export let rounds = [];
  /** @type {(move: Record<string, unknown>) => void} */
  export let onMove = () => {};
  /** @type {() => void} */
  export let onRestart = () => {};
  /** @type {() => void} */
  export let onRequestRematch = () => {};
  /** @type {() => void} */
  export let onRequestNewGame = () => {};
  /** @type {() => void} */
  export let onChooseNewGame = () => {};

  $: definition = getGameDefinition(activeGame?.gameId);
  $: GameComponent = definition?.component;
  $: myGamePlayer = activeGame?.players.find((player) => player.id === currentPlayerId);
  $: currentTurnPlayer = activeGame?.players.find((player) => player.id === activeGame.state.currentPlayerId);
  $: winnerPlayer = activeGame?.players.find((player) => player.id === activeGame.state.winnerId);
  $: isMyTurn = Boolean(activeGame && myGamePlayer && activeGame.state.currentPlayerId === currentPlayerId && activeGame.status === 'running');
  $: isSkyjo = activeGame?.gameId === 'skyjo';
  $: isRunning = activeGame?.status === 'running';
  $: isFinished = activeGame?.status === 'finished';
  // Spiele mit eigenem, vollbreitem Tisch – ohne Seitenleiste.
  $: isFullWidth = ['skyjo', 'noch-mal', 'tic-tac-toe', 'schiffe-versenken', 'kunterbunt', 'sudoku-duell', 'vier-in-einer-reihe', 'wuerfelblock', 'ab-nach-hause'].includes(activeGame?.gameId ?? '');
  // Bei beendeten Spielen (außer Skyjo, dort Modal) trägt der Ergebnis-Screen die h1.
  $: showsInlineResult = Boolean(isFinished && !isSkyjo && !showBoard);
  $: identityPlayers = activeGame
    ? activeGame.players.map((gamePlayer) => ({
        ...gamePlayer,
        hex: playerHex(partyPlayers.find((player) => player.id === gamePlayer.id)?.color),
        avatar: partyPlayers.find((player) => player.id === gamePlayer.id)?.avatar ?? null
      }))
    : [];
  $: gameScorePlayers = activeGame
    ? activeGame.players.map((gamePlayer) => {
        const partyPlayer = partyPlayers.find((player) => player.id === gamePlayer.id);
        return {
          id: gamePlayer.id,
          name: gamePlayer.name,
          score: partyPlayer?.score ?? 0,
          isHost: partyPlayer?.isHost ?? false,
          color: partyPlayer?.color,
          avatar: partyPlayer?.avatar ?? null
        };
      })
    : [];
  $: result = createResult(activeGame, currentPlayerId, winnerPlayer?.name);
  $: settingsSummary = summarizeSettings(GAME_SETTINGS[activeGame?.gameId ?? ''] ?? [], activeGame?.settings);
  $: canReact = Boolean(token && partyPlayers.some((player) => player.id === currentPlayerId));

  /* ---------- Spielfeld nach Rundenende ansehen ---------- */
  let showBoard = false;
  let boardFor = '';
  // Neue Runde oder neues Spiel: wieder mit dem Ergebnis beginnen.
  $: if ((activeGame?.id ?? '') + (activeGame?.status ?? '') !== boardFor) {
    boardFor = (activeGame?.id ?? '') + (activeGame?.status ?? '');
    showBoard = false;
  }
  $: viewingBoard = Boolean(isFinished && showBoard);

  async function openBoard() {
    showBoard = true;
    await tick();
    document.getElementById('shell-board-back')?.focus();
  }

  async function closeBoard() {
    showBoard = false;
    await tick();
    document.getElementById('result-title')?.focus();
  }

  /* ---------- Reaktionen (Popover / Sheet auf dem Handy) ---------- */
  let reactOpen = false;
  /** @type {HTMLButtonElement | null} */
  let reactButton = null;
  /** @type {HTMLElement | null} */
  let reactPanel = null;

  async function openReactions() {
    closeMenu(false);
    reactOpen = true;
    await tick();
    reactPanel?.querySelector('button')?.focus();
  }

  /** @param {boolean} [restoreFocus] */
  function closeReactions(restoreFocus = true) {
    if (!reactOpen) return;
    reactOpen = false;
    if (restoreFocus) reactButton?.focus();
  }

  function handleReactionSent() {
    // Auf dem Handy verdeckt das Sheet das Spiel: nach dem Senden schließen.
    if (window.matchMedia('(max-width: 639px)').matches) closeReactions();
  }

  /* ---------- Überlaufmenü (Host-Aktionen) ---------- */
  let menuOpen = false;
  /** @type {HTMLButtonElement | null} */
  let menuButton = null;
  /** @type {HTMLElement | null} */
  let menuList = null;

  async function openMenu() {
    reactOpen = false;
    menuOpen = true;
    await tick();
    menuList?.querySelector('button')?.focus();
  }

  /** @param {boolean} [restoreFocus] */
  function closeMenu(restoreFocus = true) {
    if (!menuOpen) return;
    menuOpen = false;
    if (restoreFocus) menuButton?.focus();
  }

  /** @param {KeyboardEvent} event */
  function handleMenuKeydown(event) {
    if (!menuList) return;
    const items = /** @type {HTMLButtonElement[]} */ ([...menuList.querySelectorAll('button:not([disabled])')]);
    const index = items.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Tab') {
      closeMenu(false);
    }
  }

  /** @param {MouseEvent} event */
  function handleWindowClick(event) {
    const target = /** @type {Node} */ (event.target);
    if (reactOpen && !reactPanel?.contains(target) && !reactButton?.contains(target)) closeReactions(false);
    if (!menuOpen) return;
    if (menuList?.contains(target) || menuButton?.contains(target)) return;
    closeMenu(false);
  }

  /* ---------- Bestätigungsdialog ---------- */
  /** @typedef {'restart' | 'cancel'} ConfirmKind */
  /** @type {ConfirmKind | null} */
  let confirmKind = null;
  /** @type {HTMLButtonElement | null} */
  let confirmCancelButton = null;
  /** @type {HTMLElement | null} */
  let confirmDialog = null;
  /** @type {HTMLElement | null} */
  let confirmReturnFocus = null;

  const confirmCopy = {
    restart: {
      title: 'Spiel neu starten?',
      text: 'Der aktuelle Spielstand geht verloren und alle beginnen von vorn.',
      action: 'Neu starten'
    },
    cancel: {
      title: 'Spiel abbrechen?',
      text: 'Das laufende Spiel wird für alle beendet und ihr kehrt zur Spielauswahl zurück.',
      action: 'Spiel abbrechen'
    }
  };

  /** @param {ConfirmKind} kind */
  async function openConfirm(kind) {
    // Aus dem Menü heraus: Fokus nach dem Dialog zurück auf den Menü-Button.
    confirmReturnFocus = menuOpen ? menuButton : document.activeElement instanceof HTMLElement ? document.activeElement : null;
    menuOpen = false;
    confirmKind = kind;
    await tick();
    confirmCancelButton?.focus();
  }

  function closeConfirm() {
    if (!confirmKind) return;
    confirmKind = null;
    confirmReturnFocus?.focus();
    confirmReturnFocus = null;
  }

  function acceptConfirm() {
    const kind = confirmKind;
    closeConfirm();
    if (kind === 'restart') onRestart();
    if (kind === 'cancel') onChooseNewGame();
  }

  /** @param {KeyboardEvent} event */
  function handleWindowKeydown(event) {
    if (reactOpen && event.key === 'Escape') {
      event.preventDefault();
      closeReactions();
      return;
    }
    if (menuOpen && event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (!confirmKind) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeConfirm();
      return;
    }
    if (event.key === 'Tab' && confirmDialog) {
      const focusable = /** @type {HTMLElement[]} */ ([...confirmDialog.querySelectorAll('button:not([disabled])')]);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  /** Fokus beim Öffnen in das Skyjo-Ergebnis-Modal setzen. @param {HTMLElement} node */
  function focusOnMount(node) {
    tick().then(() => node.focus());
  }

  /**
   * @param {ActiveGame | null} game
   * @param {string} playerId
   * @param {string | undefined} winnerName
   * @returns {GameResult}
   */
  function createResult(game, playerId, winnerName) {
    const status = /** @type {'won' | 'lost' | 'draw' | 'cancelled'} */ (
      game?.state.isDraw ? 'draw' : game?.state.winnerId === playerId ? 'won' : game?.state.winnerId ? 'lost' : 'cancelled'
    );

    const match = game?.state.match;
    const skyjoBoards = game?.gameId === 'skyjo'
      ? game.players.map((gamePlayer) => ({
          playerId: gamePlayer.id,
          playerName: gamePlayer.name,
          cards: gamePlayer.grid ?? []
        }))
      : [];
    const matchLeaderNames = match?.winnerIds?.length
      ? match.winnerIds
          .map((winnerId) => game?.players.find((player) => player.id === winnerId)?.name)
          .filter(Boolean)
          .join(', ')
      : winnerName;

    return {
      status,
      winnerId: game?.state.winnerId ?? undefined,
      winnerName: matchLeaderNames || winnerName,
      title: match?.enabled && !match.matchFinished ? `Runde ${match.round ?? 1} beendet` : game?.name ?? 'Spiel beendet',
      message: match?.enabled
        ? match.matchFinished
          ? 'Der niedrigste Gesamtstand gewinnt das Match.'
          : `Zwischenstand nach Runde ${match.round ?? 1}. Der Host startet die nächste Runde.`
        : game?.state.isDraw
          ? 'Niemand bekommt einen Siegpunkt.'
          : winnerName
            ? `${winnerName} bekommt einen Siegpunkt.`
            : 'Die Runde wurde beendet.',
      metadata: match?.enabled || skyjoBoards.length ? { skyjoMatch: match, skyjoBoards } : undefined
    };
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} on:click={handleWindowClick} />

{#if isLoading || error || !activeGame || !definition || !GameComponent}
  <div class="shell-bar">
    <a href={lobbyHref} class="ui-btn ui-btn--ghost shell-back"><ArrowLeft size={18} aria-hidden="true" />Lobby</a>
  </div>
{/if}

{#if isLoading}
  <div class="flex min-h-[70vh] items-center justify-center" style="color: var(--muted)" role="status">
    <LoaderCircle class="animate-spin" size={28} aria-hidden="true" />
    <span class="sr-only">Lädt…</span>
  </div>
{:else if error}
  <div class="ui-panel mt-4 sm:p-8">
    <h1 class="ui-title">Spiel nicht erreichbar</h1>
    <p class="ui-lead">{error}</p>
  </div>
{:else if !activeGame}
  <div class="ui-panel mt-4 sm:p-8">
    <h1 class="ui-title">Gerade läuft kein Spiel</h1>
    <p class="ui-lead">Geh zurück in die Lobby, dort kann der Host ein Spiel starten.</p>
    <a href={lobbyHref} class="ui-btn ui-btn--primary mt-6">Zur Lobby</a>
  </div>
{:else if !definition || !GameComponent}
  <div class="ui-panel mt-4 sm:p-8">
    <h1 class="ui-title">Unbekanntes Spiel</h1>
    <p class="ui-lead">Die Spiel-ID <span class="font-semibold" style="color: var(--text)">{activeGame.gameId}</span> ist nicht registriert.</p>
  </div>
{:else}
  <header class="shell-header">
    <div class="shell-bar">
      <a href={lobbyHref} class="ui-btn ui-btn--ghost shell-back"><ArrowLeft size={18} aria-hidden="true" />Lobby</a>

      <div class="shell-titles">
        <p class="shell-name">
          <svelte:element this={showsInlineResult ? 'span' : 'h1'} class="shell-game">{definition.name}</svelte:element>
          <span class="shell-code"><span class="sr-only">Party-Code </span>{code}</span>
          {#if settingsSummary.length}
            <span class="shell-settings">
              <span class="sr-only">Einstellungen: {settingsSummary.map((item) => item.text).join(', ')}</span>
              {#each settingsSummary as item (item.key)}
                <span class="shell-setting" title={item.text} aria-hidden="true">{item.short}</span>
              {/each}
            </span>
          {/if}
        </p>
        <p class="shell-status" aria-live="polite">
          {#if activeGame.state.winnerId}
            {activeGame.state.winnerId === currentPlayerId ? 'Du hast gewonnen.' : `${winnerPlayer?.name ?? 'Jemand'} hat gewonnen.`}
          {:else if activeGame.state.isDraw}
            Unentschieden.
          {:else if isMyTurn}
            <span class="shell-status-me">Du bist am Zug.</span>
          {:else if currentTurnPlayer}
            {currentTurnPlayer.name} ist am Zug.
          {:else if isSkyjo}
            Alle decken zwei Startkarten auf.
          {:else}
            Das Spiel läuft.
          {/if}
          {#if !myGamePlayer} Du schaust zu.{/if}
        </p>
      </div>

      {#if canReact}
        <div class="shell-menu">
          <button
            bind:this={reactButton}
            type="button"
            class="ui-btn ui-btn--ghost ui-btn--icon"
            class:is-open={reactOpen}
            aria-label="Reaktion senden"
            aria-expanded={reactOpen}
            aria-controls="shell-react-panel"
            on:click={() => (reactOpen ? closeReactions() : openReactions())}
          >
            <SmilePlus size={21} aria-hidden="true" />
          </button>
          {#if reactOpen}
            <div bind:this={reactPanel} id="shell-react-panel" class="shell-popover shell-react">
              <ReactionBar {code} {token} on:sent={handleReactionSent} />
            </div>
          {/if}
        </div>
      {/if}

      {#if isHost && !isFinished}
        <div class="shell-menu">
          <button
            bind:this={menuButton}
            type="button"
            class="ui-btn ui-btn--ghost ui-btn--icon"
            aria-label="Spieloptionen"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls="shell-menu-list"
            disabled={isActionLoading}
            on:click={() => (menuOpen ? closeMenu() : openMenu())}
          >
            {#if isActionLoading}<LoaderCircle class="animate-spin" size={20} aria-hidden="true" />{:else}<Ellipsis size={22} aria-hidden="true" />{/if}
          </button>
          {#if menuOpen}
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <div bind:this={menuList} id="shell-menu-list" role="menu" tabindex="-1" aria-label="Spieloptionen" class="shell-popover" on:keydown={handleMenuKeydown}>
              <button type="button" role="menuitem" class="shell-menuitem" on:click={() => openConfirm('restart')} aria-haspopup="dialog">
                <RotateCcw size={18} aria-hidden="true" />Neu starten
              </button>
              <button type="button" role="menuitem" class="shell-menuitem shell-menuitem--danger" on:click={() => openConfirm('cancel')} aria-haspopup="dialog">
                <SquareX size={18} aria-hidden="true" />Spiel abbrechen
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <ul class="shell-players touch-scroll-x" aria-label="Mitspieler">
      {#each identityPlayers as player (player.id)}
        {@const onTurn = isRunning && activeGame.state.currentPlayerId === player.id}
        <li class="shell-player" class:is-turn={onTurn}>
          <span class="shell-avatar">
            <PlayerAvatar avatar={player.avatar} name={player.name} color={player.hex} size={30} active={onTurn} />
            <ReactionBubbles {reactions} playerId={player.id} placement="over" />
          </span>
          <span class="shell-player-name">{player.name}</span>
          {#if player.id === currentPlayerId}<span class="shell-you">du</span>{/if}
          {#if onTurn}<span class="sr-only">, am Zug</span>{/if}
        </li>
      {/each}
    </ul>
    <ReactionAnnouncer {reactions} players={partyPlayers} {currentPlayerId} />
  </header>

  {#if gameError}
    <p class="ui-alert mt-3" role="alert">{gameError}</p>
  {/if}

  <div class="mt-3 grid gap-4 {isFullWidth ? '' : 'lg:grid-cols-[minmax(0,1fr)_18rem]'}">
    <div class="min-w-0">
      {#if viewingBoard}
        <div class="shell-board-bar">
          <p class="shell-board-note">Endstand – alle Karten und Felder sind aufgedeckt.</p>
          <button id="shell-board-back" type="button" class="ui-btn ui-btn--primary" on:click={closeBoard}>Zurück zum Ergebnis</button>
        </div>
      {/if}
      {#if showsInlineResult}
        <GameResultScreen
          {result}
          {currentPlayerId}
          players={gameScorePlayers}
          {isHost}
          requests={activeGame.requests}
          roundScores={activeGame.state.roundScores ?? []}
          isLoading={isActionLoading}
          onPlayAgain={onRestart}
          onBackToGames={onChooseNewGame}
          {onRequestRematch}
          {onRequestNewGame}
          {history}
          {partyPlayers}
          roundStats={activeGame.roundStats ?? null}
          {rounds}
          onShowBoard={openBoard}
        />
      {:else}
        <svelte:component this={GameComponent} game={activeGame} {currentPlayerId} isLoading={isActionLoading} onMove={onMove} {renderNonce} players={partyPlayers} />
      {/if}
    </div>

    {#if !isFullWidth}
      <aside class="ui-panel space-y-3">
        <h2 class="ui-section-title">Spieler</h2>
        <ul class="space-y-2">
          {#each identityPlayers as player (player.id)}
            <li class="flex items-center gap-3">
              <PlayerAvatar avatar={player.avatar} name={player.name} color={player.hex} size={32} />
              <span class="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
              {#if player.mark}<span class="ui-chip">{player.mark}</span>{/if}
            </li>
          {/each}
        </ul>
      </aside>
    {/if}
  </div>

  {#if isSkyjo && isFinished && !showBoard}
    <div class="ui-dialog-backdrop">
      <div class="ui-dialog result-dialog animate-modal-in" role="dialog" aria-modal="true" aria-labelledby="result-title" tabindex="-1" use:focusOnMount>
        <GameResultScreen
          {result}
          {currentPlayerId}
          players={gameScorePlayers}
          {isHost}
          requests={activeGame.requests}
          roundScores={activeGame.state.roundScores ?? []}
          isLoading={isActionLoading}
          onPlayAgain={onRestart}
          onBackToGames={onChooseNewGame}
          {onRequestRematch}
          {onRequestNewGame}
          {history}
          {partyPlayers}
          roundStats={activeGame.roundStats ?? null}
          {rounds}
          onShowBoard={openBoard}
          headingLevel="h2"
        />
      </div>
    </div>
  {/if}
{/if}

{#if confirmKind}
  <div class="ui-dialog-backdrop">
    <button type="button" class="absolute inset-0 cursor-default" tabindex="-1" aria-label="Abbrechen" on:click={closeConfirm}></button>
    <div
      bind:this={confirmDialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-confirm-title"
      aria-describedby="game-confirm-text"
      class="ui-dialog relative max-w-sm animate-modal-in"
    >
      <h2 id="game-confirm-title" class="text-xl font-semibold" style="color: var(--text)">{confirmCopy[confirmKind].title}</h2>
      <p id="game-confirm-text" class="mt-2 text-[0.9375rem] leading-6" style="color: var(--muted)">{confirmCopy[confirmKind].text}</p>
      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button bind:this={confirmCancelButton} type="button" on:click={closeConfirm} class="ui-btn">Zurück</button>
        <button type="button" on:click={acceptConfirm} class="ui-btn {confirmKind === 'cancel' ? 'ui-btn--danger' : 'ui-btn--primary'}">
          {confirmCopy[confirmKind].action}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Platz für den fixierten Einstellungs-Button (44px, 12px bzw. 20px vom Rand) rechts freihalten.
     (100vw - 100%) / 2 = Abstand vom Spalten- zum Fensterrand; ist er groß genug, bleibt kein Rand. */
  .shell-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--control-height);
    padding-right: max(0px, calc(64px - (100vw - 100%) / 2));
  }
  @media (min-width: 640px) {
    .shell-bar { padding-right: max(0px, calc(80px - (100vw - 100%) / 2)); }
  }

  .shell-back {
    flex-shrink: 0;
    padding: 0 14px 0 10px;
    margin-left: -6px;
    color: var(--text);
  }

  .shell-titles { min-width: 0; flex: 1; }
  .shell-name {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    min-width: 0;
  }
  .shell-game {
    flex: 0 1 auto;
    min-width: min(7.5em, 60%);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 1rem;
    line-height: 1.25;
    font-weight: 600;
    color: var(--text);
  }
  .shell-code {
    flex-shrink: 0;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  /* Schmale Handys: Spielname vor Party-Code (der Code steht in der Lobby). */
  @media (max-width: 479px) { .shell-name:has(.shell-settings) .shell-code { display: none; } }
  .shell-status {
    margin: 1px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8125rem;
    line-height: 1.3;
    color: var(--muted);
  }
  .shell-status-me { color: var(--accent-text); font-weight: 600; }

  .shell-settings { display: flex; flex: 0 100 auto; gap: 4px; min-width: 0; overflow: hidden; }
  .shell-setting {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.5;
    color: var(--muted);
  }

  .is-open { background: var(--surface); }
  .shell-popover.shell-react { min-width: 0; width: 24rem; max-width: calc(100vw - 24px); padding: 4px; }
  /* Handy: kompaktes Sheet über dem unteren Rand statt Popover unter dem Knopf. */
  @media (max-width: 639px) {
    .shell-popover.shell-react {
      position: fixed;
      top: auto;
      left: 12px;
      right: 12px;
      bottom: max(12px, env(safe-area-inset-bottom));
      z-index: 60;
      width: auto;
      padding: 6px;
      border-radius: var(--radius-card);
      animation: shell-sheet-in 180ms ease-out both;
    }
  }
  @keyframes shell-sheet-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .shell-react { animation: none !important; }
  }

  .shell-menu { position: relative; flex-shrink: 0; }
  .shell-popover {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 40;
    min-width: 200px;
    padding: 6px;
    border-radius: var(--radius-inner);
    background: var(--raised);
    border: 1px solid var(--border);
    box-shadow: 0 16px 32px -12px rgb(0 0 0 / 0.3);
  }
  .shell-menuitem {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: var(--control-height);
    padding: 0 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--text);
    font-size: 0.9375rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .shell-menuitem:focus-visible { outline: 2px solid var(--accent-main); outline-offset: -2px; }
  .shell-menuitem:active { background: var(--surface-2); }
  .shell-menuitem--danger { color: var(--negative); }
  @media (hover: hover) and (pointer: fine) {
    .shell-menuitem:hover { background: var(--surface); }
    .shell-back:hover { color: var(--text); }
  }

  .shell-players {
    display: flex;
    gap: 6px;
    margin: 6px 0 0;
    padding: 3px 3px 3px;
    list-style: none;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .shell-players::-webkit-scrollbar { display: none; }
  .shell-player {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 8px;
    min-height: 36px;
    padding: 2px 12px 2px 2px;
    border-radius: var(--radius-control);
    background: var(--surface);
    scroll-snap-align: start;
  }
  .shell-player.is-turn {
    background: var(--accent-soft);
    outline: 2px solid var(--accent-main);
    outline-offset: 0;
  }
  .shell-avatar { position: relative; display: inline-flex; flex-shrink: 0; }
  .shell-player-name {
    max-width: 9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
  }
  .shell-you { font-size: 0.8125rem; color: var(--muted); }

  .shell-board-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 12px;
    padding: 10px 12px 10px 16px;
    border-radius: var(--radius-inner);
    background: var(--accent-soft);
  }
  .shell-board-note { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--text); }

  .result-dialog { max-width: 64rem; padding: 20px; }
  @media (min-width: 640px) { .result-dialog { padding: 32px; } }
  .result-dialog:focus { outline: none; }
</style>
