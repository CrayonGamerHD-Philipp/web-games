<script>
  import { onDestroy } from 'svelte';
  import Board from './Board.svelte';
  import Guard from './Guard.svelte';
  import ActionIcon from './ActionIcon.svelte';
  import GoalGuide from './GoalGuide.svelte';
  import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
  import { playerHexById } from '$lib/player-colors.js';
  import {
    ACTIONS_PER_TURN,
    DIFFICULTIES,
    LAMP_AT,
    LAMP_NAMES,
    LANES,
    LANE_IDS,
    LANE_LENGTH,
    LANE_NAMES,
    LIGHTHOUSE,
    MAX_WRECKS,
    PIER,
    ROCKS,
    ROLES,
    STORM_TRACK,
    WRECK_AT,
    cardsForStep,
    isLand,
    keyOf,
    lampAt,
    shipCell,
    shipForecast,
    targetsFor
  } from '../rules.js';

  /** @typedef {import('../types').LtSession} LtSession */
  /** @typedef {import('../types').LtBoardView} LtBoardView */
  /** @typedef {import('../types').LtTarget} LtTarget */
  /** @typedef {import('../types').LtStormFrame} LtStormFrame */
  /** @typedef {import('../types').LtStormRecord} LtStormRecord */
  /** @typedef {import('../types').LtMove} LtMove */

  /** @type {LtSession | null} */
  export let game = null;
  /** @type {string} */
  export let currentPlayerId = '';
  /** @type {boolean} */
  export let isLoading = false;
  /** @type {(move: LtMove) => void} */
  export let onMove = () => {};
  /** @type {number} */
  export let renderNonce = 0;
  /** @type {{ id: string, name?: string, color?: string, avatar?: import('$lib/party-features.js').Avatar | null }[]} */
  export let players = [];
  /** Hält den Ergebnisbildschirm zurück, solange die letzte Animation läuft. @type {(hold: boolean) => void} */
  export let onHoldResult = () => {};

  $: void renderNonce;

  const GUIDE_KEY = 'leuchtturm:guide-seen';
  const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Abgeleiteter Zustand ---------- */
  // Zuerst: neuen Sturm erkennen, damit `playing` schon stimmt, bevor Ziele berechnet werden.
  $: sync(game);
  $: state = game?.state ?? null;
  $: isRunning = game?.status === 'running';
  $: isFinished = game?.status === 'finished';
  $: me = game?.players.find((player) => player.id === currentPlayerId) ?? null;
  $: myGuard = state?.guards.find((guard) => guard.playerId === currentPlayerId) ?? null;
  $: turnPlayer = game?.players.find((player) => player.id === state?.currentPlayerId) ?? null;
  $: turnGuard = state?.guards.find((guard) => guard.playerId === state?.currentPlayerId) ?? null;
  $: isMyTurn = Boolean(isRunning && me && state?.currentPlayerId === currentPlayerId);
  $: canAct = isMyTurn && !playing && !isLoading;
  /** @type {LtBoardView | null} */
  $: liveView = state
    ? { tiles: state.tiles, lamps: state.lamps, ships: state.ships, guards: state.guards, saved: state.saved, wrecked: state.wrecked, stormStep: state.stormStep }
    : null;
  $: shownView = playView ?? liveView;
  $: targets = canAct && state ? /** @type {LtTarget[]} */ (targetsFor(/** @type {any} */ (state), currentPlayerId)) : [];
  $: colors = Object.fromEntries((game?.players ?? []).map((player) => [player.id, playerHexById(players, player.id)]));
  /** @type {'running' | 'won' | 'lost'} */
  let mood = 'running';
  $: mood = isFinished && !playing && state?.result ? state.result : 'running';
  $: actionsLeft = state?.actionsLeft ?? 0;
  $: freeSandbag = Boolean(isMyTurn && myGuard?.role === 'sacki' && !state?.freeSandbagUsed);
  $: undoCount = state?.undoCount ?? 0;
  $: difficulty = DIFFICULTIES[state?.difficulty ?? 'normal'] ?? DIFFICULTIES.normal;
  $: plans = state && !playing ? state.plans ?? {} : {};
  $: myPlan = state?.plans?.[currentPlayerId] ?? null;

  /* ---------- Einweisung ---------- */
  let guideOpen = false;
  let guideChecked = false;
  $: if (state && !guideChecked) {
    guideChecked = true;
    let seen = false;
    try {
      seen = localStorage.getItem(GUIDE_KEY) === '1';
    } catch {}
    guideOpen = !seen || (state.turn === 1 && !state.storm);
  }

  function closeGuide() {
    guideOpen = false;
    try {
      localStorage.setItem(GUIDE_KEY, '1');
    } catch {}
  }

  /* ---------- Sturm abspielen ---------- */
  let playing = false;
  /** @type {LtBoardView | null} */
  let playView = null;
  /** @type {(LtStormFrame & { index: number, total: number }) | null} */
  let banner = null;
  /** @type {number | null} */
  let lastStormSeq = null;
  /** @type {string | null} */
  let seenGameId = null;
  let playToken = 0;
  let finishHeld = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let holdTimer = null;

  /** @param {LtSession | null} session */
  function sync(session) {
    if (!session) return;
    if (session.id !== seenGameId) {
      seenGameId = session.id;
      lastStormSeq = session.state.storm?.seq ?? 0;
      stopPlayback();
      // Wer ein beendetes Spiel öffnet (z. B. „Spielfeld ansehen“), braucht keine Pause mehr.
      finishHeld = session.status === 'finished';
      selected = null;
      return;
    }
    const storm = session.state.storm;
    if (storm && storm.seq !== lastStormSeq) {
      lastStormSeq = storm.seq;
      void play(storm);
    } else if (session.status === 'finished' && !playing && !finishHeld) {
      // Sieg durch eine Aktion (z. B. Lotsen): kurz das Brett zeigen, dann das Ergebnis.
      holdFinish();
    }
  }

  /** @param {number} ms */
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, REDUCED ? Math.max(700, ms * 0.6) : ms));
  }

  /** @param {LtStormRecord} storm */
  async function play(storm) {
    const token = ++playToken;
    playing = true;
    onHoldResult(true);
    playView = storm.before;
    banner = null;
    selected = null;
    await wait(300);
    const cardTotal = storm.frames.filter((frame) => frame.kind !== 'ships').length;
    for (const [index, frame] of storm.frames.entries()) {
      if (token !== playToken) return;
      banner = { ...frame, index, total: cardTotal };
      playView = frame.view;
      await wait(frame.kind === 'ships' ? 1700 : 1500);
    }
    if (token !== playToken) return;
    endPlayback();
  }

  function endPlayback() {
    playToken += 1;
    playing = false;
    playView = null;
    banner = null;
    if (game?.status === 'finished') holdFinish();
    else onHoldResult(false);
  }

  function holdFinish() {
    finishHeld = true;
    onHoldResult(true);
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = setTimeout(() => onHoldResult(false), 2600);
  }

  function stopPlayback() {
    playToken += 1;
    playing = false;
    playView = null;
    banner = null;
    finishHeld = false;
    if (holdTimer) clearTimeout(holdTimer);
    onHoldResult(false);
  }

  onDestroy(() => {
    playToken += 1;
    if (holdTimer) clearTimeout(holdTimer);
    onHoldResult(false);
  });

  /* ---------- Töne ---------- */
  const soundSources = { turn: '/sounds/ping.mp3', win: '/sounds/win1.mp3', lose: '/sounds/lose1.mp3' };
  /** @type {Map<string, HTMLAudioElement>} */
  const audioCache = new Map();
  let lastEventSeq = -1;
  $: handleEvent(state?.lastEvent ?? null);

  /** @param {import('../types').LtEvent | null} event */
  function handleEvent(event) {
    const seq = event?.seq ?? 0;
    if (seq === lastEventSeq) return;
    const first = lastEventSeq === -1;
    lastEventSeq = seq;
    if (first || !event) return;
    if (event.type === 'turn' && event.playerId === currentPlayerId) setTimeout(() => playSound('turn'), 2600);
    if (event.type === 'win') setTimeout(() => playSound('win'), 1800);
    if (event.type === 'lose') setTimeout(() => playSound('lose'), 1800);
  }

  /** @param {keyof typeof soundSources} name */
  function playSound(name) {
    if (typeof Audio === 'undefined') return;
    let audio = audioCache.get(name);
    if (!audio) {
      audio = new Audio(soundSources[name]);
      audio.preload = 'metadata';
      audioCache.set(name, audio);
    }
    let volume = 0.85;
    try {
      const stored = Number(localStorage.getItem('web-games:effects-volume') ?? '0.85');
      if (Number.isFinite(stored)) volume = Math.max(0, Math.min(1, stored));
    } catch {}
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    void audio.play().catch(() => {});
  }

  /* ---------- Züge ---------- */
  /** @param {LtTarget} target */
  function act(target) {
    if (!canAct) return;
    selected = null;
    onMove({ type: target.action, at: target.at, ...(target.shipId ? { shipId: target.shipId } : {}) });
  }

  function undo() {
    if (!canAct || !undoCount) return;
    onMove({ type: 'undo' });
  }

  function endTurn() {
    if (!canAct) return;
    selected = null;
    onMove({ type: 'end' });
  }

  function togglePlan() {
    if (!selected || !me || !isRunning || isLoading) return;
    onMove({ type: 'plan', at: myPlan === selected ? null : selected });
  }

  /* ---------- Feld ansehen ---------- */
  /** @type {string | null} */
  let selected = null;

  /** @param {string} key */
  function inspect(key) {
    selected = selected === key ? null : key;
  }

  $: info = selected && shownView ? describe(selected, shownView) : null;
  $: canPlanHere = Boolean(selected && me && isRunning && !isMyTurn && isLand(selected) && shownView?.tiles[selected] !== 'sunk');

  /**
   * Was ist auf diesem Feld los? Kurze Sätze, damit man die Regeln am Brett lernt.
   * @param {string} key
   * @param {LtBoardView} view
   * @returns {{ title: string, text: string } | null}
   */
  function describe(key, view) {
    const guardsHere = view.guards.filter((guard) => guard.at === key);
    const who = guardsHere.length
      ? ` Hier steht ${guardsHere.map((guard) => `${nameOf(guard.playerId)} (${ROLES[guard.role].name})`).join(' und ')}.`
      : '';
    const ship = view.ships.find((candidate) => shipCell(candidate) === key);
    if (ship) {
      const left = LANE_LENGTH - ship.step;
      const forecast = shipForecast(view, ship);
      const next = {
        dock: 'Beim nächsten Sturm legt es am Steg an.',
        sail: 'Das Feuer brennt, also fährt es beim nächsten Sturm ein Feld weiter.',
        drift: `Das ${LAMP_NAMES[ship.lane]} ist aus. Beim nächsten Sturm treibt es ab.`,
        wreck: `Das ${LAMP_NAMES[ship.lane]} ist aus. Beim nächsten Sturm zerschellt es!`
      }[forecast];
      const drift = ship.drift ? ` Es hat ${ship.drift} von ${WRECK_AT - 1} Driftmarke.` : '';
      return {
        title: `Schiff in der ${LANE_NAMES[ship.lane]}`,
        text: `Noch ${left} ${left === 1 ? 'Feld' : 'Felder'} bis zum Steg. ${next}${drift} Wer an das Schiff angrenzt, kann es lotsen.`
      };
    }
    const lane = LANE_IDS.find((id) => LANES[id].some(([c, r]) => keyOf(c, r) === key));
    if (lane) return { title: LANE_NAMES[lane], text: `Hier fahren Schiffe vom Horizont zum Steg. Das ${LAMP_NAMES[lane]} zeigt ihnen den Weg.` };
    if (key === keyOf(PIER[0], PIER[1])) return { title: 'Der Steg', text: `${view.saved} von ${state?.target ?? 0} Schiffen haben hier schon angelegt. Erreicht ihr das Ziel, habt ihr gewonnen.` };
    if (ROCKS.some(([c, r]) => keyOf(c, r) === key)) return { title: 'Klippen', text: 'Schiffe, die im Dunkeln treiben, zerschellen hier.' };
    if (!isLand(key)) return null;
    const tile = view.tiles[key];
    if (key === LIGHTHOUSE) {
      return {
        title: 'Der Leuchtturm',
        text: tile === 'wet'
          ? 'Er steht unter Wasser! Bei der nächsten Flut auf diesem Feld versinkt er, und ihr habt verloren. Legt von einem Nachbarfeld einen Sandsack.'
          : 'Er steht trocken. Versinkt er, habt ihr verloren. Betreten kann man ihn nicht.'
      };
    }
    const lamp = lampAt(key);
    if (lamp) {
      if (tile === 'sunk') return { title: `${LAMP_NAMES[lamp]} (versunken)`, text: `Dieses Feuer bleibt für immer aus. Schiffe in der ${LANE_NAMES[lamp]} müsst ihr lotsen.` };
      const wet = tile === 'wet' ? ' Das Feld ist nass. Die nächste Flut hier löscht das Feuer.' : '';
      return {
        title: `${LAMP_NAMES[lamp]}: ${view.lamps[lamp]} von 3 Licht`,
        text: `Es leuchtet den Schiffen in der ${LANE_NAMES[lamp]}. Ist es aus, treiben sie ab. Wer auf dem Feld steht, kann es anfachen.${wet}${who}`
      };
    }
    if (tile === 'sunk') return { title: 'Versunkenes Feld', text: 'Hier kann niemand mehr stehen.' };
    if (tile === 'wet') return { title: 'Nasses Feld', text: `Bei der nächsten Flut versinkt es. Ein Sandsack von hier oder vom Nachbarfeld macht es wieder trocken.${who}` };
    return { title: 'Trockenes Feld', text: `Eine Flut macht es nass.${who}` };
  }

  /* ---------- Texte ---------- */
  /** @param {string} id */
  function nameOf(id) {
    if (id === currentPlayerId) return 'du';
    return game?.players.find((player) => player.id === id)?.name ?? 'Jemand';
  }
  /** @param {string} id */
  function avatarOf(id) {
    return players.find((player) => player.id === id)?.avatar ?? null;
  }

  /** @param {LtBoardView} view */
  function urgentHint(view) {
    if (view.tiles[LIGHTHOUSE] === 'wet') return 'Der Leuchtturm steht unter Wasser! Versinkt er, habt ihr verloren. Leg einen Sandsack.';
    const wreck = view.ships.find((ship) => shipForecast(view, ship) === 'wreck');
    if (wreck) return `Ein Schiff in der ${LANE_NAMES[wreck.lane]} zerschellt beim nächsten Sturm. Fach das ${LAMP_NAMES[wreck.lane]} an oder lotse das Schiff.`;
    const drift = view.ships.find((ship) => shipForecast(view, ship) === 'drift');
    if (drift) return `Das ${LAMP_NAMES[drift.lane]} ist aus. Das Schiff dort treibt sonst auf die Klippen.`;
    const low = LANE_IDS.find((lane) => view.lamps[lane] === 1 && view.ships.some((ship) => ship.lane === lane));
    if (low) return `Das ${LAMP_NAMES[low]} hat nur noch 1 Licht. Geht es aus, treiben die Schiffe dort ab.`;
    const wetLamp = LANE_IDS.find((lane) => view.tiles[LAMP_AT[lane]] === 'wet');
    if (wetLamp) return `Das Feld am ${LAMP_NAMES[wetLamp]} ist nass. Die nächste Flut dort löscht das Feuer.`;
    return 'Alles ruhig. Lotse Schiffe, damit sie schneller ankommen, oder sichere nasse Felder.';
  }

  $: statusMain = getStatusMain(game, playing, isMyTurn, actionsLeft, freeSandbag, targets.length, shownView);
  $: statusSub = getStatusSub(game, playing, isMyTurn, actionsLeft, freeSandbag);

  /**
   * @param {LtSession | null} session
   * @param {boolean} isPlaying
   * @param {boolean} myTurn
   * @param {number} left
   * @param {boolean} free
   * @param {number} targetCount
   * @param {LtBoardView | null} view
   */
  function getStatusMain(session, isPlaying, myTurn, left, free, targetCount, view) {
    if (!session || !view) return '';
    if (isPlaying) return 'Der Sturm zieht über die Insel …';
    if (session.status === 'finished') return session.state.result === 'won' ? 'Gemeinsam geschafft!' : 'Der Sturm war stärker.';
    if (myTurn) {
      if ((left <= 0 && !free) || targetCount === 0) return 'Deine Aktionen sind aufgebraucht. Beende deinen Zug.';
      return urgentHint(view);
    }
    const prefix = me ? '' : 'Du schaust zu. ';
    return turnPlayer && turnGuard ? `${prefix}${turnPlayer.name} ist mit ${ROLES[turnGuard.role].name} dran.` : `${prefix}Das Spiel läuft.`;
  }

  /**
   * @param {LtSession | null} session
   * @param {boolean} isPlaying
   * @param {boolean} myTurn
   * @param {number} left
   * @param {boolean} free
   */
  function getStatusSub(session, isPlaying, myTurn, left, free) {
    if (!session) return '';
    if (isPlaying) return 'Schau aufs Brett: Jede Sturmkarte wirkt nacheinander.';
    if (session.status === 'finished') return session.state.reason;
    if (myTurn) {
      const extra = free ? ' Dein erster Sandsack ist gratis.' : '';
      if (left <= 0) return `Danach zieht der Sturm über die Insel.${extra}`;
      return `Noch ${left} ${left === 1 ? 'Aktion' : 'Aktionen'}. Tipp ein leuchtendes Symbol auf dem Brett an.${extra}`;
    }
    return me ? 'Tipp aufs Brett, um zu sehen, was dort los ist, oder setz einen Plan-Marker.' : 'Tipp aufs Brett, um zu sehen, was dort los ist.';
  }

  $: eventText = !playing && state?.lastEvent && state.lastEvent.type !== 'start' ? state.lastEvent.text : '';
  $: stormSummary = !playing && state?.storm && isRunning ? state.storm.frames.map((frame) => frame.title).join(' · ') : '';

  /* ---------- Zielleiste ---------- */
  $: nextCards = shownView ? cardsForStep(shownView.stormStep) : 0;
  $: lighthouseWet = shownView?.tiles[LIGHTHOUSE] === 'wet';

