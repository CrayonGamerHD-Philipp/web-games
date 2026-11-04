<script>
  // Liest neue Reaktionen anderer höflich vor („Anna: 🔥“), gedrosselt und gebündelt.
  import { onDestroy, tick } from 'svelte';

  /** @type {import('./reactions.js').Reaction[]} */
  export let reactions = [];
  /** @type {{ id: string, name: string }[]} */
  export let players = [];
  /** Eigene Reaktionen nicht vorlesen */
  export let currentPlayerId = '';
  /** Mindestabstand zwischen zwei Ansagen */
  export let throttleMs = 2500;

  const seen = new Set();
  /** @type {string[]} */
  let queue = [];
  let message = '';
  let lastAnnouncedAt = 0;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  $: ingest(reactions);

  /** @param {import('./reactions.js').Reaction[]} list */
  function ingest(list) {
    const current = new Set();
    for (const reaction of list ?? []) {
      current.add(reaction.id);
      if (seen.has(reaction.id)) continue;
      seen.add(reaction.id);
      if (reaction.playerId === currentPlayerId) continue;
      const name = players.find((player) => player.id === reaction.playerId)?.name ?? 'Jemand';
      queue = [...queue, `${name}: ${reaction.emoji}`];
    }
    for (const known of [...seen]) if (!current.has(known)) seen.delete(known);
    schedule();
  }

  function schedule() {
    if (!queue.length || timer) return;
    const wait = Math.max(0, lastAnnouncedAt + throttleMs - Date.now());
    timer = setTimeout(flush, wait);
  }

  async function flush() {
    timer = undefined;
    if (!queue.length) return;
    // Bei vielen auf einmal nur die letzten drei vorlesen.
    const text = queue.slice(-3).join(', ');
    queue = [];
    lastAnnouncedAt = Date.now();
    message = '';
    await tick();
    message = text;
  }

  onDestroy(() => clearTimeout(timer));
</script>

<p class="sr-only" aria-live="polite" aria-atomic="true">{message}</p>
