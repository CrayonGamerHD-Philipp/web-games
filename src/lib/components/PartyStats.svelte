<script>
  // Statistik über alle Runden der Party: Überblick, Summen pro Spieler (gesamt oder je Spiel) und Rundenprotokoll.
  import { ChevronDown } from '@lucide/svelte';
  import PlayerAvatar from './PlayerAvatar.svelte';
  import RoundStatsTable from './RoundStatsTable.svelte';
  import { playerHex } from '$lib/player-colors.js';
  import { GAME_STATS, TURNS_STAT, formatDuration, formatStat } from '$lib/round-stats.js';

  /** @typedef {import('$lib/round-stats.js').RoundRecord} RoundRecord */
  /** @typedef {import('$lib/round-stats.js').StatDef} StatDef */
  /** @typedef {{ id: string, name: string, color?: string, avatar?: import('$lib/party-features.js').Avatar | null }} StatsPlayer */

  /** @type {RoundRecord[]} */
  export let rounds = [];
  /** @type {StatsPlayer[]} */
  export let players = [];
  export let currentPlayerId = '';
  export let title = 'Statistik';
  /** @type {'h2' | 'h3'} */
  export let headingLevel = 'h2';
  /** Ohne Rundenprotokoll (z. B. auf dem Ergebnis-Screen) */
  export let compact = false;
  export let idPrefix = 'party-stats';

  let filter = 'all';

  $: list = (rounds ?? []).filter((round) => round && Array.isArray(round.players));
  $: games = uniqueGames(list);
  $: if (filter !== 'all' && !games.some((game) => game.id === filter)) filter = 'all';
  // Nur ein Spiel gespielt: gleich dessen eigene Werte zeigen.
  $: if (games.length === 1) filter = games[0].id;
  $: filtered = filter === 'all' ? list : list.filter((round) => round.gameId === filter);
  $: overview = computeOverview(filtered, games, filter);
  $: columns = columnsFor(filter, filtered);
  $: rows = computeRows(filtered, columns, players);
  $: recent = [...filtered].reverse().slice(0, 10);

  /** @param {RoundRecord[]} source */
  function uniqueGames(source) {
    /** @type {Map<string, { id: string, name: string, count: number }>} */
    const map = new Map();
    for (const round of source) {
      const entry = map.get(round.gameId) ?? { id: round.gameId, name: round.gameName, count: 0 };
      entry.count += 1;
      map.set(round.gameId, entry);
    }
    return [...map.values()];
  }

  /**
   * @param {RoundRecord[]} source
   * @param {{ id: string, name: string, count: number }[]} gameList
   * @param {string} activeFilter
   */
  function computeOverview(source, gameList, activeFilter) {
    const duration = source.reduce((sum, round) => sum + (round.durationMs ?? 0), 0);
    const turns = source.reduce((sum, round) => sum + round.players.reduce((inner, player) => inner + (player.stats.turns ?? 0), 0), 0);
    const favourite = [...gameList].sort((a, b) => b.count - a.count)[0];
    const longest = source.reduce((max, round) => Math.max(max, round.durationMs ?? 0), 0);
    return [
      { label: 'Runden', value: String(source.length) },
      { label: 'Spielzeit', value: formatDuration(duration) },
      turns ? { label: 'Züge', value: formatStat(turns) } : null,
      activeFilter === 'all' && favourite ? { label: 'Meistgespielt', value: favourite.name } : { label: 'Längste Runde', value: formatDuration(longest) }
    ].filter(Boolean);
  }

  /**
   * Spalten: Runden + Siege immer; gesamt zusätzlich Züge, je Spiel dessen eigene Werte.
   * Punkte und Quoten werden gemittelt, Zähler summiert.
   * @param {string} activeFilter
   * @param {RoundRecord[]} source
   * @returns {(StatDef & { mode: 'sum' | 'avg' })[]}
   */
  function columnsFor(activeFilter, source) {
    const hasTurns = source.some((round) => round.players.some((player) => (player.stats.turns ?? 0) > 0));
    /** @type {StatDef[]} */
    const defs = activeFilter === 'all' ? [] : GAME_STATS[activeFilter] ?? [];
    return [...(hasTurns ? [TURNS_STAT] : []), ...defs].map((def) => {
      const mode = def.format === 'points' || def.format === 'percent' ? 'avg' : 'sum';
      return { ...def, label: mode === 'avg' ? `Ø ${def.label}` : def.label, mode };
    });
  }

  /**
   * @param {RoundRecord[]} source
   * @param {(StatDef & { mode: 'sum' | 'avg' })[]} cols
   * @param {StatsPlayer[]} partyPlayers
   */
  function computeRows(source, cols, partyPlayers) {
    /** @type {Map<string, { id: string, name: string, player: StatsPlayer | undefined, rounds: number, wins: number, sums: Record<string, number> }>} */
    const map = new Map();
    for (const round of source) {
      for (const entry of round.players) {
        const row = map.get(entry.id) ?? {
          id: entry.id,
          name: entry.name,
          player: partyPlayers.find((player) => player.id === entry.id),
          rounds: 0,
          wins: 0,
          sums: {}
        };
        row.rounds += 1;
        if (!round.isDraw && round.winnerIds.includes(entry.id)) row.wins += 1;
        for (const col of cols) row.sums[col.key] = (row.sums[col.key] ?? 0) + (entry.stats[col.key] ?? 0);
        map.set(entry.id, row);
      }
    }
    return [...map.values()]
      .map((row) => ({
        ...row,
        name: row.player?.name ?? row.name,
        values: Object.fromEntries(cols.map((col) => [col.key, col.mode === 'avg' ? (row.sums[col.key] ?? 0) / Math.max(1, row.rounds) : row.sums[col.key] ?? 0]))
      }))
      .sort((a, b) => b.wins - a.wins || b.rounds - a.rounds || a.name.localeCompare(b.name));
  }

  /** @param {number} value @param {StatDef & { mode: 'sum' | 'avg' }} col */
  function formatValue(value, col) {
    if (col.mode === 'avg' && col.format !== 'percent') return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value);
    return formatStat(value, col.format);
  }

  /** @param {RoundRecord} round */
  function winnerText(round) {
    if (round.isDraw || !round.winnerIds.length) return 'Unentschieden';
    return round.winnerIds
      .map((id) => (id === currentPlayerId ? 'Du' : players.find((player) => player.id === id)?.name ?? round.players.find((player) => player.id === id)?.name ?? 'Jemand'))
      .join(', ');
  }

  /** @param {string} iso */
  function clock(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="ps">
  <svelte:element this={headingLevel} id={`${idPrefix}-title`} class="ui-section-title">{title}</svelte:element>

  {#if !list.length}
    <p class="ps-empty">Noch keine Runde beendet. Nach jeder Runde erscheinen hier Züge, Karten, Treffer und mehr.</p>
  {:else}
    {#if games.length > 1}
      <div class="ps-filter touch-scroll-x" role="group" aria-label="Statistik nach Spiel filtern">
        <button type="button" class="ps-pill" aria-pressed={filter === 'all'} on:click={() => (filter = 'all')}>Alle</button>
        {#each games as game (game.id)}
          <button type="button" class="ps-pill" aria-pressed={filter === game.id} on:click={() => (filter = game.id)}>{game.name}</button>
        {/each}
      </div>
    {/if}

    <dl class="ps-overview">
      {#each overview as item (item?.label)}
        {#if item}
          <div class="ps-tile">
            <dt>{item.label}</dt>
            <dd class="ui-num">{item.value}</dd>
          </div>
        {/if}
      {/each}
    </dl>

    <div class="ps-scroll touch-scroll-x">
      <table class="ps-table" aria-labelledby={`${idPrefix}-title`}>
        <thead>
          <tr>
            <th scope="col">Spieler</th>
            <th scope="col" class="ps-num">Runden</th>
            <th scope="col" class="ps-num">Siege</th>
            {#each columns as col (col.key)}
              <th scope="col" class="ps-num">{col.label}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.id)}
            <tr class:is-me={row.id === currentPlayerId}>
              <th scope="row">
                <span class="ps-who">
                  <PlayerAvatar avatar={row.player?.avatar ?? null} name={row.name} color={playerHex(row.player?.color)} size={26} />
                  <span class="ps-name" class:is-former={!row.player}>{row.name}{#if row.id === currentPlayerId}<span class="ps-you">&nbsp;· du</span>{/if}</span>
                </span>
              </th>
              <td class="ps-num ui-num">{row.rounds}</td>
              <td class="ps-num ui-num ps-strong">{row.wins}</td>
              {#each columns as col (col.key)}
                <td class="ps-num ui-num">{formatValue(row.values[col.key], col)}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if !compact}
      <div class="ps-log">
        <h3 class="ps-subtitle">Runden im Detail</h3>
        <ul class="ps-log-list">
          {#each recent as round (round.id + round.finishedAt)}
            <li>
              <details class="ps-round">
                <summary>
                  <span class="ps-round-main">
                    <span class="ps-round-name">{round.gameName}{#if round.round} · Runde {round.round}{/if}</span>
                    <span class="ps-round-meta ui-num">{clock(round.finishedAt)} · {formatDuration(round.durationMs)}</span>
                  </span>
                  <span class="ps-round-winner">{winnerText(round)}</span>
                  <ChevronDown class="ps-chevron" size={18} aria-hidden="true" />
                </summary>
                <div class="ps-round-body">
                  <RoundStatsTable {round} {players} {currentPlayerId} />
                </div>
              </details>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</div>

<style>
  .ps { display: flex; flex-direction: column; gap: 12px; color: var(--text); }
  .ps-empty { margin: 0; padding: 14px 16px; border-radius: var(--radius-inner); background: var(--raised); border: 1px solid var(--border); color: var(--muted); font-size: 0.9375rem; }

  .ps-filter { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -2px; padding: 2px; }
  .ps-filter::-webkit-scrollbar { display: none; }
  .ps-pill {
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
    -webkit-tap-highlight-color: transparent;
  }
  .ps-pill[aria-pressed='true'] { background: var(--text); color: var(--ground); }
  .ps-pill:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 2px; }

  .ps-overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 7.5rem), 1fr)); gap: 8px; margin: 0; }
  .ps-tile { min-width: 0; padding: 10px 12px; border-radius: var(--radius-inner); background: var(--surface); }
  .ps-tile dt { font-size: 0.8125rem; color: var(--muted); }
  .ps-tile dd { margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1.0625rem; font-weight: 600; }

  .ps-scroll { overflow-x: auto; border-radius: var(--radius-inner); background: var(--raised); border: 1px solid var(--border); }
  .ps-table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
  .ps-table th, .ps-table td { padding: 8px 12px; text-align: left; white-space: nowrap; }
  .ps-table thead th { font-size: 0.75rem; font-weight: 600; color: var(--muted); }
  .ps-table tbody tr { border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent); }
  .ps-table tbody tr.is-me { background: var(--accent-soft); }
  .ps-table tbody th { font-weight: 600; }
  .ps-num { text-align: right !important; font-variant-numeric: tabular-nums; }
  .ps-strong { font-weight: 600; }
  .ps-who { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .ps-name { max-width: 10rem; overflow: hidden; text-overflow: ellipsis; }
  .ps-name.is-former { color: var(--muted); font-style: italic; }
  .ps-you { font-weight: 500; color: var(--muted); }

  .ps-log { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .ps-subtitle { margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--muted); }
  .ps-log-list { margin: 0; padding: 0; list-style: none; }
  .ps-log-list > li + li { border-top: 1px solid var(--border); }
  .ps-round summary {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 6px 0;
    list-style: none;
    cursor: pointer;
  }
  .ps-round summary::-webkit-details-marker { display: none; }
  .ps-round summary:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 2px; border-radius: 8px; }
  .ps-round-main { display: flex; flex: 1; flex-direction: column; min-width: 0; }
  .ps-round-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9375rem; font-weight: 600; }
  .ps-round-meta { font-size: 0.8125rem; color: var(--muted); }
  .ps-round-winner { max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem; font-weight: 500; }
  .ps-round :global(.ps-chevron) { flex-shrink: 0; color: var(--muted); transition: transform 150ms ease; }
  .ps-round[open] :global(.ps-chevron) { transform: rotate(180deg); }
  .ps-round-body { padding: 4px 0 14px; }
  @media (prefers-reduced-motion: reduce) { .ps-round :global(.ps-chevron) { transition: none; } }
</style>
