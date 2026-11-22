<script>
  /**
   * Einweisung: Was ist das Ziel, wie verliert man, wie läuft ein Zug?
   * Drei Bilder, je ein Satz – so versteht man das Spiel, bevor man den ersten Zug macht.
   */
  import Guard from './Guard.svelte';
  import Ship from './Ship.svelte';
  import ActionIcon from './ActionIcon.svelte';
  import { MAX_WRECKS, ROLES, STORM_TRACK, ACTIONS_PER_TURN } from '../rules.js';

  /** @type {number} */
  export let target = 6;
  /** @type {import('../types').LtRoleId | null} */
  export let role = null;
  /** @type {() => void} */
  export let onClose = () => {};

  const ACTIONS = /** @type {const} */ ([
    ['walk', 'Gehen'],
    ['sandbag', 'Sandsack'],
    ['kindle', 'Feuer anfachen'],
    ['pilot', 'Lotsen']
  ]);
</script>

<section class="ui-panel lt-guide" aria-labelledby="lt-guide-title">
  <div class="lt-guide-head">
    <h3 id="lt-guide-title" class="lt-guide-title">So gewinnt ihr zusammen</h3>
    <p class="lt-guide-lead">Ihr spielt alle gemeinsam gegen den Sturm. Entweder gewinnt ihr alle oder niemand.</p>
  </div>

  <ol class="lt-goals">
    <li class="lt-goal">
      <svg viewBox="0 0 120 64" aria-hidden="true">
        <rect width="120" height="64" rx="12" fill="#7cc0e0"></rect>
        <path d="M8 40 h70" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="1 7" stroke-linecap="round"></path>
        <g transform="translate(14 14) scale(0.42)"><Ship /></g>
        <path d="M58 38 l8 4 l-8 4" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
        <rect x="80" y="22" width="20" height="34" rx="3" fill="#b07a46" stroke="#5a3a1e" stroke-width="2"></rect>
        <path d="M80 31 h20 M80 40 h20 M80 49 h20" stroke="#5a3a1e" stroke-width="1.4"></path>
      </svg>
      <div>
        <h4>Bringt {target} Schiffe zum Steg</h4>
        <p>Nach jedem Zug fahren die Schiffe ein Feld weiter, wenn ihr Leuchtfeuer brennt. Mit „Lotsen“ geht es schneller.</p>
      </div>
    </li>
    <li class="lt-goal">
      <svg viewBox="0 0 120 64" aria-hidden="true">
        <rect width="120" height="64" rx="12" fill="#1c3150"></rect>
        <circle cx="34" cy="24" r="16" fill="#ffe07a" opacity="0.45"></circle>
        <rect x="31" y="28" width="6" height="18" rx="2" fill="#6b4a2e"></rect>
        <circle cx="34" cy="22" r="8" fill="#ffd66b" stroke="#5a4210" stroke-width="2"></circle>
        <rect x="78" y="28" width="6" height="18" rx="2" fill="#6b4a2e"></rect>
        <circle cx="81" cy="22" r="8" fill="#9aa3ad" stroke="#5a4210" stroke-width="2"></circle>
        <circle cx="100" cy="14" r="7" fill="#e8564a" stroke="#7f1d16" stroke-width="1.8"></circle>
        <path d="M100 10 v4.5" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"></path>
        <circle cx="100" cy="17.5" r="1.3" fill="#ffffff"></circle>
      </svg>
      <div>
        <h4>Haltet die Leuchtfeuer an</h4>
        <p>Ist ein Feuer aus, treibt jedes Schiff in seiner Rinne ab. Beim zweiten Mal zerschellt es an den Klippen. Flackern und Fluten löschen die Feuer, ihr facht sie wieder an.</p>
      </div>
    </li>
    <li class="lt-goal">
      <svg viewBox="0 0 120 64" aria-hidden="true">
        <rect width="120" height="64" rx="12" fill="#7cc0e0"></rect>
        <rect x="14" y="16" width="40" height="40" rx="10" fill="#f1d9a0" stroke="#c8a35c" stroke-width="2"></rect>
        <rect x="20" y="22" width="28" height="28" rx="7" fill="#8fc9c4"></rect>
        <path d="M23 32 q4 -4 8 0 t8 0 t8 0 M26 41 q4 -4 8 0 t8 0" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"></path>
        <g transform="translate(74 6)">
          <path d="M12 52 L28 52 L25 18 L15 18 Z" fill="#ffffff" stroke="#3a4a5c" stroke-width="2.2"></path>
          <path d="M14 42 L26 42 L25.3 34 L14.7 34 Z" fill="#e8564a"></path>
          <rect x="14" y="8" width="12" height="10" rx="2" fill="#ffd66b" stroke="#3a4a5c" stroke-width="2"></rect>
          <path d="M12 9 L20 1 L28 9 Z" fill="#e8564a" stroke="#3a4a5c" stroke-width="2"></path>
        </g>
      </svg>
      <div>
        <h4>Lasst die Insel nicht versinken</h4>
        <p>Eine Flut macht Felder nass, die nächste lässt sie versinken. Ein Sandsack macht sie wieder trocken. Vor allem der Leuchtturm muss stehen bleiben.</p>
      </div>
    </li>
  </ol>

  <div class="lt-lose">
    <strong>Ihr verliert, wenn</strong> {MAX_WRECKS} Schiffe zerschellen, der Leuchtturm versinkt oder die Sturmleiste nach {STORM_TRACK.length} Feldern voll ist.
  </div>

  <div class="lt-turn">
    <div class="lt-turn-text">
      <h4>Dein Zug</h4>
      <p>Du hast {ACTIONS_PER_TURN} Aktionen. Alles, was du gerade tun kannst, leuchtet als Symbol auf dem Brett. Tipp es an. Mit „Zurück“ nimmst du eine Aktion zurück. Nach „Zug beenden“ zieht der Sturm über die Insel.</p>
      <ul class="lt-actions">
        {#each ACTIONS as [type, label] (type)}
          <li><svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="#ffffff" stroke="#1b6e66" stroke-width="2"></circle><ActionIcon {type} /></svg>{label}</li>
        {/each}
      </ul>
    </div>
    {#if role}
      <div class="lt-you">
        <svg viewBox="40 30 120 170" aria-hidden="true"><Guard {role} /></svg>
        <p><strong>Du bist {ROLES[role].name}</strong>, {ROLES[role].title}. {ROLES[role].ability}</p>
      </div>
    {/if}
  </div>

  <button type="button" class="ui-btn lt-guide-close" on:click={onClose}>Verstanden</button>
</section>

<style>
  .lt-guide { display: grid; gap: 16px; }
  .lt-guide-head { display: grid; gap: 2px; }
  .lt-guide-title { margin: 0; font-size: 1.125rem; font-weight: 600; }
  .lt-guide-lead { margin: 0; color: var(--muted); font-size: 0.9375rem; }

  .lt-goals { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
  @media (min-width: 760px) { .lt-goals { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .lt-goal { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; align-items: start; padding: 12px; border-radius: var(--radius-inner); background: var(--raised); }
  @media (min-width: 760px) { .lt-goal { grid-template-columns: minmax(0, 1fr); } }
  .lt-goal svg { width: 100%; height: auto; display: block; }
  @media (min-width: 760px) { .lt-goal svg { max-width: 160px; } }
  .lt-goal h4, .lt-turn h4 { margin: 0 0 2px; font-size: 0.9375rem; font-weight: 600; }
  .lt-goal p, .lt-turn p, .lt-you p { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--muted); }

  .lt-lose { padding: 10px 14px; border-radius: var(--radius-inner); background: color-mix(in srgb, var(--negative) 10%, var(--ground)); font-size: 0.875rem; line-height: 1.45; }
  .lt-lose strong { color: var(--negative); }

  .lt-turn { display: grid; gap: 12px; }
  @media (min-width: 760px) { .lt-turn { grid-template-columns: minmax(0, 1fr) minmax(0, 18rem); align-items: center; } }
  .lt-turn-text { display: grid; gap: 8px; }
  .lt-actions { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; }
  .lt-actions li { display: inline-flex; align-items: center; gap: 6px; }
  .lt-actions svg { width: 24px; height: 24px; }
  .lt-you { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--radius-inner); background: var(--raised); }
  .lt-you svg { width: 56px; height: 64px; }
  .lt-you strong { color: var(--text); }

  .lt-guide-close { justify-self: start; }
</style>