</script>

{#if !game || !state || !shownView}
  <div class="ui-alert" role="status">Leuchtturmwächter wird über eine Party gestartet, damit alle Mitspieler verbunden sind.</div>
{:else}
  <div class="lt">
    <header class="lt-status">
      <div class="lt-status-text" aria-live="polite" aria-atomic="true">
        <p class="lt-status-main">{statusMain}</p>
        <p class="lt-status-sub">{statusSub}</p>
      </div>
      <div class="lt-status-chips">
        {#if isMyTurn && !playing}<span class="ui-chip ui-chip--accent">Du bist dran</span>{/if}
        <button type="button" class="ui-btn ui-btn--ghost lt-guide-btn" aria-expanded={guideOpen} on:click={() => (guideOpen ? closeGuide() : (guideOpen = true))}>
          {guideOpen ? 'Einweisung schließen' : 'Wie gewinnen wir?'}
        </button>
      </div>
    </header>

    <!-- Ziel und Gefahren auf einen Blick -->
    <section class="lt-goalbar" aria-label="Spielstand">
      <div class="lt-meter lt-meter--goal" title="Gewonnen habt ihr, wenn so viele Schiffe am Steg liegen.">
        <span class="lt-meter-label">Ziel: {state.target} Schiffe in den Hafen</span>
        <span class="lt-pips" role="img" aria-label={`${shownView.saved} von ${state.target} Schiffen im Hafen`}>
          {#each Array.from({ length: state.target }) as _, i (i)}
            <span class="lt-pip lt-pip--ship" class:is-on={i < shownView.saved}>
              <svg viewBox="0 0 20 14" aria-hidden="true"><path d="M2 8 H18 L15 12.5 Q10 13.6 5 12.5 Z M10 1 V8 M11 2 L16 7.5 H11 Z" /></svg>
            </span>
          {/each}
        </span>
        <span class="lt-meter-value ui-num">{shownView.saved}/{state.target}</span>
      </div>
      <div class="lt-meter" title={`Bei ${MAX_WRECKS} zerschellten Schiffen habt ihr verloren.`}>
        <span class="lt-meter-label">Zerschellt</span>
        <span class="lt-pips" role="img" aria-label={`${shownView.wrecked} von ${MAX_WRECKS} Schiffen zerschellt`}>
          {#each Array.from({ length: MAX_WRECKS }) as _, i (i)}
            <span class="lt-pip lt-pip--wreck" class:is-on={i < shownView.wrecked}></span>
          {/each}
        </span>
        <span class="lt-meter-value ui-num">{shownView.wrecked}/{MAX_WRECKS}</span>
      </div>
      <div class="lt-meter" title="Jede Sturmflut rückt die Leiste vor. Ist sie voll, kommt der Orkan und ihr habt verloren.">
        <span class="lt-meter-label">Sturm</span>
        <span class="lt-track" role="img" aria-label={`Sturmleiste ${Math.min(shownView.stormStep + 1, STORM_TRACK.length)} von ${STORM_TRACK.length}, ${nextCards} Karten pro Sturm`}>
          {#each STORM_TRACK as count, i (i)}
            <span class="lt-track-step" class:is-on={i <= shownView.stormStep} class:is-now={i === shownView.stormStep}>{count}</span>
          {/each}
          <span class="lt-track-end">Orkan</span>
        </span>
      </div>
      <div class="lt-meter" class:is-alert={lighthouseWet} title="Versinkt der Leuchtturm, habt ihr verloren.">
        <span class="lt-meter-label">Leuchtturm</span>
        <span class="lt-meter-value">{shownView.tiles[LIGHTHOUSE] === 'sunk' ? 'versunken' : lighthouseWet ? 'nass!' : 'trocken'}</span>
      </div>
    </section>

    {#if guideOpen}
      <GoalGuide target={state.target} role={myGuard?.role ?? null} onClose={closeGuide} />
    {/if}

    <div class="lt-main">
      <div class="lt-table">
        <div class="lt-board-wrap">
          {#key game.id}
            <Board
              view={shownView}
              {targets}
              {colors}
              activePlayerId={isRunning && !playing ? state.currentPlayerId : null}
              {plans}
              {selected}
              {mood}
              onTarget={act}
              onInspect={inspect}
            />
          {/key}
          {#if banner}
            {#key banner.index}
              <div class="lt-banner lt-banner--{banner.kind}" role="status">
                <span class="lt-banner-count ui-num">{banner.kind === 'ships' ? 'Zum Schluss' : `Sturmkarte ${banner.index + 1} von ${banner.total}`}</span>
                <strong>{banner.title}</strong>
                <span>{banner.text}</span>
              </div>
            {/key}
          {/if}
        </div>

        <div class="lt-bar">
          {#if playing}
            <button type="button" class="ui-btn ui-btn--ghost" on:click={endPlayback}>Sturm überspringen</button>
          {:else if isMyTurn}
            <button type="button" class="ui-btn ui-btn--ghost" disabled={!undoCount || isLoading} on:click={undo}>Zurück</button>
            <span class="lt-drops" role="img" aria-label={`${actionsLeft} von ${ACTIONS_PER_TURN} Aktionen übrig`}>
              {#each Array.from({ length: ACTIONS_PER_TURN }) as _, i (i)}
                <span class="lt-drop" class:is-used={i >= actionsLeft}></span>
              {/each}
            </span>
            <button type="button" class="ui-btn ui-btn--primary lt-end" disabled={isLoading} on:click={endTurn}>Zug beenden</button>
          {:else if isRunning && turnPlayer}
            <p class="lt-wait">Warte auf {turnPlayer.name}. Beim nächsten Sturm kommen {nextCards} Karten.</p>
          {/if}
        </div>

        <div class="lt-info" aria-live="polite">
          {#if info}
            <div class="lt-info-text">
              <strong>{info.title}</strong>
              <span>{info.text}</span>
            </div>
            {#if canPlanHere}
              <button type="button" class="ui-btn ui-btn--ghost lt-plan-btn" disabled={isLoading} on:click={togglePlan}>
                <svg viewBox="-12 -12 24 24" aria-hidden="true"><ActionIcon type="plan" /></svg>
                {myPlan === selected ? 'Plan-Marker entfernen' : 'Hier Plan-Marker setzen'}
              </button>
            {/if}
          {:else if eventText}
            <p class="lt-info-event">{eventText}{#if stormSummary}{' '}<span class="lt-info-storm">Letzter Sturm: {stormSummary}.</span>{/if}</p>
          {:else}
            <p class="lt-info-event">Tipp auf ein Feld, ein Schiff oder ein Feuer, um zu sehen, was es bedeutet.</p>
          {/if}
        </div>
      </div>

      <aside class="lt-side">
        <section class="ui-panel lt-crew" aria-labelledby="lt-crew-title">
          <h3 id="lt-crew-title" class="ui-section-title">Wächter</h3>
          <ul class="lt-crew-list">
            {#each state.turnOrder as playerId (playerId)}
              {@const guard = state.guards.find((candidate) => candidate.playerId === playerId)}
              {@const player = game.players.find((candidate) => candidate.id === playerId)}
              {#if guard && player}
                {@const active = isRunning && state.currentPlayerId === playerId}
                <li class="lt-crew-item" class:is-active={active}>
                  <span class="lt-crew-guard" style="--player:{colors[playerId]}">
                    <svg viewBox="40 30 120 170" aria-hidden="true"><Guard role={guard.role} /></svg>
                  </span>
                  <span class="lt-crew-text">
                    <span class="lt-crew-name">
                      <PlayerAvatar avatar={avatarOf(playerId)} name={player.name} color={colors[playerId]} size={20} />
                      {player.name}{#if playerId === currentPlayerId}<span class="lt-crew-you">du</span>{/if}
                      {#if active}<span class="ui-chip lt-crew-chip">dran</span>{/if}
                    </span>
                    <span class="lt-crew-role">{ROLES[guard.role].name}, {ROLES[guard.role].title}</span>
                    <span class="lt-crew-ability">{ROLES[guard.role].ability}</span>
                  </span>
                </li>
              {/if}
            {/each}
          </ul>
        </section>

        <section class="ui-panel lt-legend" aria-labelledby="lt-legend-title">
          <h3 id="lt-legend-title" class="ui-section-title">Zeichen auf dem Brett</h3>
          <ul class="lt-legend-list">
            <li><svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="#ffffff" stroke="#1b6e66" stroke-width="2"></circle><ActionIcon type="walk" /></svg>Gehen</li>
            <li><svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="#ffffff" stroke="#1b6e66" stroke-width="2"></circle><ActionIcon type="sandbag" /></svg>Sandsack</li>
            <li><svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="#ffffff" stroke="#1b6e66" stroke-width="2"></circle><ActionIcon type="kindle" /></svg>Feuer anfachen</li>
            <li><svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="#ffffff" stroke="#1b6e66" stroke-width="2"></circle><ActionIcon type="pilot" /></svg>Lotsen</li>
            <li>
              <svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="8" fill="#ffffff" stroke="#2e7d32" stroke-width="2"></circle><path d="M-2.5 -3 l3 3 l-3 3" fill="none" stroke="#2e7d32" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
              Schiff fährt beim nächsten Sturm weiter
            </li>
            <li>
              <svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="8" fill="#f29d38" stroke="#7f1d16" stroke-width="2"></circle><path d="M0 -4 v4.5" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"></path><circle cy="3.5" r="1.3" fill="#ffffff"></circle></svg>
              Feuer aus: Schiff treibt ab, rot heißt es zerschellt
            </li>
          </ul>
          <p class="lt-legend-note">{difficulty.label} · {state.target} Schiffe retten · Zug {state.turn}</p>
        </section>
      </aside>
    </div>
  </div>
{/if}

<style>
  .lt { display: grid; gap: 14px; }

  .lt-status { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 10px 16px; }
  .lt-status-text { min-width: 0; flex: 1 1 18rem; }
  .lt-status-main { margin: 0; font-size: 1.0625rem; font-weight: 600; line-height: 1.35; text-wrap: balance; }
  .lt-status-sub { margin: 2px 0 0; font-size: 0.875rem; line-height: 1.4; color: var(--muted); }
  .lt-status-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .lt-guide-btn { min-height: 36px; padding: 0 14px; font-size: 0.875rem; }

  /* Zielleiste */
  .lt-goalbar { display: flex; flex-wrap: wrap; gap: 8px; }
  .lt-meter { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 4px 12px; border-radius: 999px; background: var(--surface); font-size: 0.8125rem; }
  .lt-meter--goal { background: var(--accent-soft); color: var(--accent-ink, var(--text)); }
  .lt-meter.is-alert { background: color-mix(in srgb, var(--negative) 14%, var(--ground)); color: var(--negative); font-weight: 600; }
  .lt-meter-label { font-weight: 600; }
  .lt-meter-value { font-weight: 600; font-variant-numeric: tabular-nums; }
  .lt-pips { display: inline-flex; gap: 3px; }
  .lt-pip--ship { display: inline-grid; place-items: center; width: 18px; height: 14px; }
  .lt-pip--ship svg { width: 18px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round; opacity: 0.35; }
  .lt-pip--ship.is-on svg { fill: var(--positive); stroke: var(--positive); opacity: 1; }
  .lt-pip--wreck { width: 10px; height: 10px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--negative) 50%, transparent); }
  .lt-pip--wreck.is-on { background: var(--negative); box-shadow: none; }
  .lt-track { display: inline-flex; align-items: center; gap: 3px; }
  .lt-track-step { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 5px; background: var(--surface-2); color: var(--muted); font-size: 0.6875rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .lt-track-step.is-on { background: #3a6ea5; color: #ffffff; }
  .lt-track-step.is-now { box-shadow: 0 0 0 2px var(--ground), 0 0 0 3.5px #3a6ea5; }
  .lt-track-end { padding: 0 6px; height: 18px; display: inline-grid; place-items: center; border-radius: 5px; background: color-mix(in srgb, var(--negative) 18%, var(--ground)); color: var(--negative); font-size: 0.6875rem; font-weight: 600; }

  /* Hauptbereich */
  .lt-main { display: grid; gap: 14px; }
  @media (min-width: 960px) { .lt-main { grid-template-columns: minmax(0, 1fr) 20rem; align-items: start; } }
  .lt-table { display: grid; gap: 10px; min-width: 0; justify-items: center; }
  .lt-table > * { width: 100%; max-width: 560px; }
  .lt-board-wrap { position: relative; border-radius: 18px; overflow: hidden; }

  .lt-banner {
    position: absolute; left: 50%; top: 12px; transform: translateX(-50%);
    width: min(78%, 260px); display: grid; gap: 2px; padding: 10px 14px;
    border-radius: 14px; border: 3px solid #1f4f8c; background: #eaf4fb; color: #13233d;
    box-shadow: 0 10px 26px rgba(13, 34, 56, 0.35); pointer-events: none;
    animation: lt-card-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  .lt-banner strong { font-size: 1rem; }
  .lt-banner span { font-size: 0.8125rem; line-height: 1.35; }
  .lt-banner-count { font-size: 0.6875rem !important; font-weight: 600; opacity: 0.7; }
  .lt-banner--flood { background: #e4f3ef; border-color: #2d7a6a; }
  .lt-banner--flicker { background: #fff4d6; border-color: #9a6a12; }
  .lt-banner--ship { background: #fdebe4; border-color: #8a3a1e; }
  .lt-banner--surge { background: #1c3150; border-color: #0d1b2e; color: #f1f5fb; }
  .lt-banner--ships { background: #ffffff; border-color: #3a4a5c; }
  @keyframes lt-card-in { from { transform: translate(-50%, -24px) rotateX(70deg); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }

  .lt-bar { display: flex; align-items: center; gap: 10px; min-height: 44px; }
  .lt-end { margin-left: auto; }
  .lt-drops { display: inline-flex; align-items: center; gap: 5px; }
  .lt-drop { width: 14px; height: 18px; background: var(--accent-main); clip-path: path('M7 0 C10 5 14 8 14 12 A7 7 0 0 1 0 12 C0 8 4 5 7 0 Z'); transition: opacity 0.2s, transform 0.2s; }
  .lt-drop.is-used { opacity: 0.18; transform: scale(0.85); }
  .lt-wait { margin: 0; font-size: 0.875rem; color: var(--muted); }

  .lt-info { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; min-height: 52px; padding: 10px 14px; border-radius: var(--radius-inner); background: var(--surface); }
  .lt-info-text { display: grid; gap: 1px; min-width: 0; flex: 1 1 16rem; }
  .lt-info-text strong { font-size: 0.9375rem; }
  .lt-info-text span, .lt-info-event { margin: 0; font-size: 0.875rem; line-height: 1.45; color: var(--muted); }
  .lt-info-storm { display: inline; }
  .lt-plan-btn { min-height: 36px; padding: 0 12px; font-size: 0.875rem; }
  .lt-plan-btn svg { width: 18px; height: 18px; }

  /* Seitenleiste */
  .lt-side { display: grid; gap: 14px; min-width: 0; }
  .lt-crew-list { display: grid; gap: 6px; margin: 10px 0 0; padding: 0; list-style: none; }
  .lt-crew-item { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; align-items: center; padding: 8px; border-radius: var(--radius-inner); }
  .lt-crew-item.is-active { background: var(--accent-soft); }
  .lt-crew-guard { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--player) 16%, var(--ground)); box-shadow: inset 0 0 0 2.5px var(--player); }
  .lt-crew-guard svg { width: 38px; height: 44px; margin-top: 6px; }
  .lt-crew-text { display: grid; gap: 1px; min-width: 0; }
  .lt-crew-name { display: flex; align-items: center; gap: 6px; font-size: 0.9375rem; font-weight: 600; min-width: 0; }
  .lt-crew-you { font-size: 0.75rem; font-weight: 500; color: var(--muted); }
  .lt-crew-chip { height: 22px; padding: 0 8px; font-size: 0.75rem; }
  .lt-crew-role { font-size: 0.8125rem; font-weight: 500; }
  .lt-crew-ability { font-size: 0.8125rem; line-height: 1.4; color: var(--muted); }

  .lt-legend-list { display: grid; gap: 6px; margin: 10px 0 0; padding: 0; list-style: none; font-size: 0.8125rem; }
  .lt-legend-list li { display: flex; align-items: center; gap: 8px; }
  .lt-legend-list svg { flex: none; width: 24px; height: 24px; }
  .lt-legend-note { margin: 10px 0 0; font-size: 0.75rem; color: var(--muted); }

  @media (max-width: 959px) {
    .lt-legend { order: 2; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lt-banner { animation: none; }
    .lt-drop { transition: none; }
  }
</style>
