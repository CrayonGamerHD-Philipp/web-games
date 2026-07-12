<script lang="ts">
  import type { ColorDieResult } from '../types.ts';
  import { colorClasses, colorLabels, colorSymbols } from '../data/gameConfig.ts';
  export let die: ColorDieResult;
  export let selected = false;
  export let disabled = false;
  export let onSelect: (id: string) => void = () => {};
</script>

<button type="button" disabled={disabled} on:click={() => onSelect(die.id)} class="min-h-12 rounded-md border px-3 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-4 focus:ring-cyan-100 {die.value === 'joker' ? 'border-slate-400 bg-slate-900 text-white' : colorClasses[die.value]} {selected ? 'ring-4 ring-cyan-300' : ''} disabled:cursor-not-allowed disabled:opacity-45">
  {#if die.value === 'joker'}
    Farbe ?
  {:else}
    {colorSymbols[die.value]} {colorLabels[die.value]}
  {/if}
  {#if die.reservedBy}<span class="block text-[0.65rem] opacity-70">reserviert</span>{/if}
</button>




