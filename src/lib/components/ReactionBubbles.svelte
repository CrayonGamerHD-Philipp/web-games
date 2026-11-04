<script>
  // Eingehende Reaktionen eines Spielers als kurze Blase über seinem Avatar.
  // Das Elternelement muss `position: relative` haben.
  import { onDestroy } from 'svelte';
  import { BUBBLE_MS } from './reactions.js';

  /** @type {import('./reactions.js').Reaction[]} */
  export let reactions = [];
  export let playerId = '';
  /** 'above': schwebt über dem Avatar nach oben · 'over': liegt auf dem Avatar (für Leisten, die oben abschneiden) */
  export let placement = /** @type {'above' | 'over'} */ ('above');
  /** Höchstens so viele gleichzeitig (ältere werden ersetzt) */
  export let max = 3;

  /** IDs, die wir schon gesehen haben – nach Server-ID, Zeitpunkt nach Client-Uhr. */
  const seen = new Set();
  /** @type {{ id: string, emoji: string }[]} */
  let visible = [];
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const timers = new Map();

  $: ingest(reactions, playerId);

  /**
   * @param {import('./reactions.js').Reaction[]} list
   * @param {string} id
   */
  function ingest(list, id) {
    const current = new Set();
    for (const reaction of list ?? []) {
      current.add(reaction.id);
      if (reaction.playerId !== id || seen.has(reaction.id)) continue;
      seen.add(reaction.id);
      show(reaction);
    }
    // Was der Server nicht mehr schickt, kommt nie wieder: vergessen.
    for (const known of [...seen]) if (!current.has(known)) seen.delete(known);
  }

  /** @param {import('./reactions.js').Reaction} reaction */
  function show(reaction) {
    const limit = placement === 'over' ? 1 : max;
    visible = [...visible, { id: reaction.id, emoji: reaction.emoji }].slice(-limit);
    timers.set(
      reaction.id,
      setTimeout(() => {
        visible = visible.filter((bubble) => bubble.id !== reaction.id);
        timers.delete(reaction.id);
      }, BUBBLE_MS)
    );
  }

  onDestroy(() => {
    for (const timer of timers.values()) clearTimeout(timer);
  });
</script>

{#if visible.length}
  <span class="rb rb--{placement}" aria-hidden="true">
    {#each visible as bubble (bubble.id)}
      <span class="rb-bubble">{bubble.emoji}</span>
    {/each}
  </span>
{/if}

<style>
  .rb {
    position: absolute;
    left: 50%;
    z-index: 5;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 2px;
    pointer-events: none;
    transform: translateX(-50%);
  }
  .rb--above { bottom: calc(100% - 4px); }
  .rb--over { top: 50%; transform: translate(-50%, -50%); }

  .rb-bubble {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--border);
    box-shadow: 0 6px 14px -6px rgb(0 0 0 / 0.35);
    font-size: 1.25rem;
    line-height: 1;
    font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
    animation: rb-float 3000ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    will-change: transform, opacity;
  }
  .rb--over .rb-bubble { animation-name: rb-pop; width: 30px; height: 30px; font-size: 1.1rem; }

  @keyframes rb-float {
    0% { opacity: 0; transform: translateY(10px) scale(0.6); }
    10% { opacity: 1; transform: translateY(0) scale(1.08); }
    18% { transform: translateY(-2px) scale(1); }
    80% { opacity: 1; transform: translateY(-14px) scale(1); }
    100% { opacity: 0; transform: translateY(-22px) scale(0.95); }
  }
  @keyframes rb-pop {
    0% { opacity: 0; transform: translateY(4px) scale(0.6); }
    10% { opacity: 1; transform: translateY(0) scale(1.1); }
    18% { transform: scale(1); }
    80% { opacity: 1; transform: translateY(-3px) scale(1); }
    100% { opacity: 0; transform: translateY(-6px) scale(0.9); }
  }
  @keyframes rb-fade {
    0% { opacity: 0; }
    10%, 80% { opacity: 1; }
    100% { opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rb-bubble, .rb--over .rb-bubble { animation-name: rb-fade; animation-timing-function: linear; }
  }
</style>
