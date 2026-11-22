/**
 * Leuchtturmwächter – kooperatives Spiel für 2–5 Personen. Alle gegen den Sturm.
 *
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {import('./rules.js').BoardView} BoardView
 * @typedef {import('./rules.js').StormCard} StormCard
 * @typedef {import('./rules.js').GuardStats} GuardStats
 * @typedef {{ id: string, name: string, stats: GuardStats }} LtPlayer
 * @typedef {{ kind: 'flood' | 'flicker' | 'ship' | 'surge' | 'ships', title: string, text: string, view: BoardView }} StormFrame
 * @typedef {{ seq: number, playerId: string, before: BoardView, frames: StormFrame[], summary: string }} StormRecord
 * @typedef {{ seq: number, type: string, playerId: string | null, text: string }} LtEvent
 * @typedef {{ tiles: BoardView['tiles'], lamps: BoardView['lamps'], ships: BoardView['ships'], guards: BoardView['guards'], saved: number, actionsLeft: number, freeSandbagUsed: boolean, stats: Record<string, GuardStats> }} UndoSnapshot
 * @typedef {BoardView & {
 *   phase: 'actions' | 'finished',
 *   difficulty: string,
 *   target: number,
 *   currentPlayerId: string | null,
 *   turnOrder: string[],
 *   turn: number,
 *   actionsLeft: number,
 *   freeSandbagUsed: boolean,
 *   nextShipId: number,
 *   deck: StormCard[],
 *   discard: StormCard[],
 *   deckCount?: number,
 *   undo: UndoSnapshot[],
 *   undoCount?: number,
 *   plans: Record<string, string>,
 *   storm: StormRecord | null,
 *   result: 'won' | 'lost' | null,
 *   reason: string,
 *   coop: true,
 *   winnerId: null,
 *   winnerIds: string[],
 *   isDraw: false,
 *   moveCount: number,
 *   lastEvent: LtEvent | null
 * }} LtState
 * @typedef {{ id: string, gameId: string, name: string, status: 'running' | 'finished', createdAt: string, players: LtPlayer[], state: LtState }} LtSession
 * @typedef {{ type?: unknown, at?: unknown, shipId?: unknown }} LtMove
 */

import {
  ACTIONS_PER_TURN,
  DIFFICULTIES,
  ISLAND_KEYS,
  LANE_IDS,
  LIGHTHOUSE,
  ROLES,
  ROLE_ORDER,
  START_TILES,
  applyAction,
  checkEnd,
  createStormDeck,
  isAlive,
  resolveStorm,
  shuffle,
  viewOf
} from './rules.js';

export const leuchtturmGame = {
  id: 'leuchtturm',
  name: 'Leuchtturmwächter',
  description: 'Alle gegen den Sturm: Haltet die Leuchtfeuer am Brennen, stopft die Deiche und lotst gemeinsam genug Schiffe in den Hafen.',
  previewImage: '/images/leuchtturm-scene.svg',
  minPlayers: 2,
  maxPlayers: 5
};

const ACTIONS = new Set(['walk', 'sandbag', 'kindle', 'pilot']);

/** @param {LtSession} session @param {string | null} playerId */
function nameOf(session, playerId) {
  return session.players.find((player) => player.id === playerId)?.name ?? 'Jemand';
}

/** @param {LtSession} session @param {Omit<LtEvent, 'seq'>} event */
function setEvent(session, event) {
  const seq = (session.state.lastEvent?.seq ?? 0) + 1;
  session.state.lastEvent = { seq, ...event };
}

/** @param {LtSession} session @returns {UndoSnapshot} */
function snapshot(session) {
  const { state } = session;
  return JSON.parse(JSON.stringify({
    tiles: state.tiles,
    lamps: state.lamps,
    ships: state.ships,
    guards: state.guards,
    saved: state.saved,
    actionsLeft: state.actionsLeft,
    freeSandbagUsed: state.freeSandbagUsed,
    stats: Object.fromEntries(session.players.map((player) => [player.id, player.stats]))
  }));
}

/** @param {LtSession} session */
function finish(session) {
  const { state } = session;
  state.phase = 'finished';
  state.currentPlayerId = null;
  state.winnerIds = state.result === 'won' ? session.players.map((player) => player.id) : [];
  session.status = 'finished';
  setEvent(session, { type: state.result === 'won' ? 'win' : 'lose', playerId: null, text: state.reason });
}

/**
 * @param {BasicPlayer[]} players
 * @param {Record<string, unknown>} [options]
 * @returns {LtSession | { error: string }}
 */
