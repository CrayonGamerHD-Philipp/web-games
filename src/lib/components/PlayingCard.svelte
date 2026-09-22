<script>
  import { createEventDispatcher } from 'svelte';

  /** @type {number | null} */
  export let value = null;
  /** @type {boolean} */
  export let hidden = false;
  /** @type {boolean} */
  export let removed = false;
  /** @type {boolean} */
  export let selected = false;
  /** @type {boolean} */
  export let disabled = false;
  /** @type {boolean} */
  export let draggable = false;
  /** @type {boolean} */
  export let dropTarget = false;
  /** @type {string} */
  export let label = 'Karte';
  /** @type {'sm' | 'md'} */
  export let size = 'md';
  /** @type {number} */
  export let revealDelayMs = 0;

  const dispatch = createEventDispatcher();
  let lastTouchActivation = 0;

  $: tone = value === null ? 'neutral' : value < 0 ? 'low' : value === 0 ? 'zero' : value >= 10 ? 'high' : 'mid';
  $: valueClass = tone === 'low'
    ? 'text-cyan-700 bg-cyan-50 ring-cyan-100'
    : tone === 'zero'
      ? 'text-slate-700 bg-slate-50 ring-slate-100'
      : tone === 'high'
        ? 'text-rose-700 bg-rose-50 ring-rose-100'
        : tone === 'mid'
          ? 'text-emerald-700 bg-emerald-50 ring-emerald-100'
          : 'text-slate-400 bg-slate-50 ring-slate-100';
  $: accentClass = tone === 'low'
    ? 'from-cyan-500 to-cyan-300'
    : tone === 'zero'
      ? 'from-slate-400 to-slate-200'
      : tone === 'high'
        ? 'from-rose-500 to-amber-300'
        : tone === 'mid'
          ? 'from-emerald-500 to-cyan-300'
          : 'from-slate-300 to-slate-200';
  $: valueSize = size === 'sm' ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl';
  $: cornerSize = size === 'sm' ? 'text-[0.58rem] sm:text-xs' : 'text-xs sm:text-sm';
  // A single playing card keeps a proportionally smaller radius than the app's
  // page-level rounded-2xl panels; sm cards (used everywhere in-game) get a
  // slightly tighter radius than the larger md variant.
  $: radiusClass = size === 'sm' ? 'rounded-lg' : 'rounded-xl';
  $: innerRadiusClass = size === 'sm' ? 'rounded-[0.5rem]' : 'rounded-[0.65rem]';

  /** @param {Event} event */
  function activate(event) {
    if (disabled) return;
    dispatch('activate', event);
  }

  /** @param {PointerEvent} event */
  function handlePointerUp(event) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    event.preventDefault();
    lastTouchActivation = Date.now();
    activate(event);
  }

  /** @param {MouseEvent} event */
  function handleClick(event) {
    if (Date.now() - lastTouchActivation < 650) return;
    activate(event);
  }
</script>

<button
  type="button"
  {disabled}
  {draggable}
  aria-label={label}
  class="group relative aspect-[2.5/3.5] w-full min-w-0 touch-manipulation select-none {radiusClass} transition duration-200 [perspective:900px] [-webkit-tap-highlight-color:transparent] disabled:cursor-default {selected ? 'scale-[1.03]' : ''} {removed ? 'opacity-35' : ''} {dropTarget ? 'ring-4 ring-cyan-100' : ''}"
  on:pointerup={handlePointerUp}
  on:click={handleClick}
  on:dragstart
  on:dragover
  on:drop
  on:dragend
>
  <span
    class="absolute inset-0 {radiusClass} transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] {hidden ? '[transform:rotateY(180deg)]' : ''} {selected ? 'ring-4 ring-cyan-100' : ''}"
    style={`transition-delay: ${revealDelayMs}ms;`}
  >
    <span
      class="playing-card-front absolute inset-0 overflow-hidden {radiusClass} border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_16px_-10px_rgba(15,23,42,0.2)] ring-1 ring-inset ring-slate-900/5 transition-[transform,box-shadow] duration-200 [backface-visibility:hidden] {disabled || removed ? '' : 'group-hover:-translate-y-0.5 group-hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_26px_-12px_rgba(15,23,42,0.3)]'}"
    >
      <span class="absolute left-0 top-0 h-full w-1 bg-gradient-to-b sm:w-1.5 {accentClass}"></span>

      {#if removed}
        <span class="absolute inset-0 flex items-center justify-center bg-slate-50">
          <span class="h-7 w-7 rounded-md border border-dashed border-slate-300 sm:h-9 sm:w-9"></span>
        </span>
      {:else}
        <span class="absolute right-1.5 top-1.5 hidden rounded-md px-1.5 py-0.5 font-semibold leading-none ring-1 sm:block {cornerSize} {valueClass}">{value}</span>
        <span class="absolute bottom-1.5 left-2 hidden rounded-md px-1.5 py-0.5 font-semibold leading-none ring-1 sm:block {cornerSize} {valueClass}">{value}</span>

        <span class="absolute inset-0 flex items-center justify-center px-1.5">
          <span class="min-w-9 rounded-lg px-2 py-1 text-center font-semibold leading-none shadow-sm ring-1 sm:min-w-12 sm:px-3 sm:py-1.5 {valueSize} {valueClass}">{value}</span>
        </span>
      {/if}
    </span>

    <span
      class="absolute inset-0 overflow-hidden {radiusClass} border border-cyan-300 bg-cyan-600 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_16px_-10px_rgba(15,23,42,0.2)] transition-[transform,box-shadow] duration-200 [backface-visibility:hidden] [transform:rotateY(180deg)] {disabled || removed ? '' : 'group-hover:-translate-y-0.5 group-hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_26px_-12px_rgba(15,23,42,0.3)]'}"
    >
      <span class="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.4),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.16),transparent_55%),linear-gradient(320deg,rgba(0,0,0,0.14),transparent_58%)]"></span>
      <span class="absolute inset-1.5 {innerRadiusClass} border border-white/35 sm:inset-2"></span>
      <span class="absolute inset-2.5 rounded-md border border-white/15 sm:inset-3"></span>
      <span class="absolute inset-0 flex items-center justify-center">
        <span class="grid h-8 w-8 rotate-45 grid-cols-2 gap-1 opacity-90 drop-shadow-sm sm:h-10 sm:w-10">
          <span class="rounded-sm bg-white/85"></span>
          <span class="rounded-sm bg-white/30"></span>
          <span class="rounded-sm bg-white/30"></span>
          <span class="rounded-sm bg-white/85"></span>
        </span>
      </span>
    </span>
  </span>
</button>
