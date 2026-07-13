<script>
  import { page } from '$app/stores';
  import { ArrowLeft, Gamepad2 } from '@lucide/svelte';
  import { getGameDefinition, games } from '../../../games/registry';

  $: gameId = $page.params.gameId;
  $: definition = getGameDefinition(gameId);
  $: GameComponent = definition?.component;
  $: usesFullWidthGameLayout = gameId === 'noch-mal';
</script>

<svelte:head>
  <title>{definition?.name ?? 'Unbekanntes Spiel'} | Web Games</title>
</svelte:head>

<main class="min-h-screen bg-slate-50 text-slate-950">
  <section class="mx-auto w-full {usesFullWidthGameLayout ? 'max-w-[100rem]' : 'max-w-5xl'} px-6 py-8 sm:px-8 lg:px-10">
    <a href="/" class="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
      <ArrowLeft size={18} />
      Startseite
    </a>

    {#if !definition || !GameComponent}
      <div class="mt-8 rounded-lg border border-red-200 bg-white p-6 shadow-sm sm:p-8">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">Unbekanntes Spiel</p>
        <h1 class="mt-3 text-3xl font-semibold text-slate-950">Dieses Spiel ist nicht registriert.</h1>
        <p class="mt-2 text-sm leading-6 text-slate-600">Die Spiel-ID <span class="font-semibold">{gameId}</span> ist in der zentralen Registry nicht vorhanden.</p>
      </div>
    {:else}
      <div class="mt-8 grid gap-6 {usesFullWidthGameLayout ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_18rem]'}">
        <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">{definition.id}</p>
          <h1 class="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">{definition.name}</h1>
          {#if definition.description}
            <p class="mt-3 max-w-2xl text-base leading-7 text-slate-600">{definition.description}</p>
          {/if}

          <div class="mt-6">
            <svelte:component this={GameComponent} game={null} currentPlayerId="" isLoading={false} />
          </div>
        </div>

        {#if !usesFullWidthGameLayout}
        <aside class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {#if definition.previewImage}
            <img src={definition.previewImage} alt="Vorschau von {definition.name}" class="aspect-[16/10] w-full rounded-lg border border-slate-200 object-cover object-center" />
          {/if}
          <div class="mt-5 space-y-3 text-sm text-slate-600">
            <p><span class="font-semibold text-slate-950">Spieler:</span> {definition.minPlayers ?? 1} bis {definition.maxPlayers ?? 'beliebig'}</p>
            <p><span class="font-semibold text-slate-950">Registriert:</span> {games.length} Spiele</p>
          </div>
          <a href="/party/starten" class="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100">
            <Gamepad2 size={18} />
            Party starten
          </a>
        </aside>
        {/if}
      </div>
    {/if}
  </section>
</main>

