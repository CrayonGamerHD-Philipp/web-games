<script lang="ts">
  import type { CellColor, DiceRoll } from '../types.ts';
  import { colorLabels } from '../data/gameConfig.ts';
  import ColorDie from './ColorDie.svelte';
  import NumberDie from './NumberDie.svelte';
  import SpecialDie from './SpecialDie.svelte';

  export let roll: DiceRoll | null = null;
  export let selectedColorDieId = '';
  export let selectedNumberDieId = '';
  export let colorChoice: CellColor = 'yellow';
  export let numberChoice = 1;
  export let rolling = false;
  export let disabledColorIds: string[] = [];
  export let disabledNumberIds: string[] = [];
  export let onRoll: () => void = () => {};
  export let onColorSelect: (id: string) => void = () => {};
  export let onNumberSelect: (id: string) => void = () => {};
  export let onColorChoice: (color: CellColor) => void = () => {};
  export let onNumberChoice: (count: number) => void = () => {};

  let localRolling = false;

  $: isRolling = rolling || localRolling;
  $: selectedReady = Boolean(selectedColorDieId && selectedNumberDieId);

  function rollWithAnimation() {
    if (isRolling) return;
    localRolling = true;
    window.setTimeout(() => {
      onRoll();
      localRolling = false;
    }, 520);
  }
</script>

<div class="dice-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
  <div class="flex items-center justify-between gap-3">
    <div>
      <h2 class="text-lg font-semibold text-slate-950">Wuerfeltisch</h2>
      <p class="mt-1 text-xs font-medium text-slate-500">1 Farbe + 1 Anzahl waehlen, dann Felder markieren.</p>
    </div>
    <button type="button" on:click={rollWithAnimation} class="inline-flex min-h-11 items-center justify-center rounded-md bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-700 disabled:bg-cyan-300" disabled={isRolling}>
      {isRolling ? 'Rollt...' : 'Wuerfeln'}
    </button>
  </div>

  <div class="mt-4 rounded-lg bg-slate-950 p-3 shadow-inner">
    {#if roll}
      <div class="space-y-4 {isRolling ? 'dice-rolling' : ''}">
        <div>
          <div class="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            <span>Farbwuerfel</span>
            <span>{selectedColorDieId ? 'gewaehlt' : 'offen'}</span>
          </div>
          <div class="dice-row flex flex-wrap gap-2">
            {#each roll.colorDice as die, index (die.id)}
              <div class="die-shell" style={`--die-delay: ${index * 80}ms`}>
                <ColorDie die={die} selected={die.id === selectedColorDieId} disabled={disabledColorIds.includes(die.id) || isRolling} onSelect={onColorSelect} />
              </div>
            {/each}
          </div>
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            <span>Zahlenwuerfel</span>
            <span>{selectedNumberDieId ? 'gewaehlt' : 'offen'}</span>
          </div>
          <div class="dice-row flex flex-wrap gap-2">
            {#each roll.numberDice as die, index (die.id)}
              <div class="die-shell" style={`--die-delay: ${index * 90 + 50}ms`}>
                <NumberDie die={die} selected={die.id === selectedNumberDieId} disabled={disabledNumberIds.includes(die.id) || isRolling} onSelect={onNumberSelect} />
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <div class="grid min-h-28 place-items-center rounded-md border border-dashed border-slate-700 text-center text-sm leading-6 text-slate-300">
        Wuerfle, um die erste Kombination zu erzeugen.
      </div>
    {/if}
  </div>

  {#if roll}
    <div class="mt-4 space-y-3">
      <SpecialDie die={roll.specialDie} />
      <div class="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p class="text-sm font-semibold text-slate-950">Joker-Auswahl</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label class="block text-sm font-medium text-slate-700">Farbe bei ?
            <select value={colorChoice} on:change={(event) => onColorChoice(event.currentTarget.value as CellColor)} class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              {#each Object.entries(colorLabels) as [id, label]}
                <option value={id}>{label}</option>
              {/each}
            </select>
          </label>
          <label class="block text-sm font-medium text-slate-700">Anzahl bei ?
            <select value={numberChoice} on:change={(event) => onNumberChoice(Number(event.currentTarget.value))} class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              {#each [1,2,3,4,5] as value}
                <option value={value}>{value}</option>
              {/each}
            </select>
          </label>
        </div>
      </div>
      <div class="rounded-md border px-3 py-2 text-sm {selectedReady ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}">
        {selectedReady ? 'Kombination bereit. Waehle jetzt die passenden zusammenhaengenden Felder.' : 'Waehle einen Farb- und einen Zahlenwuerfel.'}
      </div>
    </div>
  {/if}
</div>

<style>
  .dice-panel {
    background-image: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98));
  }

  .dice-rolling .die-shell {
    animation: dice-tumble 520ms cubic-bezier(.2,.8,.2,1) both;
    animation-delay: var(--die-delay);
  }

  @keyframes dice-tumble {
    0% { transform: translateY(-10px) rotate(-18deg) scale(0.96); filter: blur(0.5px); }
    35% { transform: translateY(6px) rotate(16deg) scale(1.05); }
    70% { transform: translateY(-3px) rotate(-7deg) scale(1.02); }
    100% { transform: translateY(0) rotate(0) scale(1); filter: blur(0); }
  }
</style>
