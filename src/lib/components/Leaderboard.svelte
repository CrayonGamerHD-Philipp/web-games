<script>
  // Bestenliste der Party aus dem Spielverlauf: Siege, Spiele, Quote, Lieblingsspiel, letzte Spiele.
  import { onDestroy, onMount, tick } from 'svelte';
  import { X } from '@lucide/svelte';
  import PlayerAvatar from './PlayerAvatar.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import { playerHex } from '$lib/player-colors.js';

  /** @typedef {{ id: string, gameId: string, gameName: string, winnerIds: string[], isDraw: boolean, playerIds: string[], finishedAt: string }} HistoryEntry */
  /** @typedef {{ id: string, name: string, color?: string, avatar?: import('$lib/party-features.js').Avatar | null }} LeaderboardPlayer */

  /** @type {HistoryEntry[]} */
  export let history = [];
  /** @type {LeaderboardPlayer[]} */
  export let players = [];
  export let currentPlayerId = '';
  /** Kompakt: nur Top 3 und „Alle anzeigen“ (öffnet die volle Liste im Dialog) */
  export let compact = false;
  export let limit = 3;
  export let title = 'Bestenliste';
  /** @type {'h2' | 'h3'} */
  export let headingLevel = 'h2';
  /** Eindeutiger Präfix für IDs */
  export let idPrefix = 'leaderboard';

  const FORMER = 'Ehemaliger Spieler';

  let filter = 'all';
  let now = Date.now();
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let clock;

  $: entries = (history ?? []).filter((entry) => entry && Array.isArray(entry.playerIds));
  $: playedGames = uniqueGames(entries);
  $: if (filter !== 'all' && !playedGames.some((game) => game.id === filter)) filter = 'all';
  $: filtered = filter === 'all' ? entries : entries.filter((entry) => entry.gameId === filter);
  $: rows = computeRows(filtered, players);
  $: shownRows = compact ? rows.slice(0, limit) : rows;
  $: recent = [...filtered].reverse().slice(0, 8);

  /** @param {HistoryEntry[]} list */
  function uniqueGames(list) {
    /** @type {Map<string, string>} */
    const games = new Map();
    for (const entry of list) if (!games.has(entry.gameId)) games.set(entry.gameId, entry.gameName ?? entry.gameId);
    return [...games].map(([id, name]) => ({ id, name }));
  }

  /**
   * Siege (Unentschieden = 0), Spiele, Quote, Lieblingsspiel pro aktuellem Spieler.
   * Ehemalige Spieler fallen aus der Rangliste heraus (sie tauchen unter „Letzte Spiele“ auf).
   * @param {HistoryEntry[]} list
   * @param {LeaderboardPlayer[]} partyPlayers
   */
  function computeRows(list, partyPlayers) {
    /** @type {Map<string, { player: LeaderboardPlayer, wins: number, games: number, winsByGame: Map<string, number> }>} */
    const stats = new Map((partyPlayers ?? []).map((player) => [player.id, { player, wins: 0, games: 0, winsByGame: new Map() }]));
    for (const entry of list) {
      for (const id of entry.playerIds) {
        const stat = stats.get(id);
        if (!stat) continue;
        stat.games += 1;
        if (!entry.isDraw && entry.winnerIds?.includes(id)) {
          stat.wins += 1;
          const name = entry.gameName ?? entry.gameId;
          stat.winsByGame.set(name, (stat.winsByGame.get(name) ?? 0) + 1);
        }
      }
    }
    const sorted = [...stats.values()]
      .filter((stat) => stat.games > 0)
      .map((stat) => {
        let favourite = '';
        let best = 0;
        for (const [name, count] of stat.winsByGame) if (count > best) [favourite, best] = [name, count];
        return { ...stat, rate: stat.games ? stat.wins / stat.games : 0, favourite };
      })
      .sort((a, b) => b.wins - a.wins || b.rate - a.rate || b.games - a.games || a.player.name.localeCompare(b.player.name));

    // Gleichstand (gleiche Siege und Spiele) teilt sich den Platz.
    /** @type {(typeof sorted[number] & { rank: number })[]} */
    const ranked = [];
    sorted.forEach((row, index) => {
      const previous = ranked[index - 1];
      const rank = previous && previous.wins === row.wins && previous.games === row.games ? previous.rank : index + 1;
      ranked.push({ ...row, rank });
    });
    return ranked;
  }

  /** @param {number} rate */
  function percent(rate) {
    return `${Math.round(rate * 100)} %`;
  }

  /** @param {string} id */
  function playerById(id) {
    return players.find((player) => player.id === id);
  }

  /**
   * @param {string} iso
   * @param {number} reference
   */
  function relativeTime(iso, reference) {
    const time = Date.parse(iso);
    if (!Number.isFinite(time)) return '';
    const minutes = Math.floor(Math.max(0, reference - time) / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
  }

  /** @param {HistoryEntry} entry */
  function winnersOf(entry) {
    if (entry.isDraw || !entry.winnerIds?.length) return [];
    return entry.winnerIds.map((id) => {
      const player = playerById(id);
      return { id, name: player?.name ?? FORMER, color: player ? playerHex(player.color) : '#64748b', avatar: player?.avatar ?? null, former: !player };
    });
  }

  /* ---------- Dialog „Alle anzeigen“ ---------- */
  let dialogOpen = false;
  /** @type {HTMLElement | null} */
  let dialogEl = null;
  /** @type {HTMLElement | null} */
  let returnFocus = null;

  async function openDialog() {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogOpen = true;
    await tick();
    dialogEl?.focus();
  }

  function closeDialog() {
    if (!dialogOpen) return;
    dialogOpen = false;
    const element = returnFocus;
    returnFocus = null;
    void tick().then(() => element?.isConnected && element.focus());
  }

  /** @param {KeyboardEvent} event */
  function handleDialogKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeDialog();
      return;
    }
    if (event.key === 'Tab' && dialogEl) {
      const focusable = /** @type {HTMLElement[]} */ ([...dialogEl.querySelectorAll('button:not([disabled])')]);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogEl)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  onMount(() => {
    now = Date.now();
    clock = setInterval(() => (now = Date.now()), 30000);
  });
  onDestroy(() => clearInterval(clock));
