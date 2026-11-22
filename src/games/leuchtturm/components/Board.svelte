<script>
  /**
   * Das Spielbrett. Die Insel ist eine zusammenhängende Landmasse; feine Linien zeigen die Felder.
   * Animationen entstehen aus dem Unterschied zwischen altem und neuem Zustand – so sehen alle
   * dasselbe, egal ob ein Zug, ein Zurücknehmen oder eine Sturmkarte die Änderung ausgelöst hat.
   */
  import Guard from './Guard.svelte';
  import Ship from './Ship.svelte';
  import ActionIcon from './ActionIcon.svelte';
  import {
    CELL,
    COLS,
    ISLAND,
    LAMP_AT,
    LANES,
    LANE_IDS,
    LIGHTHOUSE,
    PIER,
    ROCKS,
    WRECK_AT,
    keyOf,
    parseKey,
    shipCell,
    shipForecast
  } from '../rules.js';

  /** @typedef {import('../types').LtBoardView} LtBoardView */
  /** @typedef {import('../types').LtTarget} LtTarget */

  /** @type {LtBoardView} */
  export let view;
  /** @type {LtTarget[]} */
  export let targets = [];
  /** @type {Record<string, string>} */
  export let colors = {};
  /** Der Wächter, der gerade zieht. @type {string | null} */
  export let activeGuardId = null;
  /** @type {Record<string, string>} */
  export let plans = {};
  /** @type {string | null} */
  export let selected = null;
  /** @type {'running' | 'won' | 'lost'} */
  export let mood = 'running';
  /** Animationen abspielen (aus bei erster Anzeige). */
  export let animate = true;
  /** @type {(target: LtTarget) => void} */
  export let onTarget = () => {};
  /** @type {(key: string) => void} */
  export let onInspect = () => {};
  /** Was sich gerade sichtbar verändert hat (für Töne). @type {(kinds: string[]) => void} */
  export let onChanges = () => {};

  const W = COLS * CELL;
  const H = 11 * CELL;
  const LAND = new Set(ISLAND.map(([c, r]) => keyOf(c, r)));
  const LAMP_TILES = new Set(Object.values(LAMP_AT));
  const ACTION_LABELS = { walk: 'Gehen', sandbag: 'Sandsack legen', kindle: 'Feuer anfachen', pilot: 'Schiff lotsen' };

  /* ---------- Feste Kulisse ---------- */
  let seed = 11;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  /** @type {{ x: number, y: number, delay: string }[]} */
  const waves = [];
  for (let i = 0; i < 60 && waves.length < 24; i += 1) {
    const x = Math.floor(rand() * (W - 20));
    const y = Math.floor(rand() * (H - 10)) + 6;
    const c = Math.floor((x + 8) / CELL);
    const r = Math.floor(y / CELL);
    const delay = `${(-rand() * 4).toFixed(2)}s`;
    if (LAND.has(keyOf(c, r)) || LAND.has(keyOf(c, r - 1)) || LAND.has(keyOf(c, r + 1))) continue;
    waves.push({ x, y, delay });
  }
  seed = 3;
  const drops = Array.from({ length: 90 }, () => {
    const x = rand() * (W + 20);
    const y = rand() * (H + 20);
    return { x, y, delay: `${(-rand()).toFixed(2)}s` };
  });
  const lanePaths = LANE_IDS.map((lane) => ({
    lane,
    points: [...LANES[lane], PIER].map(([c, r]) => `${c * CELL + 20},${r * CELL + 20}`).join(' '),
    dots: LANES[lane].map(([c, r]) => ({ x: c * CELL + 20, y: r * CELL + 20 }))
  }));

  /**
   * @param {number} x @param {number} y @param {number} w @param {number} h
   * @param {[number, number, number, number]} radii
   */
  function roundRect(x, y, w, h, [tl, tr, br, bl]) {
    return `M${x + tl} ${y} H${x + w - tr} Q${x + w} ${y} ${x + w} ${y + tr} V${y + h - br} Q${x + w} ${y + h} ${x + w - br} ${y + h} H${x + bl} Q${x} ${y + h} ${x} ${y + h - bl} V${y + tl} Q${x} ${y} ${x + tl} ${y} Z`;
  }
  /** @param {boolean} a @param {boolean} b @param {number} r */
  const corner = (a, b, r) => (a || b ? 0 : r);

  /** @param {Record<string, string>} tiles */
  function buildIsland(tiles) {
    /** @param {number} c @param {number} r */
    const alive = (c, r) => LAND.has(keyOf(c, r)) && tiles[keyOf(c, r)] !== 'sunk';
    /** @type {{ key: string, x: number, y: number, sand: string, grass: string, wet: boolean, deco: number }[]} */
    const cells = [];
    /** @type {string[]} */
    const seams = [];
    /** @type {{ x: number, y: number }[]} */
    const holes = [];
    ISLAND.forEach(([c, r], index) => {
      const key = keyOf(c, r);
      const x = c * CELL;
      const y = r * CELL;
      if (tiles[key] === 'sunk') {
        holes.push({ x: x + 20, y: y + 20 });
        return;
      }
      const j = { t: alive(c, r - 1), r: alive(c + 1, r), b: alive(c, r + 1), l: alive(c - 1, r) };
      const sx = j.l ? 0 : 3;
      const sy = j.t ? 0 : 3;
      const sand = roundRect(x + sx, y + sy, CELL - sx - (j.r ? 0 : 3), CELL - sy - (j.b ? 0 : 3), [
        corner(j.t, j.l, 12), corner(j.t, j.r, 12), corner(j.b, j.r, 12), corner(j.b, j.l, 12)
      ]);
      const gx = j.l ? 0 : 8;
      const gy = j.t ? 0 : 8;
      const grass = roundRect(x + gx, y + gy, CELL - gx - (j.r ? 0 : 8), CELL - gy - (j.b ? 0 : 8), [
        corner(j.t, j.l, 8), corner(j.t, j.r, 8), corner(j.b, j.r, 8), corner(j.b, j.l, 8)
      ]);
      if (j.r) seams.push(`M${x + CELL} ${y + (j.t ? 2 : 10)} V${y + CELL - (j.b ? 2 : 10)}`);
      if (j.b) seams.push(`M${x + (j.l ? 2 : 10)} ${y + CELL} H${x + CELL - (j.r ? 2 : 10)}`);
      const plain = key !== LIGHTHOUSE && !LAMP_TILES.has(key);
      cells.push({ key, x, y, sand, grass, wet: tiles[key] === 'wet', deco: plain ? (c * 7 + r * 3 + index) % 4 : -1 });
    });
    return { cells, seams: seams.join(' '), holes };
  }

  $: island = buildIsland(view.tiles);

  /* ---------- Ziele ---------- */
  /** Steht dort ein Wächter, rutschen die Symbole nach oben, damit die Figur sichtbar bleibt.
   * @param {LtTarget[]} list @param {LtBoardView} current */
  function groupTargets(list, current) {
    /** @type {Map<string, LtTarget[]>} */
    const map = new Map();
    for (const target of list) map.set(target.at, [...(map.get(target.at) ?? []), target]);
    return [...map.entries()].map(([at, items]) => {
      const [c, r] = parseKey(at);
      const occupied = current.guards.some((guard) => guard.at === at);
      return { at, x: c * CELL, y: r * CELL, items, occupied };
    });
  }
  $: targetGroups = groupTargets(targets, view);

  /** @param {LtTarget} target */
  function targetLabel(target) {
    const lamp = target.lamp ? ` (${LAMP_NAME_SHORT[target.lamp]})` : '';
    return `${ACTION_LABELS[target.action]}${lamp}`;
  }
  const LAMP_NAME_SHORT = { W: 'Westfeuer', O: 'Ostfeuer', S: 'Südfeuer' };

  /* ---------- Wächter ---------- */
  $: guardSpots = placeGuards(view.guards);
  /** @param {import('../types').LtGuard[]} guards */
  function placeGuards(guards) {
    /** @type {Record<string, number>} */
    const count = {};
    return guards.map((guard) => {
      const [c, r] = parseKey(guard.at);
      const n = (count[guard.at] = (count[guard.at] ?? 0) + 1);
      const ox = (LAMP_TILES.has(guard.at) ? 7 : 1) - (n - 1) * 10;
      return { ...guard, x: c * CELL + ox, y: r * CELL };
    });
  }

  /* ---------- Schiffe ---------- */
  $: shipSpots = view.ships.map((ship) => {
    const [c, r] = parseKey(shipCell(ship));
    return { ship, x: c * CELL, y: r * CELL, forecast: shipForecast(view, ship) };
  });

  /* ---------- Animationen aus Zustandsänderungen ---------- */
  /** @type {LtBoardView | null} */
  let prev = null;
  /** @type {Record<string, { n: number, dx: number, dy: number }>} */
  let guardMoves = {};
  /** @type {Record<number, { n: number, dx: number, dy: number, pop: boolean }>} */
  let shipMoves = {};
  /** @type {Record<string, { n: number, kind: 'glow' | 'shake' }>} */
  let lampFx = {};
  /** @type {{ id: number, kind: string, x: number, y: number, dx?: number, dy?: number }[]} */
  let fx = [];
  let fxId = 0;

  $: diff(view);

  /** @param {LtBoardView} next */
  function diff(next) {
    if (!next) return;
    if (prev && animate) {
      const before = prev;
      /** @type {string[]} */
      const kinds = [];
      // Wächter
      for (const guard of next.guards) {
        const old = before.guards.find((candidate) => candidate.id === guard.id);
        if (old && old.at !== guard.at) {
          const [oc, or] = parseKey(old.at);
          const [nc, nr] = parseKey(guard.at);
          guardMoves[guard.id] = { n: (guardMoves[guard.id]?.n ?? 0) + 1, dx: (oc - nc) * CELL, dy: (or - nr) * CELL };
          kinds.push('hop');
        }
      }
      guardMoves = guardMoves;
      // Schiffe
      let savedDelta = next.saved - before.saved;
      let wreckDelta = next.wrecked - before.wrecked;
      for (const ship of next.ships) {
        const old = before.ships.find((candidate) => candidate.id === ship.id);
        if (!old) {
          shipMoves[ship.id] = { n: (shipMoves[ship.id]?.n ?? 0) + 1, dx: 0, dy: 0, pop: true };
          kinds.push('pop');
        } else if (old.step !== ship.step) {
          kinds.push('sail');
          const [oc, or] = parseKey(shipCell(old));
          const [nc, nr] = parseKey(shipCell(ship));
          shipMoves[ship.id] = { n: (shipMoves[ship.id]?.n ?? 0) + 1, dx: (oc - nc) * CELL, dy: (or - nr) * CELL, pop: false };
        }
        if (old && ship.drift > old.drift) kinds.push('drift');
      }
      shipMoves = shipMoves;
      const gone = before.ships.filter((ship) => !next.ships.some((candidate) => candidate.id === ship.id))
        .sort((a, b) => b.step - a.step);
      for (const ship of gone) {
        const [c, r] = parseKey(shipCell(ship));
        if (savedDelta > 0 && (ship.step >= 2 || wreckDelta <= 0)) {
          savedDelta -= 1;
          kinds.push('dock');
          addFx({ kind: 'dock', x: PIER[0] * CELL, y: PIER[1] * CELL, dx: (c - PIER[0]) * CELL, dy: (r - PIER[1]) * CELL });
        } else {
          wreckDelta -= 1;
          kinds.push('wreck');
          addFx({ kind: 'wreck', x: c * CELL, y: r * CELL });
        }
      }
      // Felder
      for (const key of Object.keys(next.tiles)) {
        const a = before.tiles[key];
        const b = next.tiles[key];
        if (a === b) continue;
        const [c, r] = parseKey(key);
        const kind = b === 'wet' && a === 'dry' ? 'flood' : b === 'sunk' ? 'sink' : b === 'dry' && a === 'wet' ? 'sack' : null;
        if (!kind) continue;
        addFx({ kind, x: c * CELL, y: r * CELL });
        kinds.push(kind);
      }
      // Feuer
      for (const lamp of LANE_IDS) {
        const a = before.lamps[lamp];
        const b = next.lamps[lamp];
        if (a === b) continue;
        lampFx[lamp] = { n: (lampFx[lamp]?.n ?? 0) + 1, kind: b > a ? 'glow' : 'shake' };
        kinds.push(b > a ? 'glow' : 'shake');
      }
      lampFx = lampFx;
      if (next.stormStep > before.stormStep) kinds.push('surge');
      // Eine Welle, die ein Feuer löscht, ist ein Flut-Ereignis, auch wenn das Feld schon nass war.
      if (kinds.includes('shake') && !kinds.includes('flood')) {
        const lampTilesHit = LANE_IDS.some((lamp) => next.lamps[lamp] === 0 && before.lamps[lamp] > 1);
        if (lampTilesHit) kinds.push('flood');
      }
      if (kinds.length) onChanges([...new Set(kinds)]);
    }
    prev = JSON.parse(JSON.stringify(next));
  }

  /** @param {{ kind: string, x: number, y: number, dx?: number, dy?: number }} entry */
  function addFx(entry) {
    const id = ++fxId;
    fx = [...fx, { id, ...entry }];
    setTimeout(() => {
      fx = fx.filter((item) => item.id !== id);
    }, 1600);
  }

  /* ---------- Stimmung ---------- */
  $: night = mood === 'won' ? 0 : mood === 'lost' ? 0.5 : [0, 0.08, 0.16, 0.26, 0.38, 0.5][Math.min(view.stormStep, 5)];
  $: rainCount = mood === 'won' ? 0 : [0, 15, 30, 50, 70, 90][Math.min(view.stormStep, 5)];
  $: rainSpeed = `${Math.max(0.45, 1.2 - view.stormStep * 0.13).toFixed(2)}s`;

  /* ---------- Eingabe ---------- */
  /** @type {SVGSVGElement} */
  let svg;

  /** @param {MouseEvent} event */
  function handleClick(event) {
    const el = /** @type {Element} */ (event.target).closest('[data-target]');
    if (el) {
      const group = targetGroups.find((candidate) => candidate.at === el.getAttribute('data-at'));
      const target = group?.items[Number(el.getAttribute('data-index'))];
      if (target) onTarget(target);
      return;
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    const c = Math.floor(point.x / CELL);
    const r = Math.floor(point.y / CELL);
    if (c < 0 || r < 0 || c >= COLS || r >= 11) return;
    onInspect(keyOf(c, r));
  }

  /** @param {KeyboardEvent} event */
  function handleKey(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const el = /** @type {Element} */ (event.target).closest('[data-target]');
    if (!el) return;
    event.preventDefault();
    const group = targetGroups.find((candidate) => candidate.at === el.getAttribute('data-at'));
    const target = group?.items[Number(el.getAttribute('data-index'))];
    if (target) onTarget(target);
  }

  /** @param {string} key */
  function cellXY(key) {
    const [c, r] = parseKey(key);
    return { x: c * CELL, y: r * CELL };
  }
  /** @param {string} lamp */
  function lampXY(lamp) {
    return cellXY(LAMP_AT[/** @type {import('../types').LtLaneId} */ (lamp)]);
  }
  const lighthouse = cellXY(LIGHTHOUSE);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={svg}
  class="lt-board"
  viewBox="0 0 {W} {H}"
  role="group"
  aria-label="Spielbrett mit der Insel, dem Leuchtturm und den Fahrrinnen"
  on:click={handleClick}
  on:keydown={handleKey}
>
  <!-- Meer -->
  <rect width={W} height={H} fill="#7cc0e0"></rect>
  {#each waves as wave, index (index)}
    <path class="lt-wave" style="animation-delay:{wave.delay}" d="M{wave.x} {wave.y} q4 -4 8 0 t8 0" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.5"></path>
  {/each}

  <!-- Fahrrinnen -->
  {#each lanePaths as lane (lane.lane)}
    <polyline points={lane.points} fill="none" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="1 7" stroke-linecap="round" opacity="0.9"></polyline>
    {#each lane.dots as dot, index (index)}
      <circle cx={dot.x} cy={dot.y} r="2.6" fill="#ffffff" opacity="0.9"></circle>
    {/each}
  {/each}

  <!-- Klippen -->
  {#each ROCKS as [c, r] (`${c},${r}`)}
    {@const x = c * CELL}
    {@const y = r * CELL}
    <path d="M{x + 8} {y + 28} C{x + 6} {y + 18} {x + 12} {y + 9} {x + 21} {y + 8} C{x + 30} {y + 7} {x + 35} {y + 17} {x + 33} {y + 27} C{x + 31} {y + 33} {x + 16} {y + 34} {x + 8} {y + 28} Z" fill="#9aa3ad" stroke="#4f5964" stroke-width="2.4" stroke-linejoin="round"></path>
    <path d="M{x + 14} {y + 17} q4 -4 9 -4" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity="0.55"></path>
    <path d="M{x + 4} {y + 33} q4 -3 8 0 t8 0 t8 0 t8 0" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity="0.7"></path>
  {/each}

  <!-- Steg -->
  <g>
    <rect x={PIER[0] * CELL + 9} y={PIER[1] * CELL - 6} width="22" height="34" rx="3" fill="#b07a46" stroke="#5a3a1e" stroke-width="2"></rect>
    <path d="M{PIER[0] * CELL + 9} {PIER[1] * CELL + 2} h22 M{PIER[0] * CELL + 9} {PIER[1] * CELL + 10} h22 M{PIER[0] * CELL + 9} {PIER[1] * CELL + 18} h22" stroke="#5a3a1e" stroke-width="1.4"></path>
    <rect x={PIER[0] * CELL + 6} y={PIER[1] * CELL + 22} width="5" height="10" rx="2" fill="#5a3a1e"></rect>
    <rect x={PIER[0] * CELL + 29} y={PIER[1] * CELL + 22} width="5" height="10" rx="2" fill="#5a3a1e"></rect>
  </g>

  <!-- Insel -->
  {#each island.holes as hole (`${hole.x},${hole.y}`)}
    <circle cx={hole.x} cy={hole.y} r="12" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-dasharray="3 5" opacity="0.7"></circle>
  {/each}
  <g fill="none" stroke="#ffffff" stroke-width="7" opacity="0.55">
    {#each island.cells as cell (cell.key)}<path d={cell.sand}></path>{/each}
  </g>
  <g fill="none" stroke="#c8a35c" stroke-width="3">
    {#each island.cells as cell (cell.key)}<path d={cell.sand}></path>{/each}
  </g>
  <g fill="#f1d9a0">
    {#each island.cells as cell (cell.key)}<path d={cell.sand}></path>{/each}
  </g>
  {#each island.cells as cell (cell.key)}
    <path class="lt-grass" d={cell.grass} fill={cell.wet ? '#8fc9c4' : '#7cc24f'}></path>
  {/each}
  <path d={island.seams} fill="none" stroke="#3f7d2a" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="3 3" opacity="0.35"></path>
  {#each island.cells as cell (cell.key)}
    {@const x = cell.x}
    {@const y = cell.y}
    {#if cell.wet}
      <path d="M{x + 9} {y + 17} q4 -4 8 0 t8 0 t8 0 M{x + 12} {y + 26} q4 -4 8 0 t8 0" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.9"></path>
    {:else if cell.deco === 0}
      <path d="M{x + 11} {y + 27} q3 -6 6 0 q3 -6 6 0" fill="none" stroke="#4f9a34" stroke-width="2" stroke-linecap="round"></path>
    {:else if cell.deco === 1}
      <circle cx={x + 27} cy={y + 13} r="2.6" fill="#f3a0c0" stroke="#b5527a" stroke-width="1.1"></circle>
      <circle cx={x + 13} cy={y + 25} r="2.2" fill="#fff6b0" stroke="#b59a2a" stroke-width="1.1"></circle>
    {:else if cell.deco === 2}
      <path d="M{x + 25} {y + 29} q2 -5 4 0 M{x + 12} {y + 14} q2 -5 4 0" fill="none" stroke="#4f9a34" stroke-width="1.8" stroke-linecap="round"></path>
    {/if}
  {/each}

  <!-- Gewähltes Feld -->
  {#if selected}
    {@const s = cellXY(selected)}
    <rect x={s.x + 1.5} y={s.y + 1.5} width="37" height="37" rx="10" fill="none" stroke="#13233d" stroke-width="2.5"></rect>
  {/if}

  <!-- Leuchtfeuer -->
  {#each LANE_IDS as lamp (lamp)}
    {#if view.tiles[LAMP_AT[lamp]] !== 'sunk'}
      {@const p = cellXY(LAMP_AT[lamp])}
      {@const light = view.lamps[lamp]}
      {#key lampFx[lamp]?.n}
        <g class={lampFx[lamp]?.kind === 'shake' && animate ? 'lt-fx-shake' : ''}>
          <rect x={p.x + 8.5} y={p.y + 14} width="5" height="12" rx="2" fill="#6b4a2e" stroke="#3d2a18" stroke-width="1"></rect>
          <circle cx={p.x + 11} cy={p.y + 10} r="5.5" fill={light > 0 ? '#ffd66b' : '#9aa3ad'} stroke="#5a4210" stroke-width="1.6"></circle>
          <path d="M{p.x + 5} {p.y + 4.5} h12" stroke="#3d2a18" stroke-width="2.2" stroke-linecap="round"></path>
        </g>
      {/key}
      <rect x={p.x + 2} y={p.y + 30.5} width="18" height="7" rx="3.5" fill="#ffffff" opacity="0.8"></rect>
      {#each [0, 1, 2] as i (i)}
        <circle cx={p.x + 6 + i * 5} cy={p.y + 34} r="2.2" fill={i < light ? '#ffd66b' : '#ffffff'} stroke="#5a4210" stroke-width="1"></circle>
      {/each}
    {/if}
  {/each}

  <!-- Leuchtturm -->
  {#if view.tiles[LIGHTHOUSE] !== 'sunk'}
    {@const x = lighthouse.x}
    {@const y = lighthouse.y + 2}
    <path d="M{x + 12} {y + 36} L{x + 28} {y + 36} L{x + 25} {y + 10} L{x + 15} {y + 10} Z" fill="#ffffff" stroke="#3a4a5c" stroke-width="2.2" stroke-linejoin="round"></path>
    <path d="M{x + 14} {y + 28} L{x + 26} {y + 28} L{x + 25.4} {y + 22} L{x + 14.6} {y + 22} Z M{x + 15.4} {y + 16} L{x + 24.6} {y + 16} L{x + 24.3} {y + 13} L{x + 15.7} {y + 13} Z" fill="#e8564a"></path>
    <rect x={x + 14} y={y + 2} width="12" height="9" rx="2" fill={mood === 'lost' ? '#9aa3ad' : '#ffd66b'} stroke="#3a4a5c" stroke-width="2"></rect>
    <path d="M{x + 12} {y + 3} L{x + 20} {y - 5} L{x + 28} {y + 3} Z" fill="#e8564a" stroke="#3a4a5c" stroke-width="2" stroke-linejoin="round"></path>
    <rect x={x + 17} y={y + 29} width="6" height="7" rx="3" fill="#3a4a5c"></rect>
  {/if}

  <!-- Plan-Marker -->
  {#each Object.entries(plans) as [playerId, at] (playerId)}
    {@const p = cellXY(at)}
    {@const guard = view.guards.find((candidate) => candidate.playerId === playerId)}
    {#if guard}
      <rect x={p.x + 3} y={p.y + 3} width="34" height="34" rx="9" fill="none" stroke={colors[playerId] ?? '#ffffff'} stroke-width="2.4" stroke-dasharray="4 4"></rect>
      <g opacity="0.5" transform="translate({p.x + 6} {p.y}) scale(0.14)"><Guard role={guard.role} /></g>
    {/if}
  {/each}

  <!-- Schiffe -->
  {#each shipSpots as spot (spot.ship.id)}
    {@const move = shipMoves[spot.ship.id]}
    {#key move?.n}
      <g class={move && animate && !move.pop ? 'lt-fx-move' : ''} style="--dx:{move?.dx ?? 0}px;--dy:{move?.dy ?? 0}px">
        <g transform="translate({spot.x + 2} {spot.y + 6}) scale(0.36)">
          <g class={move?.pop && animate ? 'lt-fx-pop' : ''}>
            <g class="lt-ship-bob" style="animation-delay:{-spot.ship.id * 0.7}s"><Ship /></g>
          </g>
        </g>
        <!-- Was passiert beim nächsten Sturm? -->
        {#if spot.forecast === 'sail' || spot.forecast === 'dock'}
          <circle cx={spot.x + 34} cy={spot.y + 8} r="6.5" fill="#ffffff" stroke="#2e7d32" stroke-width="1.8"></circle>
          <path d="M{spot.x + 31.5} {spot.y + 5} l3 3 l-3 3" fill="none" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        {:else}
          <g class={spot.forecast === 'wreck' ? 'lt-danger' : ''}>
            <circle cx={spot.x + 34} cy={spot.y + 8} r="7" fill={spot.forecast === 'wreck' ? '#e8564a' : '#f29d38'} stroke="#7f1d16" stroke-width="1.8"></circle>
            <path d="M{spot.x + 34} {spot.y + 4} v4.5" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"></path>
            <circle cx={spot.x + 34} cy={spot.y + 11.5} r="1.3" fill="#ffffff"></circle>
          </g>
        {/if}
        {#each Array.from({ length: WRECK_AT - 1 }) as _, i (i)}
          <circle cx={spot.x + 14 + i * 7} cy={spot.y + 37} r="2.6" fill={i < spot.ship.drift ? '#e8564a' : 'transparent'} stroke={i < spot.ship.drift ? '#7f1d16' : 'none'} stroke-width="1"></circle>
        {/each}
      </g>
    {/key}
  {/each}

  <!-- Wächter -->
  {#each guardSpots as guard, index (guard.id)}
    {@const move = guardMoves[guard.id]}
    {@const active = guard.id === activeGuardId}
    {@const color = colors[guard.playerId] ?? '#ffffff'}
    {#key move?.n}
      <g class={move && animate ? 'lt-fx-hop' : ''} style="--dx:{move?.dx ?? 0}px;--dy:{move?.dy ?? 0}px">
        <ellipse
          class={active ? 'lt-active-ring' : ''}
          cx={guard.x + 19}
          cy={guard.y + 33}
          rx={active ? 14 : 12}
          ry={active ? 5 : 4}
          fill={active ? color : 'none'}
          fill-opacity="0.3"
          stroke={color}
          stroke-width={active ? 3.2 : 2.6}
        ></ellipse>
        <g transform="translate({guard.x + 3} {guard.y - 2}) scale(0.16)">
          <g class="lt-idle" style="animation-delay:{-index * 0.9}s"><Guard role={guard.role} /></g>
        </g>
      </g>
    {/key}
  {/each}

  <!-- Nacht, Glühen, Lichtstrahl, Regen -->
  <rect width={W} height={H} fill={mood === 'won' ? '#ffcf9a' : '#0d2238'} opacity={mood === 'won' ? 0.18 : night} pointer-events="none" class="lt-sky"></rect>
  {#each LANE_IDS as lamp (lamp)}
    {#if view.lamps[lamp] > 0 && view.tiles[LAMP_AT[lamp]] !== 'sunk' && mood !== 'won'}
      {@const p = cellXY(LAMP_AT[lamp])}
      <circle class={view.lamps[lamp] === 1 ? 'lt-flicker' : ''} cx={p.x + 11} cy={p.y + 10} r={7 + view.lamps[lamp] * 3} fill="#ffe07a" opacity={0.25 + view.lamps[lamp] * 0.12} pointer-events="none"></circle>
    {/if}
  {/each}
  {#each Object.entries(lampFx) as [lamp, entry] (lamp)}
    {#if entry.kind === 'glow' && animate}
      {@const p = lampXY(lamp)}
      {#key entry.n}
        <circle class="lt-fx-glow" cx={p.x + 11} cy={p.y + 10} r="12" fill="#ffe07a" pointer-events="none"></circle>
      {/key}
    {/if}
  {/each}
  {#if mood === 'running' && view.tiles[LIGHTHOUSE] !== 'sunk'}
    <g pointer-events="none" opacity={0.45 + night}>
      <g class="lt-beam" style="transform-origin:{lighthouse.x + 20}px {lighthouse.y + 7}px">
        <path d="M{lighthouse.x + 20} {lighthouse.y + 7} L{W + 80} {lighthouse.y - 33} L{W + 80} {lighthouse.y + 47} Z" fill="#fff3b0" opacity="0.22"></path>
        <path d="M{lighthouse.x + 20} {lighthouse.y + 7} L-80 {lighthouse.y - 33} L-80 {lighthouse.y + 47} Z" fill="#fff3b0" opacity="0.14"></path>
      </g>
    </g>
  {/if}
  <g pointer-events="none" opacity="0.7" style="--rain-speed:{rainSpeed}">
    {#each drops.slice(0, rainCount) as drop, index (index)}
      <line class="lt-drop" style="animation-delay:{drop.delay}" x1={drop.x} y1={drop.y} x2={drop.x - 4} y2={drop.y + 12} stroke="#e6f2fb" stroke-width="1.6" stroke-linecap="round"></line>
    {/each}
  </g>

  <!-- Einmalige Effekte -->
  {#each fx as item (item.id)}
    {#if item.kind === 'flood' || item.kind === 'sink'}
      <rect class="lt-fx-flash" x={item.x + 1} y={item.y + 1} width="38" height="38" rx="9" fill="#ffffff" pointer-events="none"></rect>
      <circle class="lt-fx-ripple" cx={item.x + 20} cy={item.y + 20} r="18" fill="none" stroke="#ffffff" stroke-width="3" pointer-events="none"></circle>
    {:else if item.kind === 'sack'}
      <g class="lt-fx-drop" pointer-events="none">
        <g transform="translate({item.x + 20} {item.y + 22}) scale(1.5)"><ActionIcon type="sandbag" /></g>
      </g>
    {:else if item.kind === 'dock'}
      <g class="lt-fx-dock" style="--dx:{item.dx}px;--dy:{item.dy}px" pointer-events="none">
        <g transform="translate({item.x + 2} {item.y + 6}) scale(0.36)"><Ship flag /></g>
      </g>
      <text class="lt-fx-plus" x={item.x + 20} y={item.y - 4} text-anchor="middle" font-weight="700" font-size="15" fill="#ffffff" stroke="#2e7d32" stroke-width="3" paint-order="stroke" pointer-events="none">+1</text>
    {:else if item.kind === 'wreck'}
      <g transform="translate({item.x + 2} {item.y + 6}) scale(0.36)" pointer-events="none">
        <g class="lt-fx-wreck"><Ship wrecked /></g>
      </g>
      <circle class="lt-fx-ripple" cx={item.x + 20} cy={item.y + 24} r="16" fill="none" stroke="#ffffff" stroke-width="3" pointer-events="none"></circle>
    {/if}
  {/each}

  <!-- Ziele: Was leuchtet, kann man antippen -->
  {#each targetGroups as group (group.at)}
    <rect class="lt-target-hl" x={group.x + 2} y={group.y + 2} width="36" height="36" rx="9" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-dasharray="5 3" pointer-events="none"></rect>
    {#each group.items as target, index (index)}
      {@const w = CELL / group.items.length}
      {@const cx = group.x + w * index + w / 2}
      <g class="lt-target" role="button" tabindex="0" aria-label={targetLabel(target)} data-target data-at={group.at} data-index={index}>
        <rect class="lt-target-fill" x={group.x + w * index} y={group.y} width={w} height={CELL} rx="9" fill="#ffffff" opacity="0"></rect>
        <g class="lt-target-chip" transform="translate({cx} {group.y + (group.occupied ? 10 : 20)}) scale({group.items.length > 1 || group.occupied ? 0.78 : 1})">
          <circle r="11" fill="#ffffff" stroke="#1b6e66" stroke-width="2.2"></circle>
          <ActionIcon type={target.action} />
        </g>
      </g>
    {/each}
  {/each}
</svg>

<style>
  .lt-board {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 360 / 440;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .lt-wave { animation: lt-wave 4s ease-in-out infinite; }
  @keyframes lt-wave { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(6px); } }

  .lt-ship-bob { animation: lt-ship-bob 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 80%; }
  @keyframes lt-ship-bob { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg) translateY(-1.5px); } }

  .lt-idle { animation: lt-idle 2.8s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes lt-idle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

  .lt-active-ring { animation: lt-ring 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes lt-ring { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.14); opacity: 0.7; } }

  .lt-beam { animation: lt-spin 10s linear infinite; }
  @keyframes lt-spin { to { transform: rotate(360deg); } }

  .lt-flicker { animation: lt-flicker 2.2s steps(1) infinite; }
  @keyframes lt-flicker { 0%, 100% { opacity: 0.45; } 18% { opacity: 0.15; } 22% { opacity: 0.5; } 60% { opacity: 0.25; } }

  .lt-danger { animation: lt-danger 1.3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes lt-danger { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }

  .lt-drop { animation: lt-rain var(--rain-speed, 0.9s) linear infinite; }
  @keyframes lt-rain { from { transform: translate(0, -30px); } to { transform: translate(-10px, 30px); } }

  .lt-sky, .lt-grass { transition: opacity 600ms ease, fill 500ms ease; }

  /* Ziele */
  .lt-target { cursor: pointer; outline: none; }
  .lt-target-hl { animation: lt-hl 1.8s ease-in-out infinite; }
  @keyframes lt-hl { 0%, 100% { opacity: 0.95; } 50% { opacity: 0.45; } }
  .lt-target-chip { transition: transform 120ms ease; }
  @media (hover: hover) and (pointer: fine) {
    .lt-target:hover .lt-target-fill { opacity: 0.35; }
  }
  .lt-target:active .lt-target-fill { opacity: 0.45; }
  .lt-target:focus-visible .lt-target-fill { opacity: 0.45; stroke: #13233d; stroke-width: 2.5; }

  /* Einmalige Effekte. Ohne Animation (Bewegung reduzieren) bleiben sie unsichtbar. */
  .lt-fx-move { animation: lt-move 0.5s cubic-bezier(0.3, 0.7, 0.4, 1) both; }
  @keyframes lt-move { from { transform: translate(var(--dx), var(--dy)); } to { transform: translate(0, 0); } }
  .lt-fx-hop { animation: lt-hop 0.42s ease-out both; }
  @keyframes lt-hop {
    0% { transform: translate(var(--dx), var(--dy)); }
    50% { transform: translate(calc(var(--dx) / 2), calc(var(--dy) / 2 - 14px)); }
    100% { transform: translate(0, 0); }
  }
  .lt-fx-pop { animation: lt-pop 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) both; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes lt-pop { from { transform: scale(0); } to { transform: scale(1); } }
  .lt-fx-flash { opacity: 0; animation: lt-flash 0.9s ease-out; }
  @keyframes lt-flash { from { opacity: 0.95; } to { opacity: 0; } }
  .lt-fx-ripple { opacity: 0; animation: lt-ripple 1s ease-out; transform-box: fill-box; transform-origin: center; }
  @keyframes lt-ripple { from { transform: scale(0.3); opacity: 1; } to { transform: scale(1.8); opacity: 0; } }
  .lt-fx-drop { opacity: 0; animation: lt-drop 0.8s cubic-bezier(0.3, 0, 0.4, 1); transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes lt-drop {
    0% { transform: translateY(-50px); opacity: 1; }
    45% { transform: translateY(0) scaleY(0.8); opacity: 1; }
    60% { transform: translateY(-5px) scaleY(1.05); opacity: 1; }
    80% { transform: translateY(0); opacity: 1; }
    100% { opacity: 0; }
  }
  .lt-fx-glow { opacity: 0; animation: lt-glow 0.9s ease-out; transform-box: fill-box; transform-origin: center; }
  @keyframes lt-glow { from { transform: scale(0.4); opacity: 0.9; } to { transform: scale(2.2); opacity: 0; } }
  .lt-fx-shake { animation: lt-shake 0.5s ease-in-out; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes lt-shake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
  .lt-fx-plus { opacity: 0; animation: lt-plus 1.2s ease-out; }
  @keyframes lt-plus { 0% { transform: translateY(6px); opacity: 0; } 20% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-22px); opacity: 0; } }
  .lt-fx-wreck { opacity: 0; animation: lt-wreck 1.1s ease-in; transform-box: fill-box; transform-origin: 80% 90%; }
  @keyframes lt-wreck {
    0% { transform: rotate(0); opacity: 1; }
    35% { transform: rotate(-24deg) translateY(2px); opacity: 1; }
    100% { transform: rotate(-32deg) translateY(16px); opacity: 0; }
  }
  .lt-fx-dock { opacity: 0; animation: lt-dock 1.1s ease-in; }
  @keyframes lt-dock {
    0% { transform: translate(var(--dx), var(--dy)); opacity: 1; }
    65% { transform: translate(0, 0); opacity: 1; }
    100% { transform: translate(0, 0); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lt-board :global(*) { animation: none !important; transition: none !important; }
  }
</style>
