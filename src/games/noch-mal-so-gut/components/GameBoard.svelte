<script lang="ts">
  import type { BoardCell as Cell, BoardLayout, CellColor } from '../types.ts';
  import { colorClasses, colorLabels, colorSymbols } from '../data/gameConfig.ts';
  import BoardCell from './BoardCell.svelte';

  export let board: Cell[][];
  export let layout: BoardLayout;
  export let selectableIds: string[] = [];
  export let selectedIds: string[] = [];
  export let showSymbols = true;
  export let onCellClick: (cell: Cell) => void = () => {};

  const colors: CellColor[] = ['green', 'yellow', 'blue', 'purple', 'red'];

  $: selectable = new Set(selectableIds);
  $: selected = new Set(selectedIds);
</script>

<div class="overflow-x-auto pb-3">
  <div class="sheet min-w-[58rem] rounded-xl border border-stone-300 bg-stone-300 p-4 shadow-inner">
    <div class="grid gap-1" style={`grid-template-columns: 3.4rem repeat(${layout.columns}, minmax(2.8rem, 1fr)) 2.7rem;`}>
      <div class="h-11"></div>
      {#each layout.columnLabels as label, column}
        <div class="flex h-11 flex-col items-center justify-center rounded-md border border-white/70 bg-white text-slate-900 shadow-sm {column === layout.startColumn ? 'ring-4 ring-white' : ''}">
          <span class="text-xl font-black leading-none {column === layout.startColumn ? 'text-rose-600' : ''}">{label}</span>
        </div>
      {/each}
      <div></div>

      {#each board as row, rowIndex}
        <div class="flex h-full flex-col items-center justify-center gap-1 rounded-md bg-stone-200 px-1 py-1 text-center shadow-sm">
          <span class="text-lg font-black text-rose-700">{layout.rowScores[rowIndex]}</span>
          <span class="text-[0.7rem] font-semibold uppercase tracking-wide text-stone-600">Reihe</span>
        </div>
        {#each row as cell (cell.id)}
          <div class="relative {cell.column === layout.startColumn ? 'rounded-md bg-white p-0.5' : ''}">
            <BoardCell
              {cell}
              {showSymbols}
              selectable={selectable.has(cell.id)}
              selected={selected.has(cell.id)}
              label={`${layout.columnLabels[cell.column]} ${layout.rowLabels[cell.row]}`}
              onChoose={onCellClick}
            />
          </div>
        {/each}
        <div class="flex items-center justify-center rounded-md border border-white/70 bg-white text-xl font-black text-slate-900 shadow-sm">
          {layout.rowLabels[rowIndex]}
        </div>
      {/each}

      <div></div>
      {#each layout.columnScoresFirst as score, column}
        <div class="rounded-md border border-white/70 bg-white px-1 py-1 text-center shadow-sm {column === layout.startColumn ? 'bg-rose-50 text-rose-700' : ''}">
          <div class="text-base font-black">{score}</div>
          <div class="text-xs font-semibold text-stone-500">{layout.columnScoresLater[column]}</div>
        </div>
      {/each}
      <div></div>

      <div></div>
      {#each layout.columnScoresLater as score, column}
        <div class="rounded-md border border-white/70 bg-white px-1 py-1 text-center shadow-sm">
          <div class="text-sm font-black text-slate-800">{score}</div>
          <div class="text-[0.62rem] font-semibold text-stone-500">später</div>
        </div>
      {/each}
      <div></div>
    </div>

    <div class="mt-4 grid gap-3 lg:grid-cols-[1fr_18rem]">
      <div class="rounded-lg border border-white/70 bg-stone-200/80 p-3 shadow-sm">
        <p class="text-xs font-black uppercase tracking-[0.18em] text-stone-600">Farbbonus</p>
        <div class="mt-2 grid grid-cols-5 gap-2">
          {#each colors as color}
            <div class="rounded-md border px-2 py-2 text-center text-sm font-black shadow-sm {colorClasses[color]}">
              <span class="block text-lg">{colorSymbols[color]}</span>
              <span class="block text-[0.65rem]">{colorLabels[color]}</span>
              <span class="block text-xs">5 / 3</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="rounded-lg border border-white/70 bg-stone-200/80 p-3 shadow-sm">
        <p class="text-xs font-black uppercase tracking-[0.18em] text-stone-600">Bonus & Malus</p>
        <div class="mt-2 space-y-2 text-sm font-semibold text-slate-800">
          <div class="flex items-center justify-between rounded-md bg-white px-3 py-2"><span>Joker</span><span>! -2 ab 3</span></div>
          <div class="flex items-center justify-between rounded-md bg-white px-3 py-2"><span>Sterne</span><span>★ -2</span></div>
          <div class="flex items-center justify-between rounded-md bg-white px-3 py-2"><span>Start</span><span>Spalte H</span></div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .sheet {
    background-image: radial-gradient(circle at 18% 12%, rgba(255,255,255,0.35), transparent 18%), linear-gradient(135deg, #d7d1c7, #bdb5a9);
  }
</style>
