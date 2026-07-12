<script lang="ts">
  import type { NochMalPlayer } from '../types.ts';
  export let players: NochMalPlayer[] = [];
  export let activePlayerId = '';
  export let actingPlayerId = '';
  export let onSelectPlayer: (id: string) => void = () => {};
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
  <h2 class="text-lg font-semibold text-slate-950">Spieler</h2>
  <div class="mt-3 space-y-2">
    {#each players as player (player.id)}
      <button type="button" on:click={() => onSelectPlayer(player.id)} class="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition hover:border-cyan-300 {player.id === actingPlayerId ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-slate-50'}">
        <span class="min-w-0">
          <span class="block truncate font-semibold text-slate-950">{player.name}{player.isAi ? ' (KI)' : ''}</span>
          <span class="text-xs text-slate-500">{player.id === activePlayerId ? 'aktiv' : 'passiv'} · Joker {player.usedJokers}/8</span>
        </span>
        <span class="rounded-md bg-white px-2 py-1 text-sm font-semibold ring-1 ring-slate-200">{player.score.total}</span>
      </button>
    {/each}
  </div>
</div>


