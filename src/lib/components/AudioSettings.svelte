<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { Check, LoaderCircle, Play, Settings, Shuffle, Volume2, X } from '@lucide/svelte';
  import { onDestroy, onMount } from 'svelte';

  type MusicTrack = { id: string; name: string; src: string };
  type StoredAudioSettings = { playerName?: string; effectsVolume?: number; musicVolume?: number; musicEnabled?: boolean; selectedTrackId?: string };

  const storageKey = 'web-games:audio-settings';
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
  let saved = false;
  let renameStatus = '';
  let renameError = '';
  let isRenaming = false;
  let activeAudio: HTMLAudioElement | null = null;
  let fadingAudio: HTMLAudioElement | null = null;
  let previewAudio: HTMLAudioElement | null = null;
  let hasUserInteracted = false;
  let lastStartedTrackId = '';

  $: routeCode = extractPartyCode($page.url.pathname);
  $: currentPlayerId = browser && routeCode ? localStorage.getItem(`party-player:${routeCode}`) ?? '' : '';
  $: selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0];
  $: canRenamePartyPlayer = Boolean(routeCode && currentPlayerId && playerName.trim());

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
    playerName = String(stored.playerName ?? localStorage.getItem('web-games:player-name') ?? '').slice(0, 32);
    effectsVolume = Number.isFinite(stored.effectsVolume) ? Number(stored.effectsVolume) : 0.85;
    musicVolume = Number.isFinite(stored.musicVolume) ? Number(stored.musicVolume) : 0.35;
    musicEnabled = stored.musicEnabled !== false;
    selectedTrackId = stored.selectedTrackId ?? 'random';

    if (!stored.selectedTrackId) {
      selectedTrackId = 'random';
    }
  }

  function persistSettings() {
    if (!browser) return;

    const payload = { playerName: playerName.trim(), effectsVolume, musicVolume, musicEnabled, selectedTrackId };
    localStorage.setItem(storageKey, JSON.stringify(payload));
    localStorage.setItem('web-games:player-name', payload.playerName);
    localStorage.setItem('web-games:effects-volume', String(effectsVolume));
    window.dispatchEvent(new CustomEvent('web-games:audio-settings', { detail: payload }));
    saved = true;
    setTimeout(() => {
      saved = false;
    }, 1300);
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

  function previewTrack(track: MusicTrack) {
    if (!browser || !track.src) return;
    previewAudio?.pause();
    previewAudio = new Audio(track.src);
    previewAudio.volume = musicVolume;
    previewAudio.currentTime = 0;
    void previewAudio.play().then(() => {
      setTimeout(() => {
        if (previewAudio) previewAudio.pause();
      }, 4500);
    }).catch(() => {});
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
        body: JSON.stringify({ action: 'rename', playerId: currentPlayerId, name: playerName })
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
    if (event.key === storageKey || event.key === 'web-games:effects-volume') {
      loadSettings();
      setAudioVolume(activeAudio, musicVolume);
    }
  }

  $: if (browser && activeAudio) setAudioVolume(activeAudio, musicVolume);

  onMount(() => {
    loadSettings();
    document.addEventListener('pointerdown', handleFirstGesture, { once: true });
    document.addEventListener('keydown', handleFirstGesture, { once: true });
    window.addEventListener('storage', handleStorage);
  });

  onDestroy(() => {
    document.removeEventListener('pointerdown', handleFirstGesture);
    document.removeEventListener('keydown', handleFirstGesture);
    window.removeEventListener('storage', handleStorage);
    activeAudio?.pause();
    fadingAudio?.pause();
    previewAudio?.pause();
  });
</script>

<div class="fixed right-3 top-3 z-[80] sm:right-5 sm:top-5">
  <button
    type="button"
    on:click={() => (isOpen = !isOpen)}
    class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg shadow-slate-900/10 transition hover:border-cyan-300 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100"
    aria-label="Einstellungen öffnen"
    aria-expanded={isOpen}
  >
    <Settings size={21} />
  </button>
</div>

{#if isOpen}
  <button type="button" class="fixed inset-0 z-[79] bg-slate-950/25 backdrop-blur-sm" on:click={() => (isOpen = false)} aria-label="Einstellungen schließen"></button>
  <section class="fixed right-3 top-16 z-[81] max-h-[calc(100vh-5rem)] w-[min(92vw,26rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl sm:right-5 sm:top-20 sm:p-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Einstellungen</p>
        <h2 class="mt-1 text-xl font-semibold">Audio & Profil</h2>
      </div>
      <button type="button" on:click={() => (isOpen = false)} class="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Einstellungen schließen">
        <X size={19} />
      </button>
    </div>

    <div class="mt-5 space-y-5">
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Spielername</span>
        <input bind:value={playerName} maxlength="32" class="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" placeholder="Dein Name" />
      </label>

      <button type="button" on:click={renamePlayer} disabled={isRenaming || !playerName.trim()} class="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300">
        {#if isRenaming}
          <LoaderCircle class="animate-spin" size={17} />
          Speichert
        {:else if saved || renameStatus}
          <Check size={17} />
          Gespeichert
        {:else}
          Speichern
        {/if}
      </button>
      {#if renameError}<p class="text-sm text-red-600">{renameError}</p>{/if}

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="flex items-center gap-2 text-sm font-medium text-slate-700"><Volume2 size={16} /> Effekte</span>
          <input type="range" min="0" max="1" step="0.01" bind:value={effectsVolume} on:change={persistSettings} class="mt-2 w-full accent-cyan-600" />
          <span class="text-xs text-slate-500">{Math.round(effectsVolume * 100)}%</span>
        </label>
        <label class="block">
          <span class="flex items-center gap-2 text-sm font-medium text-slate-700"><Volume2 size={16} /> Musik</span>
          <input type="range" min="0" max="1" step="0.01" bind:value={musicVolume} on:change={() => { persistSettings(); setAudioVolume(activeAudio, musicVolume); }} class="mt-2 w-full accent-cyan-600" />
          <span class="text-xs text-slate-500">{Math.round(musicVolume * 100)}%</span>
        </label>
      </div>

      <label class="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
        <input type="checkbox" bind:checked={musicEnabled} on:change={() => { persistSettings(); applyMusic(); }} class="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
        <span><span class="block font-semibold text-slate-800">Musik aktiv</span><span class="text-slate-500">Startet nach der ersten Eingabe im Browser.</span></span>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-slate-700">Musik-Loop</span>
        <select bind:value={selectedTrackId} on:change={() => { persistSettings(); applyMusic(); }} class="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
          {#each tracks as track (track.id)}
            <option value={track.id}>{track.name}</option>
          {/each}
        </select>
      </label>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-slate-800">Kurz reinhören</h3>
          <button type="button" on:click={() => { selectedTrackId = 'random'; persistSettings(); applyMusic(); }} class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
            <Shuffle size={14} /> Zufall
          </button>
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each playableTracks as track (track.id)}
            <button type="button" on:click={() => previewTrack(track)} class="inline-flex min-h-9 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700">
              <span class="truncate">{track.name}</span>
              <Play size={15} />
            </button>
          {/each}
        </div>
      </div>
    </div>
  </section>
{/if}



