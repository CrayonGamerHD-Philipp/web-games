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
  /** Party-Spieler ({ id, name, color, … }) für Avatare in Spielerfarbe. */
  /** @type {{ id: string, name?: string, color?: string }[]} */
  export let players = [];

  // Kept for the shared game-component API; the board reacts to `game` directly.
  $: void renderNonce;
</script>

{#if !game}
  <p class="ui-panel ui-muted">
    Skyjo wird über eine Party gestartet, damit Spieler, Reihenfolge und Punkte synchron bleiben.
  </p>
{:else}
  <div class="mt-3">
    {#key game.id}
      <SkyjoBoard {game} {currentPlayerId} {isLoading} {onMove} {players} />
    {/key}
  </div>
{/if}

