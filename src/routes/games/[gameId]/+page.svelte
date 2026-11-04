<script>
  import { page } from '$app/stores';
  import { ArrowLeft } from '@lucide/svelte';
  import { getGameDefinition } from '../../../games/registry';

  $: gameId = $page.params.gameId;
  $: definition = getGameDefinition(gameId);
  $: playerRange = definition ? formatPlayers(definition.minPlayers, definition.maxPlayers) : '';

  /** @param {number | undefined} min @param {number | undefined} max */
  function formatPlayers(min, max) {
    const from = min ?? 1;
    if (!max) return `ab ${from} Spieler`;
    if (from === max) return `${from} Spieler`;
    return `${from}–${max} Spieler`;
  }
</script>

<svelte:head>
  <title>{definition?.name ?? 'Unbekanntes Spiel'} | Web Games</title>
  {#if definition?.description}
    <meta name="description" content={definition.description} />
  {/if}
</svelte:head>

<main class="ui-page">
  <a href="/" class="ui-btn ui-btn--ghost -ml-3 px-3">
    <ArrowLeft size={18} aria-hidden="true" />
    Alle Spiele
  </a>

  {#if !definition}
    <div class="mt-4 max-w-xl pr-14 sm:mt-6 sm:pr-0">
      <h1 class="ui-title">Dieses Spiel gibt es nicht.</h1>
      <p class="ui-lead">
        Zur Spiel-ID <span class="break-all font-semibold text-[color:var(--text)]">{gameId}</span> ist kein Spiel registriert.
      </p>
      <a href="/" class="ui-btn ui-btn--primary ui-btn--lg mt-6">Zur Startseite</a>
    </div>
  {:else}
    <div class="mt-4 grid gap-6 sm:mt-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
      <div class="preview lg:order-2">
        {#if definition.previewImage}
          <img src={definition.previewImage} width="1536" height="1024" alt="Vorschau von {definition.name}" />
        {/if}
      </div>

      <div class="min-w-0 lg:order-1">
        <h1 class="ui-title">{definition.name}</h1>
        <p class="ui-muted ui-num mt-2 text-base">{playerRange}</p>
        {#if definition.description}
          <p class="mt-5 max-w-[60ch] text-lg leading-relaxed text-[color:var(--text)]">{definition.description}</p>
        {/if}

        <a href="/party/starten" class="ui-btn ui-btn--primary ui-btn--lg mt-8 w-full sm:w-auto">Mit Party spielen</a>
        <p class="ui-muted mt-3 text-sm">
          Du startest eine Party, lädst die anderen per Code ein und wählst dort das Spiel.
        </p>
      </div>
    </div>
  {/if}
</main>

<style>
  .preview {
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border-radius: var(--radius-card);
    background: var(--surface);
  }
  .preview img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