</script>

<div class="lb" class:lb--compact={compact}>
  <div class="lb-head">
    <svelte:element this={headingLevel} id={`${idPrefix}-title`} class="ui-section-title">{title}</svelte:element>
    {#if compact && rows.length > limit}
      <button type="button" class="ui-btn ui-btn--ghost lb-more" aria-haspopup="dialog" on:click={openDialog}>Alle anzeigen</button>
    {:else if compact && entries.length}
      <button type="button" class="ui-btn ui-btn--ghost lb-more" aria-haspopup="dialog" on:click={openDialog}>Details</button>
    {/if}
  </div>

  {#if !entries.length}
    <p class="lb-empty">Noch keine Spiele beendet.</p>
  {:else}
    {#if !compact && playedGames.length > 1}
      <div class="lb-filter touch-scroll-x" role="group" aria-label="Nach Spiel filtern">
        <button type="button" class="lb-pill" aria-pressed={filter === 'all'} on:click={() => (filter = 'all')}>Alle</button>
        {#each playedGames as game (game.id)}
          <button type="button" class="lb-pill" aria-pressed={filter === game.id} on:click={() => (filter = game.id)}>{game.name}</button>
        {/each}
      </div>
    {/if}

    {#if shownRows.length}
      <ol class="lb-list" aria-labelledby={`${idPrefix}-title`}>
        <li class="lb-row lb-row--head" class:lb-row--compact={compact} aria-hidden="true">
          <span></span><span>Spieler</span><span class="lb-num">Siege</span><span class="lb-num">Spiele</span>{#if !compact}<span class="lb-num lb-rate">Quote</span>{/if}
        </li>
        {#each shownRows as row (row.player.id)}
          <li class="lb-row" class:lb-row--compact={compact} class:is-me={row.player.id === currentPlayerId}>
            <span class="lb-pos ui-num"><span class="sr-only">Platz </span>{row.rank}</span>
            <span class="lb-who">
              <PlayerAvatar avatar={row.player.avatar} name={row.player.name} color={playerHex(row.player.color)} size={32} />
              <span class="lb-whotext">
                <span class="lb-name">{row.player.name}{#if row.player.id === currentPlayerId}<span class="lb-you">&nbsp;· du</span>{/if}</span>
                {#if !compact && row.favourite && filter === 'all'}
                  <span class="lb-fav">Lieblingsspiel: {row.favourite}</span>
                {/if}
              </span>
            </span>
            <span class="lb-num lb-score ui-num"><span class="sr-only">Siege: </span>{row.wins}</span>
            <span class="lb-num ui-num ui-muted"><span class="sr-only">Spiele: </span>{row.games}</span>
            {#if !compact}<span class="lb-num lb-rate ui-num ui-muted"><span class="sr-only">Siegquote: </span>{percent(row.rate)}</span>{/if}
          </li>
        {/each}
      </ol>
    {:else}
      <p class="lb-empty">Niemand aus der aktuellen Runde hat schon gespielt.</p>
    {/if}

    {#if !compact}
      <div class="lb-recent">
        <h3 class="lb-subtitle">Letzte Spiele</h3>
        <ul class="lb-recent-list">
          {#each recent as entry (entry.id + entry.finishedAt)}
            {@const winners = winnersOf(entry)}
            <li class="lb-game">
              <span class="lb-game-main">
                <span class="lb-game-name">{entry.gameName}</span>
                <span class="lb-game-time ui-num">{relativeTime(entry.finishedAt, now)}</span>
              </span>
              <span class="lb-game-result">
                {#if winners.length}
                  <PlayerAvatar avatar={winners[0].avatar} name={winners[0].name} color={winners[0].color} size={24} />
                  <span class="lb-game-winner" class:is-former={winners.every((winner) => winner.former)}>
                    <span class="sr-only">Gewonnen: </span>{winners.map((winner) => winner.name).join(', ')}
                  </span>
                {:else}
                  <span class="lb-game-winner ui-muted">Unentschieden</span>
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</div>

{#if dialogOpen}
  <div class="ui-dialog-backdrop" style="z-index: 96">
    <button type="button" tabindex="-1" class="absolute inset-0 cursor-default" on:click={closeDialog} aria-label="Bestenliste schließen"></button>
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
      bind:this={dialogEl}
      class="ui-dialog lb-dialog relative animate-modal-in outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Bestenliste"
      tabindex="-1"
      on:keydown={handleDialogKeydown}
    >
      <div class="lb-dialog-close">
        <button type="button" on:click={closeDialog} class="ui-btn ui-btn--ghost ui-btn--icon" aria-label="Schließen"><X size={20} aria-hidden="true" /></button>
      </div>
      <Leaderboard {history} {players} {currentPlayerId} compact={false} headingLevel="h2" idPrefix={`${idPrefix}-full`} />
    </div>
  </div>
{/if}

<style>
  .lb { display: flex; flex-direction: column; gap: 12px; color: var(--text); container-type: inline-size; }
  .lb-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; }
  .lb-more { min-height: 36px; padding: 0 12px; margin: -6px -8px -6px 0; color: var(--accent-text); font-size: 0.875rem; }
  .lb-empty { margin: 0; padding: 14px 16px; border-radius: var(--radius-inner); background: var(--raised); border: 1px solid var(--border); color: var(--muted); font-size: 0.9375rem; }

  .lb-filter { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -2px; padding: 2px; }
  .lb-filter::-webkit-scrollbar { display: none; }
  .lb-pill {
    flex-shrink: 0;
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    scroll-snap-align: start;
    -webkit-tap-highlight-color: transparent;
  }
  .lb-pill[aria-pressed='true'] { background: var(--text); color: var(--ground); }
  .lb-pill:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 2px; }

  .lb-list { margin: 0; padding: 4px; list-style: none; border-radius: var(--radius-inner); background: var(--raised); border: 1px solid var(--border); }
  .lb-row {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr) 2.75rem 2.75rem 3.25rem;
    align-items: center;
    gap: 8px;
    min-height: 52px;
    padding: 6px 10px;
    border-radius: 10px;
  }
  .lb-row--compact { grid-template-columns: 1.5rem minmax(0, 1fr) 2.75rem 2.75rem; }
  /* Schmal: Quote ausblenden, damit Namen Platz haben. */
  @container (max-width: 380px) {
    .lb-row { grid-template-columns: 1.25rem minmax(0, 1fr) 2.5rem 2.75rem; gap: 6px; }
    .lb-rate { display: none; }
  }
  .lb-row--head { min-height: 28px; font-size: 0.75rem; font-weight: 600; color: var(--muted); }
  .lb-row.is-me:not(.lb-row--head) { background: var(--accent-soft); }
  .lb-pos { font-size: 0.9375rem; font-weight: 600; color: var(--muted); }
  .lb-who { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .lb-whotext { display: flex; flex-direction: column; min-width: 0; }
  .lb-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9375rem; font-weight: 600; }
  .lb-you { font-weight: 500; color: var(--muted); }
  .lb-fav { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8125rem; color: var(--muted); }
  .lb-num { text-align: right; font-variant-numeric: tabular-nums; }
  .lb-score { font-size: 1.0625rem; font-weight: 600; }

  .lb-recent { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .lb-subtitle { margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--muted); }
  .lb-recent-list { margin: 0; padding: 0; list-style: none; }
  .lb-game { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; padding: 6px 0; }
  .lb-game + .lb-game { border-top: 1px solid var(--border); }
  .lb-game-main { display: flex; flex-direction: column; min-width: 0; }
  .lb-game-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9375rem; font-weight: 600; }
  .lb-game-time { font-size: 0.8125rem; color: var(--muted); }
  .lb-game-result { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 55%; }
  .lb-game-winner { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem; font-weight: 500; }
  .lb-game-winner.is-former { color: var(--muted); font-style: italic; }

  .lb-dialog { max-width: 560px; padding-top: 16px; }
  .lb-dialog-close { display: flex; justify-content: flex-end; margin: 0 -8px -36px 0; position: relative; z-index: 1; }
  .lb-dialog :global(.lb-head) { padding-right: 44px; min-height: 44px; }

  @media (hover: hover) and (pointer: fine) {
    .lb-pill:hover:not([aria-pressed='true']) { background: color-mix(in srgb, var(--surface-2) 70%, var(--control)); }
  }
</style>
