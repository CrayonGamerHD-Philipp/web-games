<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { Check, LoaderCircle, Monitor, Moon, Pencil, Play, Settings, Sun, X } from '@lucide/svelte';
  import AvatarEditor from '$lib/components/AvatarEditor.svelte';
  import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
  import { normalizeAvatar, type Avatar } from '$lib/party-features.js';
  import { playerHex } from '$lib/player-colors.js';
  import { onDestroy, onMount, tick } from 'svelte';

  type MusicTrack = { id: string; name: string; src: string };
  type StoredAudioSettings = { playerName?: string; effectsVolume?: number; musicVolume?: number; musicEnabled?: boolean; selectedTrackId?: string };
  type ThemePreference = 'light' | 'dark' | 'system';
  type AccentColor = 'cyan' | 'violet' | 'rose' | 'emerald' | 'orange';
  type StoredAppearanceSettings = { theme?: ThemePreference; accentColor?: AccentColor };

  const storageKey = 'web-games:audio-settings';
  const appearanceStorageKey = 'web-games:appearance-settings';
  const themeOptions: { id: ThemePreference; name: string; icon: typeof Sun }[] = [
    { id: 'light', name: 'Hell', icon: Sun },
    { id: 'dark', name: 'Dunkel', icon: Moon },
    { id: 'system', name: 'System', icon: Monitor }
  ];
  const accentOptions: { id: AccentColor; name: string; swatch: string }[] = [
    // Werte = --accent-main aus app.css (:root bzw. html[data-accent=…]).
    { id: 'cyan', name: 'Petrol', swatch: '#1b6e66' },
    { id: 'violet', name: 'Violett', swatch: '#6d28d9' },
    { id: 'rose', name: 'Rosé', swatch: '#be123c' },
    { id: 'emerald', name: 'Wald', swatch: '#047857' },
    { id: 'orange', name: 'Orange', swatch: '#c2410c' }
  ];
  const tracks: MusicTrack[] = [
    { id: 'random', name: 'Zufall', src: '' },
    { id: 'chill_loop1', name: 'Chill Loop 1', src: '/sounds/music/chill_loop1.mp3' },
    { id: 'loop1', name: 'Loop 1', src: '/sounds/music/loop1.mp3' },
    { id: 'loop2', name: 'Loop 2', src: '/sounds/music/loop2.mp3' },
    { id: 'loop3', name: 'Loop 3', src: '/sounds/music/loop3.mp3' },
    { id: 'loop4', name: 'Loop 4', src: '/sounds/music/loop4.mp3' },
    { id: 'loop5', name: 'Loop 5', src: '/sounds/music/loop5.mp3' },
    { id: 'loop6', name: 'Loop 6', src: '/sounds/music/loop6.mp3' },
    { id: 'loop7', name: 'Loop 7', src: '/sounds/music/loop7.mp3' },
    { id: 'loop8', name: 'Loop 8', src: '/sounds/music/loop8.mp3' },
    { id: 'loop10', name: 'Loop 10', src: '/sounds/music/loop10.mp3' }
  ];
  const playableTracks = tracks.filter((track) => track.src);

  let isOpen = false;
  let playerName = '';
  let effectsVolume = 0.85;
  let musicVolume = 0.35;
  let musicEnabled = true;
  let selectedTrackId = 'random';
  let theme: ThemePreference = 'system';
  let accentColor: AccentColor = 'cyan';
  let saved = false;
  let renameStatus = '';
  let renameError = '';
  let isRenaming = false;
  let partyAvatar: Avatar | null = null;
  let editAvatar: Avatar | null = null;
  let partyColorHex = playerHex('cyan');
  let isEditingAvatar = false;
  let isSavingAvatar = false;
  let avatarStatus = '';
  let avatarError = '';
  let avatarStatusTimeout: ReturnType<typeof setTimeout> | null = null;
  let activeAudio: HTMLAudioElement | null = null;
  let fadingAudio: HTMLAudioElement | null = null;
  let previewAudio: HTMLAudioElement | null = null;
  let hasUserInteracted = false;
  let lastStartedTrackId = '';
  let previewTimeout: ReturnType<typeof setTimeout> | null = null;
  let resumeMusicAfterPreview = false;
  let loadedPartyNameKey = '';
  let colorSchemeQuery: MediaQueryList | null = null;
  let gearButton: HTMLButtonElement | null = null;
  let closeButton: HTMLButtonElement | null = null;
  let panel: HTMLElement | null = null;

  async function openPanel() {
    isOpen = true;
    if (routeCode && currentPlayerId) void loadPartyAvatar(routeCode, currentPlayerId);
    await tick();
    closeButton?.focus();
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    gearButton?.focus();
  }

  function togglePanel() {
    if (isOpen) closePanel();
    else void openPanel();
  }

  function handlePanelKeydown(event: KeyboardEvent) {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key !== 'Tab' || !panel) return;
    const focusable = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  $: routeCode = extractPartyCode($page.url.pathname);
  $: currentPlayerId = browser && routeCode ? localStorage.getItem(`party-player:${routeCode}`) ?? '' : '';
  $: currentPlayerToken = browser && routeCode ? localStorage.getItem(`party-token:${routeCode}`) ?? '' : '';
  $: selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0];
  $: canEditPartyAvatar = Boolean(routeCode && currentPlayerId && currentPlayerToken);
  $: canRenamePartyPlayer = Boolean(routeCode && currentPlayerId && currentPlayerToken && playerName.trim());
  $: if (browser && routeCode && currentPlayerId && loadedPartyNameKey !== `${routeCode}:${currentPlayerId}`) {
    loadedPartyNameKey = `${routeCode}:${currentPlayerId}`;
    void loadPartyPlayerName(routeCode, currentPlayerId);
  }

  function extractPartyCode(pathname: string) {
    const match = pathname.match(/^\/party\/([A-Z0-9]{6})(?:\/|$)/i);
    return match?.[1]?.toUpperCase() ?? '';
  }

  function randomTrack(exceptId = ''): MusicTrack {
    const candidates = playableTracks.filter((track) => track.id !== exceptId);
    return candidates[Math.floor(Math.random() * candidates.length)] ?? playableTracks[0];
  }

  function loadSettings() {
    if (!browser) return;

    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as StoredAudioSettings;
    const partyName = routeCode ? localStorage.getItem(`web-games:player-name:${routeCode}`) : '';
    playerName = String(partyName || stored.playerName || localStorage.getItem('web-games:player-name') || '').slice(0, 32);
    effectsVolume = Number.isFinite(stored.effectsVolume) ? Number(stored.effectsVolume) : 0.85;
    musicVolume = Number.isFinite(stored.musicVolume) ? Number(stored.musicVolume) : 0.35;
    musicEnabled = stored.musicEnabled !== false;
    selectedTrackId = stored.selectedTrackId ?? 'random';

    if (!stored.selectedTrackId) {
      selectedTrackId = 'random';
    }
  }

  function loadAppearanceSettings() {
    if (!browser) return;
    let stored: StoredAppearanceSettings = {};
    try {
      stored = JSON.parse(localStorage.getItem(appearanceStorageKey) ?? '{}') as StoredAppearanceSettings;
    } catch {
      localStorage.removeItem(appearanceStorageKey);
    }
    theme = ['light', 'dark', 'system'].includes(String(stored.theme)) ? stored.theme as ThemePreference : 'system';
    accentColor = ['cyan', 'violet', 'rose', 'emerald', 'orange'].includes(String(stored.accentColor)) ? stored.accentColor as AccentColor : 'cyan';
    applyAppearance();
  }

  function applyAppearance() {
    if (!browser) return;
    const resolvedTheme = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = theme;
    document.documentElement.dataset.accent = accentColor;
  }

  function persistAppearance() {
    if (!browser) return;
    const payload: StoredAppearanceSettings = { theme, accentColor };
    localStorage.setItem(appearanceStorageKey, JSON.stringify(payload));
    applyAppearance();
    window.dispatchEvent(new CustomEvent('web-games:appearance-settings', { detail: payload }));
  }

  function chooseTheme(nextTheme: ThemePreference) {
    theme = nextTheme;
    persistAppearance();
  }

  function chooseAccent(nextAccent: AccentColor) {
    accentColor = nextAccent;
    persistAppearance();
  }

  function persistSettings() {
    if (!browser) return;

    const payload = { playerName: playerName.trim(), effectsVolume, musicVolume, musicEnabled, selectedTrackId };
    localStorage.setItem(storageKey, JSON.stringify(payload));
    localStorage.setItem('web-games:player-name', payload.playerName);
    if (routeCode) localStorage.setItem(`web-games:player-name:${routeCode}`, payload.playerName);
    localStorage.setItem('web-games:effects-volume', String(effectsVolume));
    window.dispatchEvent(new CustomEvent('web-games:audio-settings', { detail: payload }));
    saved = true;
    setTimeout(() => {
      saved = false;
    }, 1300);
  }

  async function loadPartyPlayerName(code: string, playerId: string) {
    if (!browser || !code || !playerId) return;

    try {
      const response = await fetch(`/api/parties/${code}`);
      const data = await response.json();
      const partyPlayer = data.party?.players?.find((player: { id: string; name?: string }) => player.id === playerId);
      applyPartyAvatar(partyPlayer);
      const serverName = String(partyPlayer?.name ?? '').slice(0, 32);
      if (!response.ok || !serverName) return;
      playerName = serverName;
      localStorage.setItem('web-games:player-name', serverName);
      localStorage.setItem(`web-games:player-name:${code}`, serverName);
    } catch {
      // Lokaler Name bleibt bestehen, wenn die Party gerade nicht erreichbar ist.
    }
  }

  function applyPartyAvatar(partyPlayer: { avatar?: unknown; color?: string } | undefined) {
    if (!partyPlayer) return;
    partyColorHex = playerHex(partyPlayer.color);
    if (partyPlayer.avatar) {
      partyAvatar = normalizeAvatar(partyPlayer.avatar, partyAvatar ?? undefined);
      if (!isEditingAvatar) editAvatar = partyAvatar;
    }
  }

  async function loadPartyAvatar(code: string, playerId: string) {
    try {
      const response = await fetch(`/api/parties/${code}`);
      if (!response.ok) return;
      const data = await response.json();
      applyPartyAvatar(data.party?.players?.find((player: { id: string }) => player.id === playerId));
    } catch {
      // Ohne Verbindung bleibt der zuletzt bekannte Avatar stehen.
    }
  }

  function toggleAvatarEditor() {
    isEditingAvatar = !isEditingAvatar;
    avatarError = '';
    if (isEditingAvatar) editAvatar = partyAvatar;
  }

  async function saveAvatar() {
    avatarError = '';
    avatarStatus = '';
    if (!canEditPartyAvatar || !editAvatar) return;
    isSavingAvatar = true;

    try {
      const response = await fetch(`/api/parties/${routeCode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set-avatar', token: currentPlayerToken, avatar: editAvatar })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        avatarError = data.message ?? 'Avatar konnte nicht gespeichert werden.';
        return;
      }
      const savedPlayer = data.party?.players?.find((player: { id: string }) => player.id === currentPlayerId);
      partyAvatar = savedPlayer?.avatar ? normalizeAvatar(savedPlayer.avatar, editAvatar) : editAvatar;
      try {
        localStorage.setItem('web-games:avatar', JSON.stringify(partyAvatar));
      } catch {
        // Lokales Merken ist nur Komfort.
      }
      isEditingAvatar = false;
      avatarStatus = 'Gespeichert';
      if (avatarStatusTimeout) clearTimeout(avatarStatusTimeout);
      avatarStatusTimeout = setTimeout(() => {
        avatarStatus = '';
      }, 2000);
    } catch {
      avatarError = 'Avatar konnte nicht gespeichert werden.';
    } finally {
      isSavingAvatar = false;
    }
  }

  function setAudioVolume(audio: HTMLAudioElement | null, targetVolume: number) {
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, targetVolume));
  }

  function fadeAudio(audio: HTMLAudioElement, from: number, to: number, durationMs: number, onDone: () => void = () => {}) {
    const startedAt = performance.now();
    setAudioVolume(audio, from);

    function step(now: number) {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      setAudioVolume(audio, from + (to - from) * progress);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        onDone();
      }
    }

    requestAnimationFrame(step);
  }

  async function startMusic(track: MusicTrack | undefined, fade = true) {
    if (!browser || !track?.src || !musicEnabled) return;
    if (lastStartedTrackId === track.id && activeAudio && !activeAudio.paused) return;

    const audio = new Audio(track.src);
    audio.loop = selectedTrackId !== 'random';
    audio.preload = 'auto';
    audio.volume = fade ? 0 : musicVolume;

    if (selectedTrackId === 'random') {
      let queuedNext = false;
      audio.addEventListener('timeupdate', () => {
        if (queuedNext || !Number.isFinite(audio.duration)) return;
        if (audio.duration - audio.currentTime <= 1.6) {
          queuedNext = true;
          const nextTrack = randomTrack(track.id);
          void startMusic(nextTrack, true);
        }
      });
      audio.addEventListener('ended', () => {
        if (queuedNext) return;
        queuedNext = true;
        const nextTrack = randomTrack(track.id);
        void startMusic(nextTrack, true);
      });
    }

    try {
      await audio.play();
    } catch {
      return;
    }

    const previous = activeAudio;
    activeAudio = audio;
    lastStartedTrackId = track.id;

    if (fade) fadeAudio(audio, 0, musicVolume, 900);
    if (previous) {
      fadingAudio = previous;
      fadeAudio(previous, previous.volume, 0, 900, () => {
        previous.pause();
        if (fadingAudio === previous) fadingAudio = null;
      });
    }
  }

  function stopMusic(fade = true) {
    const audio = activeAudio;
    activeAudio = null;
    lastStartedTrackId = '';
    if (!audio) return;

    if (!fade) {
      audio.pause();
      return;
    }

    fadeAudio(audio, audio.volume, 0, 500, () => audio.pause());
  }

  function applyMusic() {
    if (!browser) return;
    if (!musicEnabled) {
      stopMusic();
      return;
    }

    const track = selectedTrackId === 'random' ? randomTrack(lastStartedTrackId) : selectedTrack;
    void startMusic(track, true);
  }

  function stopPreview() {
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      previewTimeout = null;
    }
    previewAudio?.pause();
    previewAudio = null;
  }

  function previewTrack(track: MusicTrack) {
    if (!browser || !track.src) return;

    stopPreview();
    resumeMusicAfterPreview = Boolean(activeAudio && !activeAudio.paused && musicEnabled);
    activeAudio?.pause();
    fadingAudio?.pause();

    previewAudio = new Audio(track.src);
    previewAudio.volume = musicVolume;
    previewAudio.currentTime = 0;
    void previewAudio
      .play()
      .then(() => {
        previewTimeout = setTimeout(() => {
          stopPreview();
          if (resumeMusicAfterPreview) applyMusic();
        }, 5000);
      })
      .catch(() => {
        stopPreview();
        if (resumeMusicAfterPreview) applyMusic();
      });
  }

  function handleFirstGesture() {
    if (hasUserInteracted) return;
    hasUserInteracted = true;
    applyMusic();
  }

  async function renamePlayer() {
    renameError = '';
    renameStatus = '';
    persistSettings();

    if (!canRenamePartyPlayer) return;
    isRenaming = true;

    try {
      const response = await fetch(`/api/parties/${routeCode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'rename', token: currentPlayerToken, name: playerName })
      });
      const data = await response.json();
      if (!response.ok) {
        renameError = data.message ?? 'Name konnte nicht gespeichert werden.';
        return;
      }
      renameStatus = 'Name gespeichert';
    } catch {
      renameError = 'Name konnte nicht gespeichert werden.';
    } finally {
      isRenaming = false;
    }
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === appearanceStorageKey) loadAppearanceSettings();
    if (event.key === storageKey || event.key === 'web-games:effects-volume') {
      loadSettings();
      setAudioVolume(activeAudio, musicVolume);
    }
  }

  $: if (browser && activeAudio) setAudioVolume(activeAudio, musicVolume);

  onMount(() => {
    loadSettings();
    loadAppearanceSettings();
    colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    colorSchemeQuery.addEventListener('change', applyAppearance);
    document.addEventListener('pointerdown', handleFirstGesture, { once: true });
    document.addEventListener('keydown', handleFirstGesture, { once: true });
    window.addEventListener('storage', handleStorage);
  });

  onDestroy(() => {
    if (!browser) return;

    document.removeEventListener('pointerdown', handleFirstGesture);
    document.removeEventListener('keydown', handleFirstGesture);
    window.removeEventListener('storage', handleStorage);
    colorSchemeQuery?.removeEventListener('change', applyAppearance);
    activeAudio?.pause();
    fadingAudio?.pause();
    stopPreview();
    if (avatarStatusTimeout) clearTimeout(avatarStatusTimeout);
  });
