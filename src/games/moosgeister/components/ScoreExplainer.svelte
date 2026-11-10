<script>
  import { explainLayout } from '../rules.js';

  /** Zeigt Schritt für Schritt, wie die Punkte einer Auslage entstehen. */

  /** @type {import('../types').MoosSlot[]} */
  export let layout = [];
  /** @type {number} */
  export let durchgang = 1;
  /** Hervorgehobene Plätze (0–8) der gewählten Kategorie – für die Auslage daneben. */
  /** @type {number[]} */
  export let highlight = [];
  /** @type {string} */
  export let idPrefix = 'mg-explain';

  /** @type {string | null} */
  let openKey = null;

  $: items = explainLayout(/** @type {any} */ (layout), durchgang);
  $: total = items.reduce((sum, item) => sum + item.points, 0);
  $: highlight = openKey ? items.find((item) => item.key === openKey)?.slots ?? [] : [];

  /** @param {string} key */
  function toggle(key) {
    openKey = openKey === key ? null : key;
  }

  /** @param {number} value */
  function signed(value) {
    return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
  }
</script>

<div class="ex">
  <ul class="ex-list">
    {#each items as item (item.key)}
      {@const open = openKey === item.key}
      <li class="ex-item" class:is-open={open}>
        <button
          type="button"
          class="ex-head"
          aria-expanded={open}
          aria-controls={`${idPrefix}-${item.key}`}
          on:click={() => toggle(item.key)}
        >
          <span class="ex-label">{item.label}</span>
          <span class="ex-points ui-num" class:is-neg={item.points < 0}>{signed(item.points)}</span>
          <span class="ex-chevron" aria-hidden="true"></span>
        </button>
        {#if open}
          <div class="ex-body" id={`${idPrefix}-${item.key}`}>
            <p class="ex-rule">{item.rule}</p>
            {#if item.lines.length}
              <ul class="ex-lines">
                {#each item.lines as line, index (index)}
                  <li>
                    <span>{line.text}</span>
                    <span class="ex-line-points ui-num" class:is-neg={line.points < 0}>{signed(line.points)}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="ex-empty">Noch nichts – hier gibt es bisher 0 Punkte.</p>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="ex-total">
    <span>Summe</span>
    <strong class="ui-num">{total}</strong>
  </p>
</div>

<style>
  .ex {
    display: grid;
    gap: 8px;
  }

  .ex-list {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ex-item {
    border-radius: var(--radius-inner);
    background: var(--surface-2);
  }

  .ex-item.is-open {
    box-shadow: inset 0 0 0 2px var(--accent-main);
  }

  .ex-head {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 8px 12px;
    border: 0;
    border-radius: var(--radius-inner);
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .ex-head:focus-visible {
    outline: 3px solid var(--accent-main);
    outline-offset: 2px;
  }

  .ex-label {
    flex: 1;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .ex-points {
    font-size: 1rem;
    font-weight: 700;
  }

  .is-neg {
    color: var(--negative);
  }

  .ex-chevron {
    width: 8px;
    height: 8px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: rotate(45deg) translateY(-2px);
    transition: transform 150ms ease;
  }

  .is-open .ex-chevron {
    transform: rotate(-135deg) translateY(-2px);
  }

  .ex-body {
    padding: 0 12px 12px;
  }

  .ex-rule {
    margin: 0 0 8px;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--muted);
  }

  .ex-lines {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.875rem;
  }

  .ex-lines li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .ex-line-points {
    font-weight: 700;
    white-space: nowrap;
  }

  .ex-empty {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }

  .ex-total {
    display: flex;
    justify-content: space-between;
    margin: 4px 4px 0;
    font-size: 1rem;
  }

  .ex-total strong {
    font-size: 1.25rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .ex-chevron {
      transition: none;
    }
  }
</style>
