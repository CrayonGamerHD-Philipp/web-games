<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { Check, LoaderCircle, Music, Play, Settings, Shuffle, User, Volume2, X } from '@lucide/svelte';
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
  let previewTimeout: ReturnType<typeof setTimeout> | null = null;
  let resumeMusicAfterPreview = false;
  let loadedPartyNameKey = '';

  $: routeCode = extractPartyCode($page.url.pathname);
  $: currentPlayerId = browser && routeCode ? localStorage.getItem(`party-player:${routeCode}`) ?? '' : '';
  $: selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0];
  $: canRenamePartyPlayer = Boolean(routeCode && currentPlayerId && playerName.trim());
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
      const serverName = String(partyPlayer?.name ?? '').slice(0, 32);
      if (!response.ok || !serverName) return;
      playerName = serverName;
      localStorage.setItem('web-games:player-name', serverName);
      localStorage.setItem(`web-games:player-name:${code}`, serverName);
    } catch {
      // Lokaler Name bleibt bestehen, wenn die Party gerade nicht erreichbar ist.
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
    if (!browser) return;

    document.removeEventListener('pointerdown', handleFirstGesture);
    document.removeEventListener('keydown', handleFirstGesture);
    window.removeEventListener('storage', handleStorage);
    activeAudio?.pause();
    fadingAudio?.pause();
    stopPreview();
  });
</script>

<div class="fixed right-3 top-3 z-[80] sm:right-5 sm:top-5">
  <button
    type="button"
    on:click={() => (isOpen = !isOpen)}
    class="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-white text-slate-700 shadow-xl shadow-slate-900/15 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:text-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-100"
    aria-label="Einstellungen öffnen"
    aria-expanded={isOpen}
  >
    <Settings size={22} />
  </button>
</div>

{#if isOpen}
  <button type="button" class="fixed inset-0 z-[79] bg-slate-950/30 backdrop-blur-sm" on:click={() => (isOpen = false)} aria-label="Einstellungen schließen"></button>
  <section class="fixed right-3 top-16 z-[81] max-h-[calc(100vh-5rem)] w-[min(94vw,29rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl shadow-slate-950/25 sm:right-5 sm:top-20">
    <div class="border-b border-slate-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 px-5 py-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="grid h-11 w-11 place-items-center rounded-xl bg-cyan-600 text-white shadow-lg shadow-cyan-700/20">
            <Settings size={21} />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Einstellungen</p>
            <h2 class="mt-0.5 text-xl font-semibold text-slate-950">Audio & Profil</h2>
          </div>
        </div>
        <button type="button" on:click={() => (isOpen = false)} class="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-cyan-100" aria-label="Einstellungen schließen">
          <X size={19} />
        </button>
      </div>
    </div>

    <div class="max-h-[calc(100vh-10rem)] space-y-4 overflow-y-auto p-5">
      <section class="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <User size={17} /> Profil
        </div>
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Spielername</span>
          <input bind:value={playerName} maxlength="32" class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" placeholder="Dein Name" />
        </label>

        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" on:click={renamePlayer} disabled={isRenaming || !playerName.trim()} class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300">
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
          {#if routeCode && !currentPlayerId}<span class="text-xs text-slate-500">Kein lokaler Spieler für diese Lobby gefunden.</span>{/if}
          {#if renameError}<p class="basis-full text-sm text-red-600">{renameError}</p>{/if}
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Volume2 size={17} /> Lautstärke
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="rounded-lg bg-slate-50 p-3">
            <span class="flex items-center justify-between gap-2 text-sm font-medium text-slate-700"><span>Effekte</span><span class="tabular-nums text-slate-500">{Math.round(effectsVolume * 100)}%</span></span>
            <input type="range" min="0" max="1" step="0.01" bind:value={effectsVolume} on:change={persistSettings} class="mt-3 w-full accent-cyan-600" />
          </label>
          <label class="rounded-lg bg-slate-50 p-3">
            <span class="flex items-center justify-between gap-2 text-sm font-medium text-slate-700"><span>Musik</span><span class="tabular-nums text-slate-500">{Math.round(musicVolume * 100)}%</span></span>
            <input type="range" min="0" max="1" step="0.01" bind:value={musicVolume} on:change={() => { persistSettings(); setAudioVolume(activeAudio, musicVolume); }} class="mt-3 w-full accent-cyan-600" />
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Music size={17} /> Musik-Loop
        </div>
        <label class="flex items-start gap-3 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-3 text-sm">
          <input type="checkbox" bind:checked={musicEnabled} on:change={() => { persistSettings(); applyMusic(); }} class="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
          <span><span class="block font-semibold text-slate-800">Musik aktiv</span><span class="text-slate-500">Startet nach der ersten Eingabe im Browser.</span></span>
        </label>

        <div class="mt-4 space-y-2">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-800">Loop auswählen</h3>
            <span class="text-xs font-medium text-slate-500">Probe stoppt nach 5 Sekunden</span>
          </div>
          <div class="space-y-2">
            {#each tracks as track (track.id)}
              <div class:border-cyan-300={selectedTrackId === track.id} class:bg-cyan-50={selectedTrackId === track.id} class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 transition">
                <button
                  type="button"
                  on:click={() => { selectedTrackId = track.id; persistSettings(); applyMusic(); }}
                  class="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-cyan-100"
                  aria-pressed={selectedTrackId === track.id}
                >
                  <span class="flex min-w-0 items-center gap-2">
                    {#if track.id === 'random'}
                      <Shuffle size={16} class="shrink-0 text-cyan-700" />
                    {:else}
                      <Music size={16} class="shrink-0 text-cyan-700" />
                    {/if}
                    <span class="truncate">{track.name}</span>
                  </span>
                  {#if selectedTrackId === track.id}
                    <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-600 px-2 py-1 text-xs font-semibold text-white"><Check size={13} /> Aktiv</span>
                  {/if}
                </button>
                {#if track.src}
                  <button
                    type="button"
                    on:click={() => previewTrack(track)}
                    class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-100"
                    aria-label={`${track.name} 5 Sekunden abspielen`}
                  >
                    <Play size={16} />
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </section>
    </div>
  </section>
{/if}