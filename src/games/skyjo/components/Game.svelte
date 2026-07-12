<script>
  import SkyjoBoard from '$lib/components/SkyjoBoard.svelte';

  /** @typedef {import('../types').SkyjoSession} SkyjoSession */
  /** @typedef {import('../types').SkyjoMove} SkyjoMove */

  /** @type {SkyjoSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: { type: string, source?: string, cardIndex?: number }) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;

  $: skyjoVersion = game ? `${game.id}:${JSON.stringify(game.state)}:${JSON.stringify(game.players)}:${renderNonce}` : '';
</script>

{#if !game}
  <div class="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
    Skyjo wird ueber eine Party gestartet, damit Spieler, Reihenfolge und Punkte synchron bleiben.
  </div>
{:else}
  <div class="mt-3">
    {#key skyjoVersion}
      <SkyjoBoard game={game} {currentPlayerId} {isLoading} {onMove} />
    {/key}
  </div>
{/if}

