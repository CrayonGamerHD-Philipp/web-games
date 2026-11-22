/**
 * Leuchtturmwächter – Regeln als reine Funktionen (Server und Client nutzen dieselben).
 *
 * Koordinaten sind Schlüssel „Spalte,Zeile“ auf einem 9 × 11 großen Brett.
 *
 * @typedef {'dry' | 'wet' | 'sunk'} TileState
 * @typedef {'W' | 'O' | 'S'} LaneId
 * @typedef {'funzel' | 'lotti' | 'sacki' | 'kiek' | 'piepser'} RoleId
 * @typedef {'walk' | 'sandbag' | 'kindle' | 'pilot'} ActionType
 * @typedef {{ id: number, lane: LaneId, step: number, drift: number }} Ship
 * @typedef {{ id: string, playerId: string, role: RoleId, at: string }} Guard
 * @typedef {{ type: 'flood', at: string } | { type: 'flicker', lamp: LaneId } | { type: 'ship' } | { type: 'surge' }} StormCard
 * @typedef {{ at: string, action: ActionType, shipId?: number, lamp?: LaneId }} Target
 * @typedef {{ steps: number, sandbags: number, kindled: number, piloted: number }} GuardStats
 * @typedef {{
 *   tiles: Record<string, TileState>,
 *   lamps: Record<LaneId, number>,
 *   ships: Ship[],
 *   guards: Guard[],
 *   saved: number,
 *   wrecked: number,
 *   stormStep: number
 * }} BoardView
 * @typedef {BoardView & {
 *   target: number,
 *   nextShipId: number,
 *   deck: StormCard[],
 *   discard: StormCard[],
 *   result: 'won' | 'lost' | null,
 *   reason: string
 * }} RulesState
 */

export const COLS = 9;
export const ROWS = 11;
export const CELL = 40;