export function createLeuchtturmSession(players, options = {}) {
  const selected = (Array.isArray(players) ? players : []).slice(0, leuchtturmGame.maxPlayers);
  if (selected.length < leuchtturmGame.minPlayers) {
    return { error: 'Leuchtturmwächter braucht mindestens zwei Spieler.' };
  }
  const difficulty = typeof options.difficulty === 'string' && options.difficulty in DIFFICULTIES ? options.difficulty : 'normal';
  const setup = DIFFICULTIES[difficulty];
  const roles = shuffle(ROLE_ORDER).slice(0, selected.length);
  const order = selected.map((player) => player.id);
  const previous = typeof options.previousStarterId === 'string' ? order.indexOf(options.previousStarterId) : -1;
  const start = previous >= 0 ? (previous + 1) % order.length : Math.floor(Math.random() * order.length);
  const turnOrder = [...order.slice(start), ...order.slice(0, start)];

  /** @type {Record<string, import('./rules.js').TileState>} */
  const tiles = Object.fromEntries(ISLAND_KEYS.map((key) => [key, /** @type {const} */ ('dry')]));
  let deck = shuffle(createStormDeck());
  /** @type {StormCard[]} */
  const discard = [];
  // Zu Beginn sind schon ein paar Felder nass – nie der Leuchtturm.
  let wet = 0;
  for (const card of [...deck]) {
    if (wet >= setup.wet) break;
    if (card.type !== 'flood' || card.at === LIGHTHOUSE) continue;
    tiles[card.at] = 'wet';
    deck = deck.filter((other) => other !== card);
    discard.push(card);
    wet += 1;
  }

  /** @type {LtSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: leuchtturmGame.id,
    name: leuchtturmGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selected.map((player) => ({ id: player.id, name: player.name, stats: { steps: 0, sandbags: 0, kindled: 0, piloted: 0 } })),
    state: {
      phase: 'actions',
      difficulty,
      target: setup.target,
      tiles,
      lamps: { ...setup.lamps },
      ships: LANE_IDS.map((lane, index) => ({ id: index + 1, lane, step: 0, drift: 0 })),
      guards: order.map((playerId, index) => ({ playerId, role: roles[index], at: START_TILES[index] })),
      saved: 0,
      wrecked: 0,
      stormStep: setup.stormStep,
      currentPlayerId: turnOrder[0],
      turnOrder,
      turn: 1,
      actionsLeft: ACTIONS_PER_TURN,
      freeSandbagUsed: false,
      nextShipId: LANE_IDS.length + 1,
      deck,
      discard,
      undo: [],
      plans: {},
      storm: null,
      result: null,
      reason: '',
      coop: true,
      winnerId: null,
      winnerIds: [],
      isDraw: false,
      moveCount: 0,
      lastEvent: null
    }
  };
  setEvent(session, { type: 'start', playerId: turnOrder[0], text: `${nameOf(session, turnOrder[0])} beginnt.` });
  return session;
}

/**
 * @param {LtSession} session
 * @param {string} playerId
 * @param {LtMove} move
 * @returns {{ session: LtSession } | { error: string }}
 */
export function makeLeuchtturmMove(session, playerId, move) {
  const { state } = session;
  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) return { error: 'Du spielst in dieser Runde nicht mit.' };
  if (session.status !== 'running') return { error: 'Das Spiel ist schon vorbei.' };
  const type = typeof move?.type === 'string' ? move.type : '';

  if (type === 'plan') {
    const at = typeof move.at === 'string' && isAlive(state.tiles, move.at) ? move.at : null;
    if (!at || state.plans[playerId] === at) delete state.plans[playerId];
    else state.plans[playerId] = at;
    state.moveCount += 1;
    return { session };
  }

  if (state.currentPlayerId !== playerId) return { error: 'Du bist gerade nicht dran.' };

  if (ACTIONS.has(type)) {
    const before = snapshot(session);
    const result = applyAction(state, playerId, { action: type, at: move.at, shipId: move.shipId });
    if ('error' in result) return { error: result.error };
    state.undo.push(before);
    const stats = player.stats;
    if (type === 'walk') stats.steps += 1;
    if (type === 'sandbag') stats.sandbags += 1;
    if (type === 'kindle') stats.kindled += 1;
    if (type === 'pilot') stats.piloted += 1;
    state.moveCount += 1;
    setEvent(session, { type, playerId, text: result.text });
    if (checkEnd(state)) finish(session);
    return { session };
  }

  if (type === 'undo') {
    const last = state.undo.pop();
    if (!last) return { error: 'Es gibt nichts zurückzunehmen.' };
    state.tiles = last.tiles;
    state.lamps = last.lamps;
    state.ships = last.ships;
    state.guards = last.guards;
    state.saved = last.saved;
    state.actionsLeft = last.actionsLeft;
    state.freeSandbagUsed = last.freeSandbagUsed;
    for (const candidate of session.players) candidate.stats = last.stats[candidate.id] ?? candidate.stats;
    state.moveCount += 1;
    setEvent(session, { type: 'undo', playerId, text: `${player.name} nimmt die letzte Aktion zurück.` });
    return { session };
  }

  if (type === 'end') {
    state.undo = [];
    const before = viewOf(state);
    const frames = resolveStorm(state);
    state.storm = {
      seq: (state.storm?.seq ?? 0) + 1,
      playerId,
      before,
      frames,
      summary: frames.map((frame) => frame.text).join(' ')
    };
    state.moveCount += 1;
    if (state.result) {
      finish(session);
      return { session };
    }
    const index = state.turnOrder.indexOf(playerId);
    const next = state.turnOrder[(index + 1) % state.turnOrder.length];
    state.currentPlayerId = next;
    state.actionsLeft = ACTIONS_PER_TURN;
    state.freeSandbagUsed = false;
    state.turn += 1;
    delete state.plans[next];
    const guard = state.guards.find((candidate) => candidate.playerId === next);
    setEvent(session, {
      type: 'turn',
      playerId: next,
      text: `Der Sturm ist vorbei. Jetzt ist ${nameOf(session, next)} mit ${guard ? ROLES[guard.role].name : 'dem Wächter'} dran.`
    });
    return { session };
  }

  return { error: 'Unbekannter Zug.' };
}

/**
 * Die Reihenfolge des Sturmstapels bleibt geheim.
 * @param {LtSession} session
 * @param {string | null} _viewerId
 */
export function redactLeuchtturmSession(session, _viewerId) {
  const state = /** @type {Partial<LtState>} */ (session.state);
  if (Array.isArray(state.deck)) {
    state.deckCount = state.deck.length;
    delete state.deck;
  }
  if (Array.isArray(state.undo)) {
    state.undoCount = state.undo.length;
    delete state.undo;
  }
  delete state.discard;
  return session;
}
