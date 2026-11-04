/**
 * Würfelblock – fünf Würfel, drei Würfe, dreizehn Zeilen auf dem Block.
 *
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {import('./rules.js').BlockCategory} BlockCategory
 * @typedef {import('./rules.js').BlockSheet} BlockSheet
 * @typedef {{ id: string, name: string, sheet: BlockSheet, total: number }} BlockPlayer
 * @typedef {'start' | 'roll' | 'hold' | 'score' | 'strike' | 'finish'} BlockEventType
 * @typedef {{ seq: number, type: BlockEventType, playerId: string | null, text: string, category?: BlockCategory, points?: number }} BlockEvent
 * @typedef {{
 *   currentPlayerId: string | null,
 *   winnerId: string | null,
 *   isDraw: boolean,
 *   turnOrder: string[],
 *   startPlayerId: string | null,
 *   dice: number[],
 *   held: boolean[],
 *   rollsUsed: number,
 *   rollSeq: number,
 *   round: number,
 *   turnCount: number,
 *   moveCount: number,
 *   lastEvent: BlockEvent | null
 * }} BlockState
 * @typedef {{ id: string, gameId: string, name: string, status: 'running' | 'finished', createdAt: string, players: BlockPlayer[], state: BlockState }} BlockSession
 * @typedef {{ type?: unknown, held?: unknown, category?: unknown, roll?: unknown }} BlockMove
 */

import {
  CATEGORIES,
  CATEGORY_NAMES,
  DICE_COUNT,
  MAX_ROLLS,
  emptySheet,
  isCategory,
  scoreCategory,
  sheetTotals
} from './rules.js';

export const wuerfelblockGame = {
  id: 'wuerfelblock',
  name: 'Würfelblock',
  description: 'Fünf Würfel, drei Würfe, dreizehn Zeilen: Pasch, Straße oder Volltreffer – wer füllt den Block am besten?',
  previewImage: '/images/wuerfelblock-scene.webp',
  minPlayers: 1,
  maxPlayers: 6
};

/** Unbiased die roll 1..6 using the platform CSPRNG. */
function rollDie() {
  const buffer = new Uint32Array(1);
  const limit = 4294967296 - (4294967296 % 6);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return (buffer[0] % 6) + 1;
  }
}

/** @param {number} n */
function randomIndex(n) {
  const buffer = new Uint32Array(1);
  const limit = 4294967296 - (4294967296 % n);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % n;
  }
}

/**
 * @param {BlockSession} session
 * @param {BlockEventType} type
 * @param {string | null} playerId
 * @param {string} text
 * @param {Partial<BlockEvent>} [extra]
 */
function setEvent(session, type, playerId, text, extra = {}) {
  const seq = (session.state.lastEvent?.seq ?? 0) + 1;
  session.state.lastEvent = { seq, type, playerId, text, ...extra };
}

/**
 * @param {BasicPlayer[]} players
 * @param {Record<string, unknown>} [options]
 * @returns {BlockSession | { error: string }}
 */