/** @type {[number, number][]} */
export const ISLAND = [
  [3, 1], [4, 1], [5, 1],
  [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
  [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [3, 5], [4, 5], [5, 5]
];
export const ISLAND_KEYS = ISLAND.map(([c, r]) => `${c},${r}`);
const LAND = new Set(ISLAND_KEYS);

export const LIGHTHOUSE = '4,3';
/** @type {Record<LaneId, string>} */
export const LAMP_AT = { W: '2,4', O: '6,4', S: '5,5' };
/** @type {LaneId[]} */
export const LANE_IDS = ['W', 'O', 'S'];
/** @type {Record<LaneId, string>} */
export const LAMP_NAMES = { W: 'Westfeuer', O: 'Ostfeuer', S: 'Südfeuer' };
/** @type {Record<LaneId, string>} */
export const LANE_NAMES = { W: 'Westrinne', O: 'Ostrinne', S: 'Südrinne' };
/** Felder jeder Fahrrinne, vom Horizont bis kurz vor den Steg. @type {Record<LaneId, [number, number][]>} */
export const LANES = {
  W: [[0, 6], [1, 6], [2, 6], [3, 6]],
  O: [[8, 6], [7, 6], [6, 6], [5, 6]],
  S: [[4, 10], [4, 9], [4, 8], [4, 7]]
};
export const LANE_LENGTH = 4;
/** @type {[number, number]} */
export const PIER = [4, 6];
/** @type {[number, number][]} */
export const ROCKS = [[1, 7], [7, 7], [3, 9], [5, 8], [0, 4], [8, 4]];

/** Karten pro Sturmphase je Feld der Sturmleiste. Danach kommt der Orkan. */
export const STORM_TRACK = [2, 2, 3, 3, 4, 4];
export const MAX_WRECKS = 3;
export const ACTIONS_PER_TURN = 3;
/** So viele Driftmarken verträgt ein Schiff, bei der nächsten zerschellt es. */
export const WRECK_AT = 2;

/** @type {Record<RoleId, { name: string, title: string, ability: string }>} */
export const ROLES = {
  funzel: { name: 'Funzel', title: 'Lampenbastlerin', ability: 'Feuer anfachen gibt 2 Licht statt 1.' },
  lotti: { name: 'Lotti', title: 'Lotsin', ability: 'Lotsen bringt ein Schiff 2 Felder weit.' },
  sacki: { name: 'Sacki', title: 'Deichbauer', ability: 'Der erste Sandsack in jedem Zug kostet keine Aktion.' },
  kiek: { name: 'Kiek', title: 'Möwenspäherin', ability: 'Geht auch schräg.' },
  piepser: { name: 'Piepser', title: 'Funker', ability: 'Facht Feuer auch vom Nachbarfeld aus an, schräg eingeschlossen.' }
};
/** @type {RoleId[]} */
export const ROLE_ORDER = ['funzel', 'lotti', 'sacki', 'kiek', 'piepser'];

/** @type {Record<string, { label: string, target: number, stormStep: number, lamps: Record<LaneId, number>, wet: number }>} */
export const DIFFICULTIES = {
  leicht: { label: 'Leichte Brise', target: 5, stormStep: 0, lamps: { W: 3, O: 3, S: 3 }, wet: 2 },
  normal: { label: 'Sturm', target: 6, stormStep: 1, lamps: { W: 3, O: 2, S: 2 }, wet: 3 },
  schwer: { label: 'Orkan', target: 7, stormStep: 2, lamps: { W: 2, O: 2, S: 1 }, wet: 4 }
};

/** Startfelder der Wächter rund um den Leuchtturm. */
export const START_TILES = ['4,4', '3,3', '5,3', '4,2', '3,4'];

/* ---------- Hilfen ---------- */

/** @param {number} c @param {number} r */
export const keyOf = (c, r) => `${c},${r}`;
/** @param {string} key @returns {[number, number]} */
export function parseKey(key) {
  const [c, r] = key.split(',').map(Number);
  return [c, r];
}
/** @param {string} key */
export const isLand = (key) => LAND.has(key);
/** @param {Record<string, TileState>} tiles @param {string} key */
export const isAlive = (tiles, key) => LAND.has(key) && tiles[key] !== 'sunk';
/** @param {string} a @param {string} b */
export function chebyshev(a, b) {
  const [ac, ar] = parseKey(a);
  const [bc, br] = parseKey(b);
  return Math.max(Math.abs(ac - bc), Math.abs(ar - br));
}
/** @param {Ship} ship */
export function shipCell(ship) {
  const [c, r] = LANES[ship.lane][Math.min(ship.step, LANE_LENGTH - 1)];
  return keyOf(c, r);
}
/** @param {string} key @returns {LaneId | null} */
export function lampAt(key) {
  return /** @type {LaneId | undefined} */ (LANE_IDS.find((id) => LAMP_AT[id] === key)) ?? null;
}

const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * @template T
 * @param {T[]} items
 * @param {() => number} rng
 */
export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** @returns {StormCard[]} */
export function createStormDeck() {
  /** @type {StormCard[]} */
  const cards = ISLAND_KEYS.map((at) => ({ type: 'flood', at }));
  for (const lamp of LANE_IDS) cards.push({ type: 'flicker', lamp }, { type: 'flicker', lamp });
  for (let i = 0; i < 6; i += 1) cards.push({ type: 'ship' });
  for (let i = 0; i < 3; i += 1) cards.push({ type: 'surge' });
  return cards;
}

/** @param {BoardView} state @returns {BoardView} */
export function viewOf(state) {
  return JSON.parse(JSON.stringify({
    tiles: state.tiles,
    lamps: state.lamps,
    ships: state.ships,
    guards: state.guards,
    saved: state.saved,
    wrecked: state.wrecked,
    stormStep: state.stormStep
  }));
}

/** @param {number} stormStep */
export function cardsForStep(stormStep) {
  return STORM_TRACK[Math.min(stormStep, STORM_TRACK.length - 1)];
}

/* ---------- Aktionen ---------- */

/**
 * Der Wächter, den dieser Spieler gerade steuert. Allein spielt man zwei Wächter abwechselnd,
 * dann entscheidet `currentGuardId`.
 * @param {BoardView & { currentGuardId?: string | null }} state
 * @param {string} playerId
 * @returns {Guard | null}
 */
export function activeGuard(state, playerId) {
  const current = state.currentGuardId ? state.guards.find((guard) => guard.id === state.currentGuardId) : null;
  if (current) return current.playerId === playerId ? current : null;
  return state.guards.find((guard) => guard.playerId === playerId) ?? null;
}

/**
 * Alle Aktionen, die der Wächter dieses Spielers gerade ausführen darf.
 * @param {BoardView & { actionsLeft: number, freeSandbagUsed: boolean, currentGuardId?: string | null }} state
 * @param {string} playerId
 * @returns {Target[]}
 */
export function targetsFor(state, playerId) {
  const guard = activeGuard(state, playerId);
  if (!guard) return [];
  const hasAction = state.actionsLeft > 0;
  const freeSandbag = guard.role === 'sacki' && !state.freeSandbagUsed;
  /** @type {Target[]} */
  const out = [];
  const [c, r] = parseKey(guard.at);

  if (hasAction) {
    const dirs = guard.role === 'kiek' ? [...ORTHO, ...DIAG] : ORTHO;
    for (const [dc, dr] of dirs) {
      const at = keyOf(c + dc, r + dr);
      if (isAlive(state.tiles, at) && at !== LIGHTHOUSE) out.push({ at, action: 'walk' });
    }
  }

  if (hasAction || freeSandbag) {
    for (const [dc, dr] of [[0, 0], ...ORTHO]) {
      const at = keyOf(c + dc, r + dr);
      if (state.tiles[at] === 'wet') out.push({ at, action: 'sandbag' });
    }
  }

  if (hasAction) {
    for (const lamp of LANE_IDS) {
      const at = LAMP_AT[lamp];
      if (!isAlive(state.tiles, at) || state.lamps[lamp] >= 3) continue;
      const reach = guard.role === 'piepser' ? 1 : 0;
      if (chebyshev(at, guard.at) <= reach) out.push({ at, action: 'kindle', lamp });
    }
    for (const ship of state.ships) {
      const at = shipCell(ship);
      if (chebyshev(at, guard.at) <= 1 && canAdvance(state, ship)) out.push({ at, action: 'pilot', shipId: ship.id });
    }
  }
  return out;
}

/**
 * Ein Schiff kann weiter, wenn das nächste Feld frei ist oder der Steg folgt.
 * @param {BoardView} state
 * @param {Ship} ship
 */
export function canAdvance(state, ship) {
  const next = ship.step + 1;
  if (next >= LANE_LENGTH) return true;
  return !state.ships.some((other) => other !== ship && other.lane === ship.lane && other.step === next);
}

/**
 * Bewegt ein Schiff bis zu n Felder. Erreicht es den Steg, ist es gerettet.
 * @param {BoardView} state
 * @param {Ship} ship
 * @param {number} n
 * @returns {'docked' | number} Anzahl gefahrener Felder
 */
export function advanceShip(state, ship, n) {
  let moved = 0;
  for (let i = 0; i < n; i += 1) {
    if (!canAdvance(state, ship)) break;
    ship.step += 1;
    moved += 1;
    if (ship.step >= LANE_LENGTH) {
      state.ships = state.ships.filter((other) => other !== ship);
      state.saved += 1;
      return 'docked';
    }
  }
  return moved;
}

/**
 * @param {BoardView} state
 * @param {Ship} ship
 * @returns {boolean} true, wenn das Schiff zerschellt ist
 */
export function driftShip(state, ship) {
  ship.drift += 1;
  if (ship.drift >= WRECK_AT) {
    state.ships = state.ships.filter((other) => other !== ship);
    state.wrecked += 1;
    return true;
  }
  return false;
}

/**
 * Führt eine Aktion aus. Ändert den Zustand direkt.
 * @param {BoardView & { actionsLeft: number, freeSandbagUsed: boolean, currentGuardId?: string | null }} state
 * @param {string} playerId
 * @param {{ action?: unknown, at?: unknown, shipId?: unknown }} move
 * @returns {{ error: string } | { text: string }}
 */
export function applyAction(state, playerId, move) {
  const guard = activeGuard(state, playerId);
  if (!guard) return { error: 'Du hast keinen Wächter.' };
  const target = targetsFor(state, playerId).find((candidate) =>
    candidate.action === move.action &&
    candidate.at === move.at &&
    (candidate.action !== 'pilot' || candidate.shipId === Number(move.shipId))
  );
  if (!target) return { error: 'Diese Aktion geht hier gerade nicht.' };
  const role = ROLES[guard.role];

  if (target.action === 'walk') {
    guard.at = target.at;
    state.actionsLeft -= 1;
    return { text: `${role.name} geht ein Feld weiter.` };
  }
  if (target.action === 'sandbag') {
    state.tiles[target.at] = 'dry';
    if (guard.role === 'sacki' && !state.freeSandbagUsed) state.freeSandbagUsed = true;
    else state.actionsLeft -= 1;
    return { text: target.at === LIGHTHOUSE ? `${role.name} legt einen Sandsack an den Leuchtturm.` : `${role.name} legt einen Sandsack. Das Feld ist wieder trocken.` };
  }
  if (target.action === 'kindle' && target.lamp) {
    const gain = guard.role === 'funzel' ? 2 : 1;
    state.lamps[target.lamp] = Math.min(3, state.lamps[target.lamp] + gain);
    state.actionsLeft -= 1;
    return { text: `${role.name} facht das ${LAMP_NAMES[target.lamp]} an. Es hat jetzt ${state.lamps[target.lamp]} Licht.` };
  }
  if (target.action === 'pilot') {
    const ship = state.ships.find((candidate) => candidate.id === target.shipId);
    if (!ship) return { error: 'Dieses Schiff gibt es nicht mehr.' };
    ship.drift = Math.max(0, ship.drift - 1);
    const result = advanceShip(state, ship, guard.role === 'lotti' ? 2 : 1);
    state.actionsLeft -= 1;
    return { text: result === 'docked' ? `${role.name} lotst ein Schiff in den Hafen.` : `${role.name} lotst ein Schiff näher an den Steg.` };
  }
  return { error: 'Unbekannte Aktion.' };
}

/* ---------- Sturm ---------- */

/**
 * @param {RulesState} state
 * @param {() => number} rng
 * @returns {StormCard}
 */
function drawCard(state, rng) {
  if (!state.deck.length) {
    state.deck = shuffle(state.discard, rng);
    state.discard = [];
  }
  return /** @type {StormCard} */ (state.deck.shift());
}

/**
 * Wer auf einem versinkenden Feld steht, schwimmt zum nächsten freien Feld.
 * @param {BoardView} state
 * @param {string} sunkKey
 */
function rescueGuards(state, sunkKey) {
  for (const guard of state.guards) {
    if (guard.at !== sunkKey) continue;
    const [c, r] = parseKey(sunkKey);
    const options = ISLAND_KEYS
      .filter((key) => isAlive(state.tiles, key) && key !== LIGHTHOUSE)
      .map((key) => {
        const [kc, kr] = parseKey(key);
        return { key, dist: Math.abs(kc - c) + Math.abs(kr - r) };
      })
      .sort((a, b) => a.dist - b.dist);
    if (options.length) guard.at = options[0].key;
  }
}

/**
 * @param {RulesState} state
 * @param {StormCard} card
 * @param {() => number} rng
 * @returns {string}
 */
function applyCard(state, card, rng) {
  if (card.type === 'flood') {
    const wasWet = state.tiles[card.at] === 'wet';
    if (!wasWet) {
      state.tiles[card.at] = 'wet';
      state.discard.push(card);
      if (card.at === LIGHTHOUSE) return 'Flut am Leuchtturm! Sein Feld ist nass.';
      const lamp = lampAt(card.at);
      return lamp ? `Flut: Das Feld am ${LAMP_NAMES[lamp]} ist nass.` : 'Flut: Ein Feld wird nass.';
    }
    // Leuchtfeuer stehen auf Fels: Eine zweite Flut löscht das Feuer, das Feld bleibt.
    const lamp = lampAt(card.at);
    if (lamp) {
      state.discard.push(card);
      const had = state.lamps[lamp] > 0;
      state.lamps[lamp] = 0;
      return had
        ? `Eine Welle überspült das ${LAMP_NAMES[lamp]}. Es geht aus! Facht es wieder an.`
        : `Eine Welle überspült das ${LAMP_NAMES[lamp]}. Es war schon aus.`;
    }
    state.tiles[card.at] = 'sunk';
    rescueGuards(state, card.at);
    // Die Karte eines versunkenen Felds kommt aus dem Spiel.
    if (card.at === LIGHTHOUSE) return 'Der Leuchtturm versinkt im Meer.';
    return 'Ein nasses Feld versinkt.';
  }
  state.discard.push(card);
  if (card.type === 'flicker') {
    if (state.lamps[card.lamp] > 0) {
      state.lamps[card.lamp] -= 1;
      return state.lamps[card.lamp] === 0
        ? `Das ${LAMP_NAMES[card.lamp]} geht aus.`
        : `Das ${LAMP_NAMES[card.lamp]} flackert und verliert 1 Licht.`;
    }
    const ships = state.ships.filter((ship) => ship.lane === card.lamp);
    const wrecks = ships.filter((ship) => driftShip(state, ship)).length;
    if (!ships.length) return `Das ${LAMP_NAMES[card.lamp]} ist schon aus. Zum Glück ist dort kein Schiff.`;
    return wrecks
      ? `Das ${LAMP_NAMES[card.lamp]} ist schon aus. Ein Schiff zerschellt an den Klippen.`
      : `Das ${LAMP_NAMES[card.lamp]} ist schon aus. Schiffe in der ${LANE_NAMES[card.lamp]} treiben ab.`;
  }
  if (card.type === 'ship') {
    const free = shuffle(LANE_IDS.filter((lane) => !state.ships.some((ship) => ship.lane === lane && ship.step === 0)), rng)
      .sort((a, b) => state.ships.filter((ship) => ship.lane === a).length - state.ships.filter((ship) => ship.lane === b).length);
    if (!free.length) return 'Segel in Sicht, aber alle Rinnen sind voll. Das Schiff dreht ab.';
    const lane = free[0];
    state.ships.push({ id: state.nextShipId, lane, step: 0, drift: 0 });
    state.nextShipId += 1;
    return `Segel in Sicht: Ein Schiff kommt in die ${LANE_NAMES[lane]}.`;
  }
  // Sturmflut: Leiste rückt vor, abgelegte Flutkarten kommen oben auf den Stapel.
  state.stormStep += 1;
  const floods = state.discard.filter((discarded) => discarded.type === 'flood');
  state.discard = state.discard.filter((discarded) => discarded.type !== 'flood');
  state.deck = [...shuffle(floods, rng), ...state.deck];
  if (state.stormStep >= STORM_TRACK.length) return 'Sturmflut! Der Orkan bricht los.';
  return `Sturmflut! Ab jetzt ${cardsForStep(state.stormStep)} Sturmkarten pro Zug. Nasse Felder sind jetzt in großer Gefahr.`;
}

/**
 * Prüft Sieg und Niederlage.
 * @param {RulesState} state
 */
export function checkEnd(state) {
  if (state.result) return true;
  if (state.saved >= state.target) {
    state.result = 'won';
    state.reason = `${state.saved} Schiffe liegen sicher im Hafen. Der Morgen bricht an.`;
  } else if (state.tiles[LIGHTHOUSE] === 'sunk') {
    state.result = 'lost';
    state.reason = 'Der Leuchtturm ist im Meer versunken.';
  } else if (state.wrecked >= MAX_WRECKS) {
    state.result = 'lost';
    state.reason = `${state.wrecked} Schiffe sind an den Klippen zerschellt.`;
  } else if (state.stormStep >= STORM_TRACK.length) {
    state.result = 'lost';
    state.reason = 'Die Sturmleiste ist voll. Der Orkan hat die Insel erreicht.';
  }
  return Boolean(state.result);
}

/**
 * Die Sturmphase nach einem Zug: Karten aufdecken, dann fahren die Schiffe.
 * Liefert für jeden Schritt einen Text und den Zustand danach (für die Animation).
 * @param {RulesState} state
 * @param {() => number} [rng]
 * @returns {{ kind: 'flood' | 'flicker' | 'ship' | 'surge' | 'ships', title: string, text: string, view: BoardView }[]}
 */
export function resolveStorm(state, rng = Math.random) {
  /** @type {{ kind: 'flood' | 'flicker' | 'ship' | 'surge' | 'ships', title: string, text: string, view: BoardView }[]} */
  const frames = [];
  const count = cardsForStep(state.stormStep);
  const titles = { flood: 'Flut', flicker: 'Flackern', ship: 'Segel in Sicht', surge: 'Sturmflut' };
  for (let i = 0; i < count; i += 1) {
    const card = drawCard(state, rng);
    const text = applyCard(state, card, rng);
    frames.push({ kind: card.type, title: titles[card.type], text, view: viewOf(state) });
    if (checkEnd(state)) return frames;
  }

  // Schiffe fahren: vorne zuerst, damit die hinteren nachrücken können.
  let moved = 0;
  let docked = 0;
  let drifted = 0;
  let wrecks = 0;
  const order = [...state.ships].sort((a, b) => b.step - a.step);
  for (const ship of order) {
    if (!state.ships.includes(ship)) continue;
    if (state.lamps[ship.lane] > 0) {
      const result = advanceShip(state, ship, 1);
      if (result === 'docked') docked += 1;
      else if (result > 0) moved += 1;
    } else if (driftShip(state, ship)) {
      wrecks += 1;
    } else {
      drifted += 1;
    }
  }
  /** @type {string[]} */
  const parts = [];
  if (docked) parts.push(docked === 1 ? 'Ein Schiff legt am Steg an.' : `${docked} Schiffe legen am Steg an.`);
  if (moved) parts.push(moved === 1 ? 'Ein Schiff fährt ein Feld weiter.' : `${moved} Schiffe fahren ein Feld weiter.`);
  if (drifted) parts.push(drifted === 1 ? 'Ein Schiff treibt im Dunkeln ab.' : `${drifted} Schiffe treiben im Dunkeln ab.`);
  if (wrecks) parts.push(wrecks === 1 ? 'Ein Schiff zerschellt an den Klippen.' : `${wrecks} Schiffe zerschellen an den Klippen.`);
  if (!parts.length) parts.push('Kein Schiff ist unterwegs.');
  frames.push({ kind: 'ships', title: 'Die Schiffe fahren', text: parts.join(' '), view: viewOf(state) });
  checkEnd(state);
  return frames;
}

/**
 * Was passiert mit diesem Schiff in der nächsten Sturmphase (ohne neue Karten)?
 * @param {BoardView} state
 * @param {Ship} ship
 * @returns {'dock' | 'sail' | 'drift' | 'wreck'}
 */
export function shipForecast(state, ship) {
  if (state.lamps[ship.lane] > 0) return ship.step + 1 >= LANE_LENGTH ? 'dock' : 'sail';
  return ship.drift + 1 >= WRECK_AT ? 'wreck' : 'drift';
}
