<script>
  import { goto } from '$app/navigation';
  import { ArrowLeft, LoaderCircle, PlusCircle } from '@lucide/svelte';

  let name = '';
  let error = '';
  let isSubmitting = false;

  async function createParty() {
    error = '';
    isSubmitting = true;

    try {
      const response = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await response.json();

      if (!response.ok) {
        error = data.message ?? 'Die Party konnte nicht erstellt werden.';
        return;
      }

      localStorage.setItem(`party-player:${data.party.code}`, data.playerId);
      await goto(`/party/${data.party.code}`);
    } catch {
      error = 'Die Party konnte nicht erstellt werden.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Party starten | Web Games</title>
</svelte:head>

<main class="min-h-screen bg-slate-50 text-slate-950">
  <section class="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-8 px-6 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
    <div class="w-full max-w-2xl lg:max-w-none">
      <a href="/" class="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
        <ArrowLeft size={18} />
        Zurueck
      </a>

      <div class="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div class="flex h-12 w-12 items-center justify-center rounded-md bg-cyan-600 text-white">
          <PlusCircle size={26} strokeWidth={2.2} />
        </div>
        <h1 class="mt-6 text-3xl font-semibold text-slate-950">Party starten</h1>
        <p class="mt-3 text-base leading-7 text-slate-600">
          Gib deinen Namen ein. Danach bekommst du einen Code, mit dem andere Spieler deiner Party beitreten koennen.
        </p>

        <form class="mt-8 space-y-5" on:submit|preventDefault={createParty}>
          <label class="block">
            <span class="text-sm font-medium text-slate-700">Dein Name</span>
            <input
              bind:value={name}
              maxlength="32"
              autocomplete="name"
              placeholder="z. B. Alex"
              class="mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          {#if error}
            <p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          {/if}

          <button
            type="submit"
            disabled={isSubmitting}
            class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-cyan-600 px-5 py-3 font-semibold text-white transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-cyan-300 sm:w-auto"
          >
            {#if isSubmitting}
              <LoaderCircle class="animate-spin" size={20} />
              Wird erstellt
            {:else}
              <PlusCircle size={20} />
              Party erstellen
            {/if}
          </button>
        </form>
      </div>
    </div>

    <div class="relative mx-auto w-full max-w-md lg:mx-0">
      <div class="absolute -inset-3 rounded-[1.5rem] bg-cyan-100/50 blur-xl"></div>
      <img
        src="/images/party-hero.png"
        alt="Heller Spieltisch mit Karten und Spielfiguren"
        class="relative aspect-[4/5] max-h-[32rem] w-full rounded-2xl border border-white object-cover object-[center_48%] shadow-lg shadow-slate-200/80"
      />
    </div>
  </section>
</main>