<script>
  import Glyph from './Glyph.svelte';
  import { JOKERS, MAX_HEARTS } from '../rules.js';

  /** Wertung und Vorrat eines Spielers – für dich in der Seitenleiste und für Mitspieler im Fenster. */

  /** @type {import('../types').NochMalPlayer} */
  export let player;
  /** @type {boolean} */
  export let extended = false;
  /** @type {boolean} */
  export let running = true;
  /** @type {string} */
  export let label = 'Punkte bisher';

  $: score = player.score;
  $: jokersLeft = JOKERS - player.usedJokers;
</script>

<div class="kz-sheet">
  <div class="kz-score-head">
    <span class="kz-score-total ui-num">{score.total}</span>
    <span class="kz-score-label">{running ? label : 'Punkte'}</span>
  </div>
  <dl class="kz-score-list">
    <div><dt>Spalten</dt><dd class="ui-num">{score.columns}</dd></div>
    {#if extended}<div><dt>Zeilen</dt><dd class="ui-num">{score.rows}</dd></div>{/if}
    <div><dt>Farben</dt><dd class="ui-num">{score.colors}</dd></div>
    {#if extended}<div><dt>Herzbonus</dt><dd class="ui-num">{score.hearts}</dd></div>{/if}
    <div><dt>Joker übrig</dt><dd class="ui-num">+{score.jokers}</dd></div>
    {#if extended}<div><dt>Marken übrig</dt><dd class="ui-num">+{score.tokens}</dd></div>{/if}
    <div><dt>Offene Sterne</dt><dd class="ui-num kz-neg">{score.stars}</dd></div>
  </dl>
  <div class="kz-res">
    <span class="kz-res-label">Joker</span>
    <span class="kz-res-slots" aria-label={`${jokersLeft} von ${JOKERS} Jokern übrig`}>
      {#each Array(JOKERS) as _, index (index)}<span class="kz-slot" class:is-used={index >= jokersLeft}></span>{/each}
    </span>
  </div>
  {#if extended}
    <div class="kz-res">
      <span class="kz-res-label">Herzen</span>
      <span class="kz-res-slots" aria-label={`${player.hearts} von ${MAX_HEARTS} Herzen`}>
        {#each Array(MAX_HEARTS) as _, index (index)}<span class="kz-heart" class:is-on={index < player.hearts}><Glyph name="heart" size={14} /></span>{/each}
      </span>
    </div>
    <div class="kz-res">
      <span class="kz-res-label">Marken</span>
      <span class="kz-res-tokens">
        <Glyph name="token" size={16} label="Sonderwürfel-Marken" /><span class="ui-num">{player.specialTokens}</span>
        {#if player.bonusBombs}<Glyph name="bomb" size={16} label="Bonusbomben" /><span class="ui-num">{player.bonusBombs}</span>{/if}
      </span>
    </div>
  {/if}
</div>

<style>
  .kz-score-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .kz-score-total {
    font-size: 2.5rem;
    font-weight: 750;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .kz-score-label {
    font-size: 0.875rem;
    color: var(--muted);
  }

  .kz-score-list {
    display: grid;
    gap: 4px;
    margin: 14px 0;
  }

  .kz-score-list div {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .kz-score-list dt {
    color: var(--muted);
  }

  .kz-score-list dd {
    margin: 0;
    font-weight: 650;
  }

  .kz-neg {
    color: var(--negative);
  }

  .kz-res {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
  }

  .kz-res-label {
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .kz-res-slots {
    display: flex;
    gap: 4px;
  }

  .kz-slot {
    width: 12px;
    height: 18px;
    border-radius: 4px;
    background: #1d1e1c;
  }

  :global(html[data-theme='dark']) .kz-slot {
    background: #e7e7e3;
  }

  .kz-slot.is-used,
  :global(html[data-theme='dark']) .kz-slot.is-used {
    background: var(--surface-2);
  }

  .kz-heart {
    display: inline-flex;
    color: var(--control);
  }

  .kz-heart.is-on {
    color: #d0315f;
  }

  .kz-res-tokens {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
  }
</style>
