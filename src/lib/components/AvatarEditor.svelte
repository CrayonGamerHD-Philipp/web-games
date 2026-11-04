<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { Check, Dices } from '@lucide/svelte';
  import { AVATAR_PARTS, normalizeAvatar, randomAvatar } from '$lib/party-features.js';
  import PlayerAvatar, { avatarFromName } from './PlayerAvatar.svelte';

  /** @type {import('$lib/party-features.js').Avatar | null | undefined} */
  export let avatar = null;
  /** Vorschaufarbe (Hex) */
  export let color = '#0891b2';
  /** Spielername, nur für Beschriftung und Fallback */
  export let name = '';
  /** Optional: wählbare Farben. Ohne diese Liste gibt es keine Farbzeile. @type {{ id: string, hex: string, taken?: boolean }[] | null} */
  export let colors = null;

  const dispatch = createEventDispatcher();

  /** @type {{ key: 'shape' | 'eyes' | 'mouth' | 'accessory', label: string }[]} */
  const rows = [
    { key: 'shape', label: 'Form' },
    { key: 'eyes', label: 'Augen' },
    { key: 'mouth', label: 'Mund' },
    { key: 'accessory', label: 'Extra' }
  ];

  // Ohne Vorgabe einen stabilen Avatar aus dem Namen übernehmen, damit bind:avatar immer gefüllt ist.
  if (!avatar) avatar = avatarFromName(name);
  $: current = normalizeAvatar(avatar, avatarFromName(name));

  /** @param {import('$lib/party-features.js').Avatar} next */
  function commit(next) {
    avatar = next;
    dispatch('change', next);
  }

  /** @param {'shape' | 'eyes' | 'mouth' | 'accessory'} key @param {number} index */
  function choose(key, index) {
    if (current[key] === index) return;
    commit({ ...current, [key]: index });
  }

  function shuffle() {
    let next = randomAvatar();
    // Nicht zweimal hintereinander exakt denselben Avatar zeigen.
    for (let tries = 0; tries < 4 && JSON.stringify(next) === JSON.stringify(current); tries += 1) next = randomAvatar();
    commit(next);
  }

  /**
   * Pfeiltasten im Radiogroup-Muster: Auswahl folgt dem Fokus.
   * @param {KeyboardEvent} event
   * @param {number} count
   * @param {number} index
   * @param {(next: number) => void} select
   */
  async function handleKeydown(event, count, index, select) {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % count;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else return;
    event.preventDefault();
    const group = /** @type {HTMLElement} */ (event.currentTarget).closest('[role="radiogroup"]');
    select(next);
    await tick();
    /** @type {HTMLElement | null | undefined} */ (group?.querySelectorAll('[role="radio"]')[next])?.focus();
  }

  /** Nächste freie Farbe in Pfeilrichtung (belegte überspringen). @param {KeyboardEvent} event @param {number} index */
  function handleColorKeydown(event, index) {
    const list = colors ?? [];
    const free = list.map((entry, i) => (entry.taken ? -1 : i)).filter((i) => i >= 0);
    if (!free.length) return;
    const position = Math.max(0, free.indexOf(index));
    void handleKeydown(event, free.length, position, (next) => pickColor(list[free[next]].id));
  }

  /** @param {string} id */
  function pickColor(id) {
    const entry = colors?.find((item) => item.id === id);
    if (!entry || entry.taken) return;
    dispatch('color', id);
  }

  $: selectedColorIndex = colors ? colors.findIndex((entry) => entry.hex.toLowerCase() === String(color).toLowerCase()) : -1;
  $: firstFreeColor = colors ? colors.findIndex((entry) => !entry.taken) : -1;
</script>

