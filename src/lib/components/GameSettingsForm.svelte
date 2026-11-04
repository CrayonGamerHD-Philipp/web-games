<script>
  // Formular für Spieleinstellungen, erzeugt aus dem Schema (Schalter + Auswahl-Pills).
  import { createEventDispatcher, tick } from 'svelte';

  /** @type {import('$lib/party-features.js').GameSetting[]} */
  export let settings = [];
  /** @type {Record<string, string | number | boolean>} */
  export let values = {};
  /** Eindeutiger Präfix für IDs (mehrere Formulare auf einer Seite) */
  export let idPrefix = 'game-setting';
  export let disabled = false;

  const dispatch = createEventDispatcher();

  /**
   * @param {string} key
   * @param {string | number | boolean} value
   */
  function setValue(key, value) {
    if (disabled || values[key] === value) return;
    values = { ...values, [key]: value };
    dispatch('change', values);
  }

  /**
   * Pfeiltasten wählen im Radiogroup-Muster die nächste Option.
   * @param {KeyboardEvent} event
   * @param {import('$lib/party-features.js').GameSetting} setting
   * @param {number} index
   */
  async function handleChoiceKeydown(event, setting, index) {
    if (setting.type !== 'choice') return;
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const count = setting.options.length;
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? count - 1
      : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % count
      : (index - 1 + count) % count;
    setValue(setting.key, setting.options[next].value);
    await tick();
    const group = /** @type {HTMLElement | null} */ (event.currentTarget instanceof HTMLElement ? event.currentTarget.parentElement : null);
    /** @type {HTMLElement | null | undefined} */ (group?.querySelectorAll('[role="radio"]')[next])?.focus();
  }

  /**
   * @param {import('$lib/party-features.js').GameSetting} setting
   * @param {number} index
   */
  function isTabStop(setting, index) {
    if (setting.type !== 'choice') return false;
    const selectedIndex = setting.options.findIndex((option) => String(option.value) === String(values[setting.key]));
    return selectedIndex === -1 ? index === 0 : selectedIndex === index;
  }
</script>

<div class="gs">
  {#each settings as setting (setting.key)}
    {@const labelId = `${idPrefix}-${setting.key}-label`}
    {@const descId = `${idPrefix}-${setting.key}-desc`}
    {#if setting.type === 'toggle'}
      {@const on = Boolean(values[setting.key])}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={setting.description ? descId : undefined}
        {disabled}
        class="gs-row gs-toggle"
        on:click={() => setValue(setting.key, !on)}
      >
        <span class="gs-text">
          <span id={labelId} class="gs-label">{setting.label}</span>
          {#if setting.description}<span id={descId} class="gs-desc">{setting.description}</span>{/if}
        </span>
        <span class="gs-switch" class:is-on={on} aria-hidden="true"><span class="gs-thumb"></span></span>
      </button>
    {:else}
      <div class="gs-row gs-choice">
        <span class="gs-text">
          <span id={labelId} class="gs-label">{setting.label}</span>
          {#if setting.description}<span id={descId} class="gs-desc">{setting.description}</span>{/if}
        </span>
        <div class="gs-seg" role="radiogroup" aria-labelledby={labelId} aria-describedby={setting.description ? descId : undefined}>
          {#each setting.options as option, index (option.value)}
            {@const selected = String(values[setting.key]) === String(option.value)}
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              tabindex={isTabStop(setting, index) ? 0 : -1}
              {disabled}
              class="gs-option"
              class:is-selected={selected}
              on:click={() => setValue(setting.key, option.value)}
              on:keydown={(event) => handleChoiceKeydown(event, setting, index)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
</div>

<style>
  .gs {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-inner);
    background: var(--raised);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .gs-row { padding: 14px 16px; }
  .gs-row + .gs-row { border-top: 1px solid var(--border); }

  .gs-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .gs-label { font-weight: 600; line-height: 1.3; }
  .gs-desc { font-size: 0.875rem; line-height: 1.35; color: var(--muted); }

  /* Schalter: ganze Zeile ist das Bedienelement */
  .gs-toggle {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 56px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .gs-toggle:focus-visible { outline: 2px solid var(--accent-main); outline-offset: -3px; border-radius: var(--radius-inner); }
  .gs-toggle:disabled { cursor: not-allowed; opacity: 0.6; }
  .gs-switch {
    position: relative;
    flex-shrink: 0;
    width: 48px;
    height: 28px;
    border-radius: 999px;
    background: var(--control);
    transition: background-color 150ms ease;
  }
  .gs-switch.is-on { background: var(--accent-main); }
  .gs-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
    transition: transform 150ms ease;
  }
  .gs-switch.is-on .gs-thumb { transform: translateX(20px); }

  /* Auswahl: Segment-Pills */
  .gs-choice { display: flex; flex-direction: column; gap: 10px; }
  .gs-seg {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: var(--surface);
  }
  .gs-option {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-size: 0.9375rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }
  .gs-option:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 1px; }
  .gs-option:active:not(:disabled) { background: var(--surface-2); }
  .gs-option.is-selected {
    background: var(--raised);
    color: var(--accent-text);
    box-shadow: inset 0 0 0 1.5px var(--accent-main);
  }
  .gs-option:disabled { cursor: not-allowed; }

  @media (hover: hover) and (pointer: fine) {
    .gs-toggle:hover:not(:disabled) { background: var(--surface); }
    .gs-option:hover:not(:disabled):not(.is-selected) { color: var(--text); }
  }

  @media (prefers-reduced-motion: reduce) {
    .gs-switch, .gs-thumb, .gs-option { transition: none; }
  }
</style>
