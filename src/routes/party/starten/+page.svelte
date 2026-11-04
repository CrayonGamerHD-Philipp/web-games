<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ArrowLeft, LoaderCircle } from '@lucide/svelte';
  import AvatarEditor from '$lib/components/AvatarEditor.svelte';
  import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
  import { normalizeAvatar, randomAvatar } from '$lib/party-features.js';
  import { playerHex } from '$lib/player-colors.js';

  const avatarStorageKey = 'web-games:avatar';
  // Die echte Farbe vergibt der Server beim Beitritt; bis dahin neutrale Vorschau.
  const previewColor = playerHex('cyan');
  let avatarOpen = false;

  let name = '';
  let error = '';
  let isSubmitting = false;
  // Erst im Browser füllen (gespeichert oder zufällig), damit SSR und Hydration übereinstimmen.
  /** @type {import('$lib/party-features.js').Avatar | null} */
  let avatar = null;

  onMount(() => {
    name ||= localStorage.getItem('web-games:player-name') ?? '';
    let nextAvatar = randomAvatar();
    try {
      const stored = localStorage.getItem(avatarStorageKey);
      if (stored) nextAvatar = normalizeAvatar(JSON.parse(stored), nextAvatar);
    } catch {
      // Kein gespeicherter Avatar: der zufällige bleibt.
    }
    avatar = nextAvatar;
  });

  async function createParty() {
    error = '';
    isSubmitting = true;

    try {
      const response = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, avatar })
      });
      const data = await response.json();

      if (!response.ok) {
        error = data.message ?? 'Die Party konnte nicht erstellt werden.';
        return;
      }

      localStorage.setItem('web-games:player-name', name.trim());
      try {
        localStorage.setItem(avatarStorageKey, JSON.stringify(avatar));
      } catch {
        // Speichern ist nur Komfort.
      }
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

      <div role="group" aria-labelledby="party-avatar-label">
        <p id="party-avatar-label" class="ui-label">Dein Avatar <span class="font-normal ui-muted">(optional)</span></p>
        {#if avatarOpen}
          <AvatarEditor bind:avatar color={previewColor} {name} />
          <button type="button" class="ui-btn ui-btn--ghost mt-2" on:click={() => (avatarOpen = false)}>Fertig</button>
        {:else}
          <div class="flex items-center gap-3">
            <PlayerAvatar {avatar} {name} color={previewColor} size={56} />
            <button type="button" class="ui-btn" aria-expanded="false" on:click={() => (avatarOpen = true)}>Anpassen</button>
          </div>
        {/if}
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
