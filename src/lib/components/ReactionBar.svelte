<script>
  // Reihe der Schnell-Reaktionen; sendet `react`, gibt sofort lokales Feedback.
  import { createEventDispatcher, tick } from 'svelte';
  import { REACTIONS } from '$lib/party-features.js';
  import { REACTION_LABELS } from './reactions.js';

  /** Party-Code */
  export let code = '';
  /** Spieler-Token */
  export let token = '';
  export let disabled = false;
  /** Beschriftung der Gruppe für Screenreader */
  export let label = 'Reaktion senden';

  const dispatch = createEventDispatcher();
  const MIN_GAP_MS = 700;

  let popped = '';
  let lastSentAt = 0;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let popTimer;

  /** @param {string} emoji */
  async function send(emoji) {
    if (disabled || !code || !token) return;
    // Lokales Feedback: das gedrückte Emoji hüpft (auch bei schnellem Doppeltipp neu).
    popped = '';
    await tick();
    popped = emoji;
    clearTimeout(popTimer);
    popTimer = setTimeout(() => (popped = ''), 450);
    dispatch('sent', { emoji });

    const now = Date.now();
    if (now - lastSentAt < MIN_GAP_MS) return; // Server würde ohnehin 429 melden.
    lastSentAt = now;
    try {
      await fetch(`/api/parties/${code}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'react', token, emoji })
      });
      // 429 (zu schnell) und andere Fehler bewusst still ignorieren.
    } catch {
      // Netzwerkfehler: Reaktionen sind nicht wichtig genug für eine Meldung.
    }
  }
</script>

<div class="rbar-wrap">
<div class="rbar" role="group" aria-label={label}>
  {#each REACTIONS as emoji (emoji)}
    <button
      type="button"
      class="rbar-btn"
      class:is-pop={popped === emoji}
      {disabled}
      aria-label={REACTION_LABELS[emoji] ?? emoji}
      title={REACTION_LABELS[emoji] ?? emoji}
      on:click={() => send(emoji)}
    >
      <span class="rbar-emoji" aria-hidden="true">{emoji}</span>
    </button>
  {/each}
</div>
</div>

<style>
  .rbar-wrap { container-type: inline-size; }
  /* Schmal: zwei Reihen à vier, sonst eine Reihe – jeder Knopf mindestens 40px breit. */
  .rbar {
    display: grid;
    grid-template-columns: repeat(4, minmax(40px, 1fr));
    gap: 2px;
  }
  @container (min-width: 340px) {
    .rbar { grid-template-columns: repeat(8, minmax(40px, 1fr)); }
  }
  .rbar-btn {
    display: grid;
    place-items: center;
    min-width: 40px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .rbar-btn:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 0; }
  .rbar-btn:active:not(:disabled) { background: var(--surface-2); }
  .rbar-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .rbar-emoji {
    display: block;
    font-size: 1.5rem;
    line-height: 1;
    font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
  }
  .rbar-btn.is-pop .rbar-emoji { animation: rbar-pop 420ms cubic-bezier(0.2, 0.8, 0.2, 1); }
  @keyframes rbar-pop {
    0% { transform: scale(1); }
    35% { transform: scale(1.45) translateY(-4px); }
    100% { transform: scale(1); }
  }

  @media (hover: hover) and (pointer: fine) {
    .rbar-btn:hover:not(:disabled) { background: var(--surface); }
  }

  @media (prefers-reduced-motion: reduce) {
    .rbar-btn.is-pop .rbar-emoji { animation: rbar-pop-fade 420ms ease; }
    @keyframes rbar-pop-fade {
      0%, 100% { opacity: 1; }
      40% { opacity: 0.4; }
    }
  }
</style>
