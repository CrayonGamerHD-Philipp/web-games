<script lang="ts">
  import type { NumberDieResult } from '../types.ts';
  export let die: NumberDieResult;
  export let selected = false;
  export let disabled = false;
  export let onSelect: (id: string) => void = () => {};
</script>

<button type="button" disabled={disabled} on:click={() => onSelect(die.id)} class="flex min-h-12 min-w-12 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-lg font-bold text-slate-950 shadow-sm transition hover:border-cyan-300 focus:outline-none focus:ring-4 focus:ring-cyan-100 {selected ? 'ring-4 ring-cyan-300' : ''} disabled:cursor-not-allowed disabled:opacity-45">
  {die.value === 'joker' ? '?' : die.value}
</button>


