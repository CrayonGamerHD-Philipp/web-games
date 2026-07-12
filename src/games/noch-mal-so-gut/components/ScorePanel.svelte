<script lang="ts">
  import type { NochMalPlayer } from '../types.ts';
  import { formatScore } from '../logic/board.ts';
  export let player: NochMalPlayer | null = null;
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
  <h2 class="text-lg font-semibold text-slate-950">Wertung</h2>
  {#if player}
    <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
      <p class="rounded-md bg-slate-50 px-3 py-2">Spalten <span class="float-right font-semibold">{formatScore(player.score.columnPoints)}</span></p>
      <p class="rounded-md bg-slate-50 px-3 py-2">Reihen <span class="float-right font-semibold">{formatScore(player.score.rowPoints)}</span></p>
      <p class="rounded-md bg-slate-50 px-3 py-2">Farben <span class="float-right font-semibold">{formatScore(player.score.colorPoints)}</span></p>
      <p class="rounded-md bg-slate-50 px-3 py-2">Bonus <span class="float-right font-semibold">{formatScore(player.score.bonusPoints)}</span></p>
      <p class="rounded-md bg-rose-50 px-3 py-2 text-rose-900">Sterne <span class="float-right font-semibold">{player.score.starPenalty}</span></p>
      <p class="rounded-md bg-rose-50 px-3 py-2 text-rose-900">Joker <span class="float-right font-semibold">-{player.score.jokerPenalty}</span></p>
    </div>
    <div class="mt-3 rounded-md bg-slate-950 px-4 py-3 text-white">
      <span class="text-sm opacity-80">Gesamt</span>
      <span class="float-right text-xl font-semibold">{player.score.total}</span>
    </div>
  {/if}
</div>


