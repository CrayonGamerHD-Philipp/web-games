<script lang="ts">
  import type { BoardCell } from '../types.ts';
  import { colorClasses, colorSymbols } from '../data/gameConfig.ts';

  export let cell: BoardCell;
  export let selectable = false;
  export let selected = false;
  export let preview = false;
  export let showSymbols = true;
  export let label = '';
  export let onChoose: (cell: BoardCell) => void = () => {};
</script>

<button
  type="button"
  aria-label={label || `Feld ${cell.row + 1}, ${cell.column + 1}`}
  disabled={!selectable && !selected}
  on:click={() => onChoose(cell)}
  class="cell relative flex aspect-square min-h-12 min-w-12 items-center justify-center overflow-hidden rounded-md border-2 text-base font-black transition duration-200 focus:outline-none focus:ring-4 focus:ring-cyan-100 {colorClasses[cell.color]} {cell.marked ? 'marked shadow-inner' : 'shadow-sm'} {selectable ? 'selectable ring-2 ring-cyan-500 hover:-translate-y-0.5 hover:shadow-lg' : ''} {selected ? 'selected scale-[1.06] ring-4 ring-slate-950' : ''} {preview ? 'ring-4 ring-emerald-300' : ''} disabled:cursor-default disabled:saturate-[0.85]"
>
  <span class="absolute inset-0 cell-texture"></span>
  {#if cell.marked}
    <span class="absolute inset-1 rounded bg-white/65 mark-wash"></span>
    <span class="relative z-10 grid h-7 w-7 place-items-center rounded-full bg-slate-950 text-sm text-white shadow-sm">✓</span>
  {:else if showSymbols}
    <span class="relative z-10 rounded bg-white/35 px-1.5 py-0.5 leading-none">{colorSymbols[cell.color]}</span>
  {/if}
  {#if cell.hasStar}
    <span class="absolute left-1 top-1 z-20 grid h-5 w-5 place-items-center rounded-full border border-white/80 bg-white/55 text-[0.75rem] text-slate-900 shadow-sm" aria-label="Sternfeld">★</span>
  {/if}
  {#if selectable && !selected && !cell.marked}
    <span class="absolute bottom-1 right-1 z-20 h-2 w-2 rounded-full bg-cyan-700 shadow-sm"></span>
  {/if}
</button>

<style>
  .cell-texture {
    background: radial-gradient(circle at 28% 24%, rgba(255,255,255,0.34), transparent 28%), repeating-linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.12) 2px, transparent 2px, transparent 8px);
    opacity: 0.75;
  }

  .selectable {
    animation: cell-nudge 1.35s ease-in-out infinite;
  }

  .selected {
    animation: cell-pop 160ms ease-out;
  }

  .marked .mark-wash {
    animation: mark-in 220ms ease-out;
  }

  @keyframes cell-nudge {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }

  @keyframes cell-pop {
    from { transform: scale(0.92); }
    to { transform: scale(1.06); }
  }

  @keyframes mark-in {
    from { opacity: 0; transform: scale(0.78); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
