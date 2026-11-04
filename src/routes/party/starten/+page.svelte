<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ArrowLeft, LoaderCircle } from '@lucide/svelte';

  let name = '';
  let error = '';
  let isSubmitting = false;

  onMount(() => {
    name ||= localStorage.getItem('web-games:player-name') ?? '';
  });

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

      localStorage.setItem('web-games:player-name', name.trim());
      localStorage.setItem('party-player:' + data.party.code, data.playerId);
      localStorage.setItem('party-token:' + data.party.code, data.token);
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

<main class="ui-page">
  <div class="max-w-md">
    <a href="/" class="ui-btn ui-btn--ghost -ml-3 px-3">
      <ArrowLeft size={18} aria-hidden="true" />
      Zurück
    </a>

    <header class="mt-4 sm:mt-6">
      <h1 class="ui-title">Wie heißt du?</h1>
      <p class="ui-lead">Neue Party. Danach bekommst du einen Code, mit dem die anderen beitreten.</p>
    </header>

    <form class="ui-panel mt-6 space-y-5 sm:mt-8" on:submit|preventDefault={createParty}>
      <div>
        <label for="party-name" class="ui-label">Dein Name</label>
        <input
          id="party-name"
          bind:value={name}
          maxlength="32"
          name="name"
          autocomplete="name"
          required
          placeholder="z. B. Alex"
          class="ui-input"
        />
      </div>

      {#if error}
        <p role="alert" class="ui-alert">{error}</p>
      {/if}

      <button type="submit" disabled={isSubmitting} class="ui-btn ui-btn--primary ui-btn--lg ui-btn--block">
        {#if isSubmitting}
          <LoaderCircle class="animate-spin" size={20} aria-hidden="true" />
          Wird erstellt…
        {:else}
          Party erstellen
        {/if}
      </button>
    </form>
  </div>
</main>