</script>

<svelte:window on:keydown={handlePanelKeydown} />

<div class="settings-anchor">
  <button
    bind:this={gearButton}
    type="button"
    on:click={togglePanel}
    class="ui-btn ui-btn--ghost ui-btn--icon settings-gear"
    aria-label={isOpen ? 'Einstellungen schließen' : 'Einstellungen öffnen'}
    aria-expanded={isOpen}
    aria-controls="settings-panel"
  >
    <Settings size={22} aria-hidden="true" />
  </button>
</div>

{#if isOpen}
  <div class="ui-dialog-backdrop">
    <button type="button" tabindex="-1" class="absolute inset-0 cursor-default" on:click={closePanel} aria-label="Einstellungen schließen"></button>
    <div
      bind:this={panel}
      id="settings-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-panel-title"
      class="ui-dialog settings-dialog animate-modal-in"
    >
      <div class="settings-top">
        <h2 id="settings-panel-title" class="settings-title">Einstellungen</h2>
        <button bind:this={closeButton} type="button" on:click={closePanel} class="ui-btn ui-btn--ghost ui-btn--icon settings-close" aria-label="Einstellungen schließen">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <section class="settings-section" aria-labelledby="settings-look">
        <h3 id="settings-look" class="ui-section-title">Darstellung</h3>

        <div class="settings-field">
          <p class="settings-label" id="settings-theme-label">Farbschema</p>
          <div class="segmented" role="group" aria-labelledby="settings-theme-label">
            {#each themeOptions as option (option.id)}
              <button type="button" on:click={() => chooseTheme(option.id)} aria-pressed={theme === option.id} class="segment" class:is-active={theme === option.id}>
                <svelte:component this={option.icon} size={16} aria-hidden="true" />
                {option.name}
              </button>
            {/each}
          </div>
        </div>

        <div class="settings-field">
          <p class="settings-label" id="settings-accent-label">
            Akzentfarbe <span class="settings-value">{accentOptions.find((option) => option.id === accentColor)?.name}</span>
          </p>
          <div class="swatches" role="group" aria-labelledby="settings-accent-label">
            {#each accentOptions as option (option.id)}
              <button
                type="button"
                on:click={() => chooseAccent(option.id)}
                aria-label={`${option.name} als Akzentfarbe verwenden`}
                aria-pressed={accentColor === option.id}
                title={option.name}
                class="swatch"
                class:is-active={accentColor === option.id}
              >
                <span class="swatch-dot" style="background: {option.swatch}">
                  {#if accentColor === option.id}<Check size={16} strokeWidth={3} aria-hidden="true" />{/if}
                </span>
              </button>
            {/each}
          </div>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-sound">
        <h3 id="settings-sound" class="ui-section-title">Ton</h3>

        <label class="settings-field">
          <span class="settings-label">Effekte <span class="settings-value ui-num">{Math.round(effectsVolume * 100)} %</span></span>
          <input type="range" min="0" max="1" step="0.01" bind:value={effectsVolume} on:change={persistSettings} class="settings-range" />
        </label>

        <label class="settings-field">
          <span class="settings-label">Musik <span class="settings-value ui-num">{Math.round(musicVolume * 100)} %</span></span>
          <input type="range" min="0" max="1" step="0.01" bind:value={musicVolume} on:change={() => { persistSettings(); setAudioVolume(activeAudio, musicVolume); }} class="settings-range" />
        </label>

        <label class="settings-toggle">
          <span>
            <span class="block font-semibold">Musik abspielen</span>
            <span class="settings-hint">Startet nach der ersten Eingabe im Browser.</span>
          </span>
          <input type="checkbox" role="switch" bind:checked={musicEnabled} on:change={() => { persistSettings(); applyMusic(); }} class="switch" />
        </label>

        <div class="settings-field">
          <label class="settings-label" for="settings-track">Musikstück</label>
          <div class="flex gap-2">
            <select id="settings-track" bind:value={selectedTrackId} on:change={() => { persistSettings(); applyMusic(); }} class="ui-input settings-select">
              {#each tracks as track (track.id)}
                <option value={track.id}>{track.name}</option>
              {/each}
            </select>
            <button
              type="button"
              on:click={() => previewTrack(selectedTrack)}
              disabled={!selectedTrack.src}
              class="ui-btn ui-btn--icon settings-preview"
              aria-label={selectedTrack.src ? `${selectedTrack.name} 5 Sekunden anhören` : 'Für Zufall gibt es keine Hörprobe'}
              title="5 Sekunden anhören"
            >
              <Play size={18} aria-hidden="true" />
            </button>
          </div>
          <p class="settings-hint">Die Hörprobe stoppt nach 5 Sekunden.</p>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-profile">
        <h3 id="settings-profile" class="ui-section-title">Profil</h3>
        <div class="settings-field">
          <label class="settings-label" for="settings-player-name">Spielername</label>
          <input id="settings-player-name" bind:value={playerName} name="playerName" autocomplete="nickname" maxlength="32" class="ui-input" placeholder="Dein Name" />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" on:click={renamePlayer} disabled={isRenaming || !playerName.trim()} class="ui-btn ui-btn--primary">
            {#if isRenaming}
              <LoaderCircle class="animate-spin" size={17} aria-hidden="true" />
              Speichert…
            {:else if saved || renameStatus}
              <Check size={17} aria-hidden="true" />
              Gespeichert
            {:else}
              Speichern
            {/if}
          </button>
          {#if routeCode && !currentPlayerId}<span class="settings-hint">Kein lokaler Spieler für diese Lobby gefunden.</span>{/if}
          <span class="sr-only" aria-live="polite">{saved || renameStatus ? 'Gespeichert' : ''}</span>
          {#if renameError}<p class="ui-alert basis-full" role="alert">{renameError}</p>{/if}
        </div>

        {#if canEditPartyAvatar}
          <div class="settings-field">
            <p class="settings-label" id="settings-avatar-label">Avatar</p>
            <div class="settings-avatar-row">
              {#if partyAvatar}
                <PlayerAvatar avatar={partyAvatar} name={playerName} color={partyColorHex} size={56} decorative={false} />
              {:else}
                <span class="settings-hint">Avatar wird geladen…</span>
              {/if}
              <button type="button" on:click={toggleAvatarEditor} disabled={!partyAvatar} aria-expanded={isEditingAvatar} aria-controls="settings-avatar-editor" class="ui-btn">
                {#if isEditingAvatar}
                  <X size={17} aria-hidden="true" />
                  Abbrechen
                {:else}
                  <Pencil size={17} aria-hidden="true" />
                  Avatar bearbeiten
                {/if}
              </button>
              <span class="settings-hint" aria-live="polite">
                {#if avatarStatus}<Check size={15} aria-hidden="true" class="inline align-[-2px]" /> {avatarStatus}{/if}
              </span>
            </div>
            {#if isEditingAvatar && editAvatar}
              <div id="settings-avatar-editor" class="settings-avatar-editor" role="group" aria-labelledby="settings-avatar-label">
                <AvatarEditor bind:avatar={editAvatar} color={partyColorHex} name={playerName} />
                <button type="button" on:click={saveAvatar} disabled={isSavingAvatar} class="ui-btn ui-btn--primary self-start">
                  {#if isSavingAvatar}
                    <LoaderCircle class="animate-spin" size={17} aria-hidden="true" />
                    Speichert…
                  {:else}
                    Speichern
                  {/if}
                </button>
              </div>
            {/if}
            {#if avatarError}<p class="ui-alert" role="alert">{avatarError}</p>{/if}
          </div>
        {/if}
      </section>
    </div>
  </div>
{/if}

<style>
  /* Oben rechts auf Höhe der Kopfzeile; scrollt mit der Seite, damit es nie Inhalte überdeckt. */
  .settings-anchor {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    right: max(12px, env(safe-area-inset-right));
    z-index: 80;
  }
  @media (min-width: 640px) {
    .settings-anchor { top: max(20px, env(safe-area-inset-top)); right: max(20px, env(safe-area-inset-right)); }
  }
  .settings-gear { background: var(--ground); color: var(--text); }

  .settings-dialog { position: relative; display: flex; flex-direction: column; gap: 32px; color: var(--text); }
  .settings-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: -8px -10px -12px 0; }
  .settings-title { margin: 0; font-size: 1.25rem; font-weight: 600; }

  .settings-section { display: flex; flex-direction: column; gap: 16px; }
  .settings-section > :global(.ui-section-title) { font-size: 1rem; }
  .settings-field { display: flex; flex-direction: column; gap: 8px; }
  .settings-label { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0; font-size: 0.875rem; font-weight: 500; }
  .settings-value { font-weight: 500; color: var(--muted); }
  .settings-hint { margin: 0; font-size: 0.8125rem; line-height: 1.4; color: var(--muted); }

  .segmented { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; border-radius: var(--radius-control); background: var(--surface); }
  .segment { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--muted); font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background-color 150ms ease, color 150ms ease; }
  .segment.is-active { background: var(--raised); color: var(--text); box-shadow: inset 0 0 0 1px var(--border); }
  .segment:focus-visible, .swatch:focus-visible, .switch:focus-visible, .settings-range:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 2px; }

  .swatches { display: flex; gap: 6px; }
  .swatch { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: transparent; cursor: pointer; }
  .swatch-dot { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 999px; color: #fff; transition: transform 150ms ease; }
  .swatch.is-active .swatch-dot { box-shadow: 0 0 0 2px var(--raised), 0 0 0 4px var(--text); }
  .swatch:active .swatch-dot { transform: scale(0.92); }

  .settings-range { width: 100%; min-height: 28px; accent-color: var(--accent-main); }

  .settings-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 0.9375rem; cursor: pointer; }
  .switch { appearance: none; position: relative; flex-shrink: 0; width: 48px; height: 28px; margin: 0; border-radius: 999px; background: var(--control); cursor: pointer; transition: background-color 150ms ease; }
  .switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 999px; background: #fff; transition: transform 150ms ease; }
  .switch:checked { background: var(--accent-main); }
  .switch:checked::after { transform: translateX(20px); }

  .settings-avatar-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  .settings-avatar-editor { display: flex; flex-direction: column; gap: 16px; padding: 16px; border-radius: var(--radius-inner); background: var(--surface); }

  .settings-select { min-height: var(--control-height); appearance: auto; }
  .settings-preview { flex-shrink: 0; }

  @media (hover: hover) and (pointer: fine) {
    .segment:not(.is-active):hover { color: var(--text); }
    .settings-gear:hover { background: var(--surface); }
  }
  @media (prefers-reduced-motion: reduce) {
    .switch, .switch::after, .swatch-dot { transition: none; }
  }
</style>
