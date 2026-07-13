<script lang="ts">
  import { RotateCcw } from '@lucide/svelte';
  import { bottomScore, cells, jokerCount, letters, rows, topScore } from '../data/board';
  import type { NochMalColor, NochMalSession } from '../types';

  export let game: NochMalSession | null = null;
  export let isLoading = false;
  export let onMove: (move: Record<string, unknown>) => void = () => {};

  let localCheckedCells: string[] = [];
  let localUsedJokers: number[] = [];

  $: checkedCells = game?.state.checkedCells ?? localCheckedCells;
  $: usedJokers = game?.state.usedJokers ?? localUsedJokers;
  $: checkedSet = new Set(checkedCells);
  $: usedJokerSet = new Set(usedJokers);
  $: completedColumnScore = bottomScore.reduce((sum, value, column) => {
    const complete = rows.every((_, row) => checkedSet.has(`${row}-${column}`));
    return sum + (complete ? value : 0);
  }, 0);
  $: jokerScore = usedJokers.length;
  $: starScore = cells.filter((cell) => cell.hasStar && !checkedSet.has(cell.id)).length * -2;
  $: totalScore = completedColumnScore + jokerScore + starScore;

  const colorClass: Record<NochMalColor, string> = {
    lime: 'bg-[#b8d86e] text-[#42691f]',
    yellow: 'bg-[#ffd85c] text-[#7d5a00]',
    blue: 'bg-[#8fcbed] text-[#155f86]',
    pink: 'bg-[#cf3f79] text-[#6f173d]',
    peach: 'bg-[#e79a4e] text-[#70320d]'
  };

  const bonusRows: { color: NochMalColor; text: string }[] = [
    { color: 'lime', text: 'Grün' },
    { color: 'yellow', text: 'Gelb' },
    { color: 'blue', text: 'Blau' },
    { color: 'pink', text: 'Pink' },
    { color: 'peach', text: 'Orange' }
  ];

  function sendOrApply(move: Record<string, unknown>) {
    if (game) {
      onMove(move);
      return;
    }

    if (move.type === 'toggle-cell' && typeof move.cellId === 'string') {
      localCheckedCells = localCheckedCells.includes(move.cellId)
        ? localCheckedCells.filter((id) => id !== move.cellId)
        : [...localCheckedCells, move.cellId];
    }

    if (move.type === 'toggle-joker' && typeof move.jokerIndex === 'number') {
      localUsedJokers = localUsedJokers.includes(move.jokerIndex)
        ? localUsedJokers.filter((index) => index !== move.jokerIndex)
        : [...localUsedJokers, move.jokerIndex];
    }

    if (move.type === 'reset') {
      localCheckedCells = [];
      localUsedJokers = [];
    }
  }
</script>