<div class="avatar-editor">
  <div class="editor-head">
    <PlayerAvatar avatar={current} {name} {color} size={120} decorative={false} />
    <div class="editor-head-side">
      <p class="editor-hint">Stell dir deine Figur aus Form, Augen, Mund und Extra zusammen.</p>
      <button type="button" class="ui-btn" on:click={shuffle}>
        <Dices size={18} aria-hidden="true" />
        Zufällig
      </button>
    </div>
  </div>

  {#if colors && colors.length}
    <div class="editor-row">
      <p class="editor-label" aria-hidden="true">Farbe</p>
      <div class="chip-scroll touch-scroll-x" role="radiogroup" aria-label="Farbe">
        {#each colors as entry, index (entry.id)}
          {@const selected = index === selectedColorIndex}
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Farbe ${index + 1} von ${colors.length}${entry.taken ? ', schon vergeben' : ''}`}
            tabindex={selected || (selectedColorIndex < 0 && index === firstFreeColor) ? 0 : -1}
            disabled={entry.taken}
            class="color-chip"
            class:is-selected={selected}
            on:click={() => pickColor(entry.id)}
            on:keydown={(event) => handleColorKeydown(event, index)}
          >
            <span class="color-dot" style={`background: ${entry.hex}`}>
              {#if selected}<Check size={16} strokeWidth={3} aria-hidden="true" />{/if}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#each rows as row (row.key)}
    {@const count = AVATAR_PARTS[row.key]}
    <div class="editor-row">
      <p class="editor-label" aria-hidden="true">{row.label}</p>
      <div class="chip-scroll touch-scroll-x" role="radiogroup" aria-label={row.label}>
        {#each Array.from({ length: count }, (_, i) => i) as index}
          {@const selected = current[row.key] === index}
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={row.key === 'accessory' && index === 0 ? `${row.label} ${index + 1} von ${count}: keins` : `${row.label} ${index + 1} von ${count}`}
            tabindex={selected ? 0 : -1}
            class="part-chip"
            class:is-selected={selected}
            on:click={() => choose(row.key, index)}
            on:keydown={(event) => handleKeydown(event, count, index, (next) => choose(row.key, next))}
          >
            <PlayerAvatar avatar={{ ...current, [row.key]: index }} {name} {color} size={48} />
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .avatar-editor { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

  .editor-head { display: flex; align-items: center; gap: 16px; }
  .editor-head-side { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; min-width: 0; }
  .editor-hint { margin: 0; font-size: 0.875rem; line-height: 1.4; color: var(--muted); }

  .editor-row { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .editor-label { margin: 0; font-size: 0.8125rem; font-weight: 600; color: var(--text); }

  /* Innenabstand, damit Fokus- und Auswahlring nicht abgeschnitten werden. */
  .chip-scroll { display: flex; gap: 6px; overflow-x: auto; padding: 4px; margin: 0 -4px; scrollbar-width: thin; }

  .part-chip,
  .color-chip {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    cursor: pointer;
    scroll-snap-align: start;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition: background-color 150ms ease, box-shadow 150ms ease, transform 120ms ease;
  }
  .part-chip { width: 60px; height: 60px; border-radius: var(--radius-inner); background: var(--raised); box-shadow: inset 0 0 0 1px var(--border); }
  .part-chip.is-selected { background: var(--accent-soft); box-shadow: inset 0 0 0 2.5px var(--accent-main); }
  :global(html[data-theme='dark']) .part-chip.is-selected { background: color-mix(in srgb, var(--accent-main) 22%, var(--raised)); }
  .part-chip:active { transform: scale(0.95); }

  .color-chip { width: 44px; height: 44px; border-radius: 999px; background: transparent; }
  .color-chip:disabled { cursor: not-allowed; opacity: 0.3; }
  .color-dot { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 999px; color: #fff; }
  .color-chip.is-selected .color-dot { box-shadow: 0 0 0 2px var(--ground), 0 0 0 4px var(--accent-main); }

  .part-chip:focus-visible,
  .color-chip:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 2px; }

  @media (hover: hover) and (pointer: fine) {
    .part-chip:not(.is-selected):hover { background: var(--surface-2); }
  }
  @media (prefers-reduced-motion: reduce) {
    .part-chip, .color-chip { transition: none; }
  }
</style>
