<script>
  import { ArrowRight } from '@lucide/svelte';
  import { games } from '../games/registry';

  /** @param {{ minPlayers?: number, maxPlayers?: number }} game */
  function playerRange(game) {
    const min = game.minPlayers ?? 1;
    const max = game.maxPlayers;
    if (!max) return `ab ${min} Spieler`;
    if (min === max) return `${min} Spieler`;
    return `${min}–${max} Spieler`;
  }
</script>

<svelte:head>
  <title>Web Games</title>
  <meta name="description" content="Starte eine neue Party oder tritt einer bestehenden Party bei." />
</svelte:head>

<main class="ui-page">
  <header>
    <h1 class="ui-title pr-14 sm:pr-0">Was spielen wir heute?</h1>
    <p class="ui-lead">Starte eine Party und teile den Code – oder steig mit einem Code bei Freunden ein.</p>
  </header>

  <section aria-label="Party" class="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4">
    <a href="/party/starten" class="action action--primary" aria-label="Neue Party starten">
      <span class="action-text">
        <span class="action-title">Party starten</span>
        <span class="action-sub">Neue Runde erstellen und andere einladen.</span>
      </span>
      <ArrowRight size={22} aria-hidden="true" />
    </a>

    <a href="/party/beitreten" class="action" aria-label="Einer Party beitreten">
      <span class="action-text">
        <span class="action-title">Party beitreten</span>
        <span class="action-sub">Du hast einen Code bekommen? Hier eingeben.</span>
      </span>
      <ArrowRight size={22} aria-hidden="true" />
    </a>
  </section>

  <section aria-labelledby="games-title" class="mt-12 sm:mt-16">
    <h2 id="games-title" class="ui-section-title">Diese Spiele gibt es</h2>
    <ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {#each games as game (game.id)}
        <li>
          <a href="/games/{game.id}" class="game">
            <span class="game-thumb">
              {#if game.previewImage}
                <img src={game.previewImage} alt="" loading="lazy" width="160" height="120" />
              {/if}
            </span>
            <span class="min-w-0">
              <span class="block font-semibold text-[color:var(--text)]">{game.name}</span>
              <span class="ui-muted ui-num mt-0.5 block text-sm">{playerRange(game)}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
</main>

<style>
  .action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 96px;
    padding: 20px 24px;
    border-radius: var(--radius-card);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    transition: background-color 150ms ease, transform 120ms ease;
    -webkit-tap-highlight-color: transparent;
  }
  .action--primary {
    background: var(--accent-main);
    color: #fff;
  }
  .action:active { transform: scale(0.99); }
  .action:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 3px; }
  .action-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .action-title { font-size: 1.375rem; line-height: 1.2; font-weight: 600; }
  .action-sub { font-size: 0.9375rem; line-height: 1.4; color: var(--muted); }
  .action--primary .action-sub { color: rgb(255 255 255 / 0.85); }

  @media (min-width: 640px) {
    .action { min-height: 140px; padding: 24px 28px; align-items: flex-end; }
    .action-title { font-size: 1.625rem; }
  }

  .game {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 44px;
    padding: 10px;
    border-radius: var(--radius-inner);
    color: inherit;
    text-decoration: none;
    transition: background-color 150ms ease;
  }
  .game:focus-visible { outline: 2px solid var(--accent-main); outline-offset: 2px; }
  .game:active { background: var(--surface); }
  .game-thumb {
    flex-shrink: 0;
    width: 80px;
    height: 60px;
    overflow: hidden;
    border-radius: 10px;
    background: var(--surface);
  }
  .game-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }

  @media (hover: hover) and (pointer: fine) {
    .action:hover { background: var(--surface-2); }
    .action--primary:hover { background: var(--accent-hover); }
    .game:hover { background: var(--surface); }
  }

  @media (prefers-reduced-motion: reduce) {
    .action, .game { transition: none; }
    .action:active { transform: none; }
  }
</style>