export function createWuerfelblockSession(players, options = {}) {
  void options;
  const selected = (Array.isArray(players) ? players : []).slice(0, wuerfelblockGame.maxPlayers);
  if (selected.length < wuerfelblockGame.minPlayers) {
    return { error: 'Würfelblock braucht mindestens einen Spieler.' };
  }

  const order = selected.map((player) => player.id);
  const start = randomIndex(order.length);
  const turnOrder = [...order.slice(start), ...order.slice(0, start)];

  /** @type {BlockSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: wuerfelblockGame.id,
    name: wuerfelblockGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selected.map((player) => ({ id: player.id, name: player.name, sheet: emptySheet(), total: 0 })),
    state: {
      currentPlayerId: turnOrder[0],
      winnerId: null,
      isDraw: false,
      turnOrder,
      startPlayerId: turnOrder[0],
      dice: Array(DICE_COUNT).fill(0),
      held: Array(DICE_COUNT).fill(false),
      rollsUsed: 0,
      rollSeq: 0,
      round: 1,
      turnCount: 0,
      moveCount: 0,
      lastEvent: null
    }
  };
  const first = session.players.find((player) => player.id === turnOrder[0]);
  setEvent(session, 'start', null, `${first?.name ?? 'Jemand'} beginnt.`);
  return session;
}

/** @param {unknown} held */
function isValidHeld(held) {
  return Array.isArray(held) && held.length === DICE_COUNT && held.every((value) => typeof value === 'boolean');
}

/**
 * @param {BlockSession} session
 * @param {string} playerId
 * @param {BlockMove} move
 * @returns {{ session: BlockSession } | { error: string }}
 */
export function makeWuerfelblockMove(session, playerId, move) {
  if (!session || session.status !== 'running') {
    return { error: 'Dieses Spiel ist bereits beendet.' };
  }
  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return { error: 'Du schaust in dieser Runde nur zu.' };
  }
  if (!move || typeof move !== 'object') {
    return { error: 'Dieser Zug ist ungültig.' };
  }
  const { state } = session;
  if (state.currentPlayerId !== playerId) {
    return { error: 'Du bist noch nicht am Zug.' };
  }

  if (move.type === 'roll') {
    if (state.rollsUsed >= MAX_ROLLS) {
      return { error: 'Du hast schon dreimal gewürfelt. Trag jetzt etwas ein.' };
    }
    const isFirst = state.rollsUsed === 0;
    /** @type {boolean[]} */
    let held = Array(DICE_COUNT).fill(false);
    if (!isFirst) {
      if (!isValidHeld(move.held)) {
        return { error: 'Die gehaltenen Würfel sind ungültig.' };
      }
      held = [.../** @type {boolean[]} */ (move.held)];
      if (held.every(Boolean)) {
        return { error: 'Lass mindestens einen Würfel rollen.' };
      }
    }
    state.dice = state.dice.map((value, index) => (held[index] ? value : rollDie()));
    state.held = held;
    state.rollsUsed += 1;
    state.rollSeq += 1;
    state.moveCount += 1;
    const left = MAX_ROLLS - state.rollsUsed;
    setEvent(session, 'roll', playerId, `${player.name} würfelt ${state.dice.join('-')}${left ? ` (noch ${left} ${left === 1 ? 'Wurf' : 'Würfe'})` : ''}.`);
    return { session };
  }

  if (move.type === 'hold') {
    // Live-Anzeige für Zuschauer. Veraltete Anfragen (anderer Wurf) werden still ignoriert.
    if (!isValidHeld(move.held)) {
      return { error: 'Die gehaltenen Würfel sind ungültig.' };
    }
    if (state.rollsUsed === 0 || state.rollsUsed >= MAX_ROLLS || move.roll !== state.rollsUsed) {
      return { session };
    }
    state.held = [.../** @type {boolean[]} */ (move.held)];
    return { session };
  }

  if (move.type === 'score') {
    if (state.rollsUsed < 1) {
      return { error: 'Würfle zuerst mindestens einmal.' };
    }
    if (!isCategory(move.category)) {
      return { error: 'Diese Zeile gibt es nicht.' };
    }
    const category = /** @type {BlockCategory} */ (move.category);
    if (typeof player.sheet[category] === 'number') {
      return { error: `${CATEGORY_NAMES[category]} ist schon ausgefüllt.` };
    }
    const points = scoreCategory(category, state.dice);
    player.sheet[category] = points;
    player.total = sheetTotals(player.sheet).total;
    state.moveCount += 1;
    state.turnCount += 1;
    setEvent(
      session,
      points > 0 ? 'score' : 'strike',
      playerId,
      points > 0 ? `${player.name} trägt ${points} bei ${CATEGORY_NAMES[category]} ein.` : `${player.name} streicht ${CATEGORY_NAMES[category]}.`,
      { category, points }
    );

    const done = session.players.every((candidate) => CATEGORIES.every((cat) => typeof candidate.sheet[cat] === 'number'));
    state.dice = Array(DICE_COUNT).fill(0);
    state.held = Array(DICE_COUNT).fill(false);
    state.rollsUsed = 0;

    if (done) {
      finish(session);
      return { session };
    }

    const index = state.turnOrder.indexOf(playerId);
    const nextIndex = (index + 1) % state.turnOrder.length;
    state.currentPlayerId = state.turnOrder[nextIndex];
    if (nextIndex === 0) state.round += 1;
    return { session };
  }

  return { error: 'Diesen Zug kennt Würfelblock nicht.' };
}

/** @param {BlockSession} session */
function finish(session) {
  const { state } = session;
  session.status = 'finished';
  state.currentPlayerId = null;
  for (const player of session.players) player.total = sheetTotals(player.sheet).total;
  const best = Math.max(...session.players.map((player) => player.total));
  const leaders = session.players.filter((player) => player.total === best);
  if (leaders.length === 1) {
    state.winnerId = leaders[0].id;
    state.isDraw = false;
    const text =
      session.players.length === 1
        ? `Block voll: ${leaders[0].name} schafft ${best} Punkte.`
        : `${leaders[0].name} gewinnt mit ${best} Punkten.`;
    setEvent(session, 'finish', leaders[0].id, text, { points: best });
  } else {
    state.winnerId = null;
    state.isDraw = true;
    setEvent(session, 'finish', null, `Unentschieden mit ${best} Punkten.`, { points: best });
  }
}