<section class="w-full overflow-hidden rounded-lg border border-slate-200 bg-[#0b1b22] p-3 text-white shadow-sm sm:p-5 lg:p-7">
  <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div class="min-w-0">
      <p class="text-xs font-bold uppercase tracking-[0.22em] text-[#e68b2f]">Basic</p>
      <h2 class="text-2xl font-semibold leading-tight sm:text-3xl">Noch mal</h2>
    </div>
    <button
      type="button"
      disabled={isLoading}
      on:click={() => sendOrApply({ type: 'reset' })}
      class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-[#e68b2f]/25 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RotateCcw size={18} />
      Zurücksetzen
    </button>
  </header>

  <div class="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_12rem]">
    <div class="min-w-0">
      <div class="w-full overflow-x-auto pb-2">
        <div class="mx-auto min-w-[46rem] max-w-[98rem]">
          <div class="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
            {#each letters as letter, index (letter)}
              <div class="grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-sm font-black text-slate-950 shadow-sm sm:text-lg {index === 7 ? 'text-red-500 ring-2 ring-[#e68b2f]' : ''}">{letter}</div>
            {/each}
          </div>

          <div class="mt-2 overflow-hidden rounded-lg border border-white/15">
            <div class="grid grid-cols-[repeat(15,minmax(0,1fr))]">
              {#each cells as cell (cell.id)}
                {@const checked = checkedSet.has(cell.id)}
                <button
                  type="button"
                  aria-label={`Feld ${letters[cell.column]}, Reihe ${cell.row + 1}`}
                  aria-pressed={checked}
                  disabled={isLoading}
                  on:click={() => sendOrApply({ type: 'toggle-cell', cellId: cell.id })}
                  class="relative aspect-square min-w-0 border-b border-r border-slate-950/20 transition hover:brightness-105 focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white disabled:cursor-not-allowed {colorClass[cell.color]}"
                >
                  {#if cell.hasStar}
                    <span class="pointer-events-none absolute inset-0 grid place-items-center text-xl font-black text-white drop-shadow sm:text-3xl {checked ? 'opacity-25' : ''}">?</span>
                  {/if}
                  {#if checked}
                    <span class="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-3/4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white shadow"></span>
                    <span class="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-3/4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white shadow"></span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <div class="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
            {#each topScore as value, index (`top-${index}`)}
              <div class="grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-sm font-black shadow-sm sm:text-lg {index === 7 ? 'text-red-500' : 'text-slate-950'}">{value}</div>
            {/each}
          </div>
          <div class="mt-1 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
            {#each bottomScore as value, index (`bottom-${index}`)}
              <div class="grid aspect-[1.2/1] place-items-center rounded-md bg-[#f7f5ea] text-sm font-black shadow-sm sm:text-lg {index === 7 ? 'text-red-500' : 'text-slate-950'}">{value}</div>
            {/each}
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-md bg-[#f7f5ea] text-2xl font-black text-slate-950 shadow-sm">?</div>
        <span class="text-3xl font-black">/</span>
        <div class="grid h-10 w-10 place-items-center rounded-md bg-[#f7f5ea] text-xl font-black text-slate-950 shadow-sm">X</div>
        <span class="text-3xl font-black">=</span>
        <div class="flex flex-wrap gap-2">
          {#each Array.from({ length: jokerCount }) as _, index (index)}
            <button
              type="button"
              aria-label={`Joker ${index + 1}`}
              aria-pressed={usedJokerSet.has(index)}
              disabled={isLoading}
              on:click={() => sendOrApply({ type: 'toggle-joker', jokerIndex: index })}
              class="grid h-10 w-10 place-items-center rounded-md bg-[#f7f5ea] text-xl font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#e68b2f]/25 disabled:cursor-not-allowed {usedJokerSet.has(index) ? 'scale-95 opacity-30' : ''}"
            >!</button>
          {/each}
        </div>
      </div>
    </div>

    <aside class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
      <div class="rounded-lg bg-white/5 p-3">
        <div class="mb-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-white/60">Farbbonus</div>
        <div class="grid grid-cols-2 gap-1.5 text-center text-lg font-black">
          {#each bonusRows as row (row.color)}
            <div class="rounded-md py-2 {colorClass[row.color]}">5</div>
            <div class="rounded-md py-2 {colorClass[row.color]}">3</div>
          {/each}
        </div>
      </div>

      <div class="rounded-lg bg-white/5 p-3 text-sm font-semibold">
        <div class="grid grid-cols-[1fr_4rem] items-center gap-2 border-b border-dashed border-white/20 py-2"><span>Bonus</span><output class="rounded-md bg-white px-2 py-1.5 text-right text-slate-950">0</output></div>
        <div class="grid grid-cols-[1fr_4rem] items-center gap-2 border-b border-dashed border-white/20 py-2"><span>A-O</span><output class="rounded-md bg-white px-2 py-1.5 text-right text-slate-950">{completedColumnScore}</output></div>
        <div class="grid grid-cols-[1fr_4rem] items-center gap-2 border-b border-dashed border-white/20 py-2"><span>Joker</span><output class="rounded-md bg-white px-2 py-1.5 text-right text-slate-950">{jokerScore}</output></div>
        <div class="grid grid-cols-[1fr_4rem] items-center gap-2 border-b border-dashed border-white/20 py-2"><span>Sterne</span><output class="rounded-md bg-white px-2 py-1.5 text-right text-slate-950">{starScore}</output></div>
        <div class="grid grid-cols-[1fr_4rem] items-center gap-2 pt-3 text-base"><span>Total</span><output class="rounded-md bg-[#e68b2f] px-2 py-1.5 text-right text-white">{totalScore}</output></div>
      </div>
    </aside>
  </div>
</section>
