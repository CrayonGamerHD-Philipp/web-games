<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { ArrowLeft, LoaderCircle } from '@lucide/svelte';

  let code = '';
  let name = '';
  let error = '';
  let isSubmitting = false;

  onMount(() => {
    name ||= localStorage.getItem('web-games:player-name') ?? '';
    code ||= $page.url.searchParams.get('code') ?? '';
  });

  $: cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  async function joinParty() {
    error = '';
    if (cleanCode.length !== 6) {
      error = 'Bitte gib einen gültigen Party-Code mit 6 Zeichen ein.';
      return;
    }
    isSubmitting = true;

    try {
      const response = await fetch(`/api/parties/${cleanCode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await response.json();

      if (!response.ok) {
        error = data.message ?? 'Du konntest der Party nicht beitreten.';
        return;
      }

      localStorage.setItem('web-games:player-name', name.trim());
      localStorage.setItem('party-player:' + data.party.code, data.playerId);
      localStorage.setItem('party-token:' + data.party.code, data.token);
      await goto(`/party/${data.party.code}`);
    } catch {
      error = 'Du konntest der Party nicht beitreten.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Party beitreten | Web Games</title>
</svelte:head>

<main class="ui-page">
  <div class="max-w-md">
    <a href="/" class="ui-btn ui-btn--ghost -ml-3 px-3">
      <ArrowLeft size={18} aria-hidden="true" />
      Zurück
    </a>

    <header class="mt-4 sm:mt-6">
      <h1 class="ui-title">Wie lautet der Party-Code?</h1>
      <p class="ui-lead">Den Code mit 6 Zeichen siehst du in der Party bei der Person, die sie gestartet hat.</p>
    </header>

    <form class="ui-panel mt-6 space-y-5 sm:mt-8" on:submit|preventDefault={joinParty}>
      <div>
        <label for="party-code" class="ui-label">Party-Code</label>
        <input
          id="party-code"
          bind:value={code}
          name="code"
          maxlength="6"
          required
          pattern={'[A-Za-z0-9]{6}'}
          title="6 Zeichen, nur Buchstaben und Ziffern"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          autocorrect="off"
          spellcheck="false"
          placeholder="ABC123"
          class="ui-input code-input"
        />
      </div>

      <div>
        <label for="party-name" class="ui-label">Dein Name</label>
        <input
          id="party-name"
          bind:value={name}
          maxlength="32"
          name="name"
          autocomplete="name"
          required
          placeholder="z. B. Sam"
          class="ui-input"
        />
      </div>

      {#if error}
        <p role="alert" class="ui-alert">{error}</p>
      {/if}

      <button type="submit" disabled={isSubmitting} class="ui-btn ui-btn--primary ui-btn--lg ui-btn--block">
        {#if isSubmitting}
          <LoaderCircle class="animate-spin" size={20} aria-hidden="true" />
          Beitritt läuft…
        {:else}
          Party beitreten
        {/if}
      </button>
    </form>
  </div>
</main>

<style>
  .code-input {
    min-height: 64px;
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
  }
  .code-input::placeholder {
    font-weight: 500;
    letter-spacing: 0.2em;
    opacity: 0.45;
  }
</style>
