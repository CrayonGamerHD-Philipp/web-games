<script>
  // Statistik einer Runde: Werte als Zeilen, Spieler als Spalten; Bestwerte sind hervorgehoben.
  import PlayerAvatar from './PlayerAvatar.svelte';
  import { playerHex } from '$lib/player-colors.js';
  import { bestPlayerIds, formatDuration, formatStat, statDefsFor } from '$lib/round-stats.js';

  /** @typedef {import('$lib/round-stats.js').RoundRecord} RoundRecord */
  /** @typedef {{ id: string, name: string, color?: string, avatar?: import('$lib/party-features.js').Avatar | null }} StatsPlayer */

  /** @type {RoundRecord} */
  export let round;
  /** @type {StatsPlayer[]} */
  export let players = [];
  export let currentPlayerId = '';
  /** Kopfzeile mit Dauer und Zügen anzeigen */
  export let showMeta = true;

  $: defs = statDefsFor(round);
  $: totalTurns = round.players.reduce((sum, player) => sum + (player.stats.turns ?? 0), 0);
  $: best = new Map(defs.map((def) => [def.key, bestPlayerIds(round.players, def)]));

  /** @param {string} id */
  function partyPlayer(id) {
    return players.find((player) => player.id === id);
  }
</script>

<div class="rs">
  {#if showMeta}
    <p class="rs-meta ui-num">
      <span>Dauer {formatDuration(round.durationMs)}</span>
      {#if totalTurns}<span aria-hidden="true">·</span><span>{totalTurns} Züge</span>{/if}
      {#if round.round}<span aria-hidden="true">·</span><span>Runde {round.round}</span>{/if}
    </p>
  {/if}

  {#if defs.length}
    <div class="rs-scroll touch-scroll-x">
      <table class="rs-table">
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">Wert</span></th>
            {#each round.players as player (player.id)}
              {@const pp = partyPlayer(player.id)}
              <th scope="col" class="rs-player" class:is-winner={round.winnerIds.includes(player.id)}>
                <span class="rs-player-inner">
                  <PlayerAvatar avatar={pp?.avatar ?? null} name={player.name} color={playerHex(pp?.color)} size={26} />
                  <span class="rs-player-name">{player.id === currentPlayerId ? 'Du' : player.name}</span>
                </span>
                {#if round.winnerIds.includes(player.id)}<span class="sr-only">, Sieger</span>{/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each defs as def (def.key)}
            {@const bestIds = best.get(def.key) ?? new Set()}
            <tr>
              <th scope="row">{def.label}</th>
              {#each round.players as player (player.id)}
                <td class="rs-num ui-num" class:is-best={bestIds.has(player.id)}>
                  {formatStat(player.stats[def.key], def.format)}{#if bestIds.has(player.id)}<span class="sr-only"> (Bestwert)</span>{/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .rs { display: flex; flex-direction: column; gap: 8px; }
  .rs-meta { display: flex; flex-wrap: wrap; gap: 4px 8px; margin: 0; font-size: 0.875rem; color: var(--muted); }

  .rs-scroll { overflow-x: auto; border-radius: var(--radius-inner); background: var(--surface); }
  .rs-table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
  .rs-table th, .rs-table td { padding: 9px 12px; text-align: left; white-space: nowrap; }
  .rs-table thead th { vertical-align: bottom; font-size: 0.8125rem; font-weight: 600; color: var(--muted); }
  .rs-table tbody tr { border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent); }
  .rs-table tbody th { font-weight: 500; color: var(--muted); }

  .rs-player { text-align: right !important; }
  .rs-player-inner { display: inline-flex; align-items: center; gap: 6px; max-width: 9rem; }
  .rs-player-name { overflow: hidden; text-overflow: ellipsis; color: var(--text); }
  .rs-player.is-winner .rs-player-name { color: var(--accent-text); }

  .rs-num { text-align: right !important; font-variant-numeric: tabular-nums; color: var(--text); }
  .rs-num.is-best { font-weight: 700; color: var(--accent-text); }
</style>
