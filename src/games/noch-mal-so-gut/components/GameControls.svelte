<script lang="ts">
  export let canConfirm = false;
  export let canUndo = false;
  export let canSuggest = false;
  export let message = '';
  export let onConfirm: () => void = () => {};
  export let onCancel: () => void = () => {};
  export let onSuggest: () => void = () => {};
  export let onSkip: () => void = () => {};
  export let onRestart: () => void = () => {};
  export let onSave: () => void = () => {};
</script>

<div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
  <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
    <p class="text-sm font-medium leading-6 text-slate-700">{message}</p>
  </div>
  <div class="mt-4 grid gap-2 sm:grid-cols-2">
    <button type="button" on:click={onConfirm} disabled={!canConfirm} class="min-h-11 rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white disabled:bg-emerald-300">Auswahl bestaetigen</button>
    <button type="button" on:click={onSuggest} disabled={!canSuggest} class="min-h-11 rounded-md border border-cyan-300 bg-cyan-50 px-4 py-2 font-semibold text-cyan-900 disabled:opacity-50">Vorschlag anzeigen</button>
    <button type="button" on:click={onCancel} disabled={!canUndo} class="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 disabled:opacity-50">Auswahl aendern</button>
    <button type="button" on:click={onSkip} class="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800">Passen</button>
    <button type="button" on:click={onSave} class="min-h-11 rounded-md border border-cyan-300 bg-cyan-50 px-4 py-2 font-semibold text-cyan-900">Speichern</button>
    <button type="button" on:click={onRestart} class="min-h-11 rounded-md border border-rose-300 bg-rose-50 px-4 py-2 font-semibold text-rose-900">Neu starten</button>
  </div>
</div>
