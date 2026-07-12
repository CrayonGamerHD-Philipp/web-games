<script lang="ts">
  export let round = 1;
  export let phase = '';
  export let activeName = '';
  export let actingName = '';
</script>

<div class="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-cyan-950">
  <p class="text-xs font-semibold uppercase tracking-[0.16em]">Runde {round} · {phase}</p>
  <p class="mt-1 text-sm leading-6">Aktiv: <span class="font-semibold">{activeName}</span>. Am Zug: <span class="font-semibold">{actingName}</span>.</p>
</div>


