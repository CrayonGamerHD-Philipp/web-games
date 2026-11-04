<script>
  import { tick } from 'svelte';
  import {
    CATEGORY_HINTS,
    CATEGORY_NAMES,
    LOWER_CATEGORIES,
    UPPER_BONUS,
    UPPER_BONUS_THRESHOLD,
    UPPER_CATEGORIES,
    scoreCategory,
    sheetTotals
  } from '../rules.js';

  /** @typedef {import('../types').BlockCategory} BlockCategory */
  /** @typedef {import('../types').BlockSheet} BlockSheet */

  /** @type {BlockSheet} */
  export let sheet = {};
  /** Dice for the point preview of open rows; `null` = no preview. */
  /** @type {number[] | null} */
  export let dice = null;
  /** @type {boolean} */
  export let canScore = false;
  /** @type {string} */
  export let idPrefix = 'wb-sheet';
  /** Highlights the row that was just filled. */
  /** @type {BlockCategory | null} */
  export let recent = null;
  /** @type {(category: BlockCategory) => void} */
  export let onScore = () => {};

  /** @type {BlockCategory | null} */
  let armed = null;
  /** @type {HTMLElement | null} */
  let root = null;

  $: totals = sheetTotals(sheet);
  $: previews = computePreviews(dice, sheet);
  $: bonusProgress = Math.min(1, totals.upper / UPPER_BONUS_THRESHOLD);
  $: upperDone = UPPER_CATEGORIES.every((category) => typeof sheet[category] === 'number');
  $: resetArmed(dice, canScore);

  /**
   * @param {number[] | null} currentDice
   * @param {BlockSheet} currentSheet
   */
  function computePreviews(currentDice, currentSheet) {
    /** @type {Partial<Record<BlockCategory, number>>} */
    const result = {};
    if (!currentDice || currentDice.some((value) => !value)) return result;
    for (const category of [...UPPER_CATEGORIES, ...LOWER_CATEGORIES]) {
      if (typeof currentSheet[category] !== 'number') result[category] = scoreCategory(category, currentDice);
    }
    return result;
  }

  /**
   * @param {unknown} _dice
   * @param {boolean} _can
   */
  function resetArmed(_dice, _can) {
    armed = null;
  }

  /** @param {BlockCategory} category */
  async function pick(category) {
    if (!canScore || typeof sheet[category] === 'number') return;
    const points = previews[category] ?? 0;
    if (points === 0) {
      armed = category;
      await tick();
      /** @type {HTMLElement | null} */ (root?.querySelector(`[data-confirm="${category}"]`) ?? null)?.focus();
      return;
    }
    armed = null;
    onScore(category);
  }

  /** @param {BlockCategory} category */
  function confirmStrike(category) {
    armed = null;
    onScore(category);
  }

  /** @param {BlockCategory} category */
  async function cancelStrike(category) {
    armed = null;
    await tick();
    /** @type {HTMLElement | null} */ (root?.querySelector(`[data-row="${category}"]`) ?? null)?.focus();
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if (event.key === 'Escape' && armed) {
      event.preventDefault();
      event.stopPropagation();
      void cancelStrike(armed);
    }
  }

  /** @param {BlockCategory} category */
  function rowLabel(category) {
    const value = sheet[category];
    const name = CATEGORY_NAMES[category];
    if (typeof value === 'number') return `${name}: ${value === 0 ? 'gestrichen' : `${value} Punkte`}`;
    const preview = previews[category];
    if (preview === undefined) return `${name}: frei`;
    return preview > 0 ? `${name} eintragen: ${preview} Punkte` : `${name} streichen: 0 Punkte`;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wb-sheet" bind:this={root} on:keydown={handleKeydown}>
  {#each [{ key: 'upper', title: 'Obere Hälfte', list: UPPER_CATEGORIES }, { key: 'lower', title: 'Untere Hälfte', list: LOWER_CATEGORIES }] as section (section.key)}
    <section class="wb-sheet-part" aria-labelledby="{idPrefix}-{section.key}">
      <h3 class="wb-sheet-title" id="{idPrefix}-{section.key}">{section.title}</h3>
      <ul class="wb-rows">
        {#each section.list as category (category)}
          {@const value = sheet[category]}
          {@const filled = typeof value === 'number'}
          {@const preview = previews[category]}
          <li class="wb-row-item">
            {#if armed === category}
              <div class="wb-row wb-row--confirm" role="group" aria-label={`${CATEGORY_NAMES[category]} streichen?`}>
                <span class="wb-row-name">
                  <span class="wb-row-title">{CATEGORY_NAMES[category]}</span>
                  <span class="wb-row-hint wb-row-hint--strike">Streichen? Gibt 0 Punkte.</span>
                </span>
                <span class="wb-confirm-actions">
                  <button type="button" class="wb-mini-btn" on:click={() => cancelStrike(category)}>Nein</button>
                  <button type="button" class="wb-mini-btn wb-mini-btn--strike" data-confirm={category} on:click={() => confirmStrike(category)}>Streichen</button>
                </span>
              </div>
            {:else if canScore && !filled}
              <button
                type="button"
                class="wb-row wb-row--open"
                class:is-zero={preview === 0}
                data-row={category}
                aria-label={rowLabel(category)}
                on:click={() => pick(category)}
              >
                <span class="wb-row-name">
                  <span class="wb-row-title">{CATEGORY_NAMES[category]}</span>
                  <span class="wb-row-hint">{CATEGORY_HINTS[category]}</span>
                </span>
                <span class="wb-preview ui-num" class:is-zero={preview === 0} aria-hidden="true">{preview ?? ''}</span>
              </button>
            {:else}
              <div class="wb-row" class:is-filled={filled} class:is-recent={recent === category && filled} aria-label={rowLabel(category)} role="group">
                <span class="wb-row-name">
                  <span class="wb-row-title">{CATEGORY_NAMES[category]}</span>
                  <span class="wb-row-hint">{CATEGORY_HINTS[category]}</span>
                </span>
                {#if filled}
                  <span class="wb-value ui-num" class:is-struck={value === 0} aria-hidden="true">{value === 0 ? '–' : value}</span>
                {:else}
                  <span class="wb-value wb-value--open" aria-hidden="true"></span>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>

      {#if section.key === 'upper'}
        <div class="wb-sum-row">
          <span class="wb-bonus">
            <span class="wb-bonus-text">
              Bonus ab {UPPER_BONUS_THRESHOLD}
              <span class="ui-num wb-bonus-count">{totals.upper}/{UPPER_BONUS_THRESHOLD}</span>
            </span>
            <span class="wb-bar" role="progressbar" aria-label="Fortschritt zum Bonus" aria-valuemin="0" aria-valuemax={UPPER_BONUS_THRESHOLD} aria-valuenow={Math.min(totals.upper, UPPER_BONUS_THRESHOLD)}>
              <span class="wb-bar-fill" style="transform: scaleX({bonusProgress})"></span>
            </span>
          </span>
          <span class="wb-value ui-num" class:is-bonus={totals.bonus > 0}>
            {#if totals.bonus > 0}+{UPPER_BONUS}{:else if upperDone}0{:else}<span class="wb-muted">+{UPPER_BONUS}?</span>{/if}
          </span>
        </div>
      {/if}
    </section>
  {/each}

  <div class="wb-total">
    <span>Gesamt</span>
    <span class="ui-num wb-total-value">{totals.total}</span>
  </div>
</div>

<style>
  .wb-sheet {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  @media (min-width: 720px) {
    .wb-sheet {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 20px;
      align-items: start;
    }

    .wb-total {
      grid-column: 1 / -1;
    }
  }

  .wb-sheet-part {
    min-width: 0;
  }

  .wb-sheet-title {
    margin: 0 0 6px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--muted);
  }

  .wb-rows {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .wb-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    padding: 4px 12px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    text-align: left;
    font: inherit;
  }

  .wb-row--open {
    background: var(--raised);
    border-color: var(--control);
    cursor: pointer;
    transition: border-color 120ms ease, transform 120ms ease, background-color 120ms ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .wb-row--open:active {
    transform: scale(0.985);
    background: var(--surface-2);
  }

  .wb-row--open:focus-visible,
  .wb-mini-btn:focus-visible {
    outline: 2px solid var(--accent-main);
    outline-offset: 2px;
  }

  .wb-row.is-recent {
    border-color: var(--accent-main);
  }

  .wb-row--confirm {
    background: color-mix(in srgb, var(--negative) 9%, var(--raised));
    border-color: var(--negative);
    padding-right: 6px;
  }

  .wb-row-name {
    display: grid;
    min-width: 0;
  }

  .wb-row-title {
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .wb-row-hint {
    font-size: 0.75rem;
    line-height: 1.3;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wb-row-hint--strike {
    color: var(--negative);
  }

  .wb-value,
  .wb-preview {
    flex-shrink: 0;
    min-width: 2.5rem;
    text-align: right;
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .wb-value.is-struck {
    color: var(--muted);
  }

  .wb-value.is-bonus {
    color: var(--positive);
  }

  .wb-preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.75rem;
    height: 30px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .wb-preview.is-zero {
    background: transparent;
    color: var(--muted);
    outline: 1px solid var(--control);
    outline-offset: -1px;
  }

  .wb-muted {
    color: var(--muted);
    font-weight: 500;
  }

  .wb-confirm-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .wb-mini-btn {
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: var(--pill-neutral-bg);
    color: var(--pill-neutral-ink);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
  }

  .wb-mini-btn--strike {
    background: var(--negative);
    color: #fff;
  }

  :global(html[data-theme='dark']) .wb-mini-btn--strike {
    color: #1b0d0b;
  }

  .wb-mini-btn:active {
    transform: scale(0.96);
  }

  .wb-sum-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 4px;
    min-height: 44px;
    padding: 4px 12px;
  }

  .wb-bonus {
    display: grid;
    gap: 6px;
    flex: 1;
    min-width: 0;
    max-width: 14rem;
  }

  .wb-bonus-text {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .wb-bonus-count {
    color: var(--text);
    font-weight: 600;
  }

  .wb-bar {
    display: block;
    height: 6px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .wb-bar-fill {
    display: block;
    height: 100%;
    background: var(--accent-main);
    transform-origin: left center;
    transition: transform 300ms ease;
  }

  .wb-total {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 10px 12px 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .wb-total-value {
    font-size: 1.5rem;
  }

  @media (hover: hover) and (pointer: fine) {
    .wb-row--open:hover {
      border-color: var(--accent-main);
    }

    .wb-mini-btn:hover {
      background: var(--surface-2);
    }

    .wb-mini-btn--strike:hover {
      background: color-mix(in srgb, var(--negative) 85%, black);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wb-row--open,
    .wb-bar-fill {
      transition: none;
    }
  }
</style>
