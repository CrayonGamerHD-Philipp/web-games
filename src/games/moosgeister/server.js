/**
 * Moosgeister – Kartenauswahl-Spiel für 2–5 Personen in 3 Durchgängen.
 *
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {import('./rules.js').MoosCard} MoosCard
 * @typedef {import('./rules.js').MoosLayout} MoosLayout
 * @typedef {import('./rules.js').MoosScore} MoosScore
 * @typedef {{ id: string, name: string, layout: MoosLayout, discarded: number }} MoosPlayer
 * @typedef {'start' | 'take' | 'round' | 'durchgang-end' | 'durchgang-start' | 'continue' | 'win'} MoosEventType
 * @typedef {{ seq: number, type: MoosEventType, playerId: string | null, card?: MoosCard, slot?: number | null, result?: string, text: string }} MoosEvent
 * @typedef {{ durchgang: number, scores: { playerId: string, breakdown: MoosScore }[] }} MoosDurchgangResult
 * @typedef {{
 *   phase: 'drafting' | 'scoring' | 'finished',
 *   durchgang: number,
 *   totalDurchgaenge: number,
 *   runde: number,
 *   deck: MoosCard[],
 *   deckCount: number,
 *   market: MoosCard[],
 *   currentPlayerId: string | null,
 *   turnOrder: string[],
 *   startPlayerId: string | null,
 *   roundStarterId: string | null,
 *   lastTakerId: string | null,
 *   picksThisRound: number,
 *   confirmedPlayerIds: string[],
 *   results: MoosDurchgangResult[],
 *   totals: { playerId: string, score: number }[],
 *   roundScores: { playerId: string, score: number }[],
 *   higherScoreWins: true,
 *   winnerId: string | null,
 *   winnerIds: string[],
 *   isDraw: boolean,
 *   moveCount: number,
 *   lastEvent: MoosEvent | null
 * }} MoosState
 * @typedef {{ id: string, gameId: string, name: string, status: 'running' | 'finished', createdAt: string, players: MoosPlayer[], state: MoosState }} MoosSession
 * @typedef {{ type?: unknown, cardId?: unknown, slot?: unknown, flipOld?: unknown }} MoosMove
 */

import { applyPlacement, createMoosDeck, emptyLayout, isComplete, moosCardName, scoreLayout } from './rules.js';

export const moosgeisterGame = {
  id: 'moosgeister',
  name: 'Moosgeister',
  description: 'Reihum Waldgeister aus der Mitte wählen, auf ihren Platz im 3×3-Wald setzen und klug mit Moos unterlegen – drei Durchgänge lang.',
  previewImage: '/images/moosgeister-scene.webp',
  minPlayers: 2,
  maxPlayers: 5
};

/**
 * @template T
 * @param {T[]} items
 */
function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/** @param {MoosSession} session @param {string | null} playerId */
function nameOf(session, playerId) {
  return session.players.find((player) => player.id === playerId)?.name ?? 'Jemand';
}

/**
 * @param {MoosSession} session
 * @param {Omit<MoosEvent, 'seq'>} event
 */
function setEvent(session, event) {
  const seq = (session.state.lastEvent?.seq ?? 0) + 1;
  session.state.lastEvent = { seq, ...event };
}

/** @param {MoosSession} session @param {string} playerId */
function playerAfter(session, playerId) {
  const order = session.state.turnOrder;
  return order[(order.indexOf(playerId) + 1) % order.length];
}

/** @param {MoosSession} session */
function marketSize(session) {
  return session.players.length === 2 ? 4 : session.players.length;
}

/**
 * Deckt neue Karten auf. Gibt false zurück, wenn der Stapel leer ist.
 * @param {MoosSession} session
 * @param {string} starterId
 */
function startRound(session, starterId) {
  const { state } = session;
  const count = Math.min(marketSize(session), state.deck.length);
  if (count === 0) return false;
  state.market = state.deck.splice(0, count);
  state.deckCount = state.deck.length;
  state.runde += 1;
  state.picksThisRound = 0;
  state.roundStarterId = starterId;
  state.currentPlayerId = starterId;
  return true;
}

/**
 * @param {MoosSession} session
 * @param {string} starterId
 */
function startDurchgang(session, starterId) {
  const { state } = session;
  state.phase = 'drafting';
  state.deck = shuffle(createMoosDeck());
  state.runde = 0;
  state.confirmedPlayerIds = [];
  for (const player of session.players) {
    player.layout = emptyLayout();
    player.discarded = 0;
  }
  startRound(session, starterId);
}

/** @param {MoosSession} session */
function endDurchgang(session) {
  const { state } = session;
  const scores = session.players.map((player) => ({ playerId: player.id, breakdown: scoreLayout(player.layout, state.durchgang) }));
  state.results.push({ durchgang: state.durchgang, scores });
  state.totals = session.players.map((player) => ({
    playerId: player.id,
    score: state.results.reduce((sum, result) => sum + (result.scores.find((score) => score.playerId === player.id)?.breakdown.total ?? 0), 0)
  }));
  state.market = [];
  state.currentPlayerId = null;
  state.confirmedPlayerIds = [];

  const best = [...scores].sort((a, b) => b.breakdown.total - a.breakdown.total)[0];
  if (state.durchgang >= state.totalDurchgaenge) {
    finishGame(session);
    return;
  }
  state.phase = 'scoring';
  setEvent(session, {
    type: 'durchgang-end',
    playerId: null,
    text: `Durchgang ${state.durchgang} ist gewertet. Die meisten Punkte holt ${nameOf(session, best.playerId)} (${best.breakdown.total}).`
  });
}

/** @param {MoosSession} session */
function finishGame(session) {
  const { state } = session;
  const top = Math.max(...state.totals.map((total) => total.score));
  const winnerIds = state.totals.filter((total) => total.score === top).map((total) => total.playerId);
  state.phase = 'finished';
  state.winnerIds = winnerIds;
  state.winnerId = winnerIds.length === 1 ? winnerIds[0] : null;
  state.isDraw = winnerIds.length !== 1;
  state.roundScores = state.totals.map((total) => ({ ...total }));
  session.status = 'finished';
  setEvent(session, {
    type: 'win',
    playerId: state.winnerId,
    text: winnerIds.length === 1
      ? `${nameOf(session, winnerIds[0])} gewinnt mit ${top} Punkten.`
      : `Gleichstand mit ${top} Punkten: ${winnerIds.map((id) => nameOf(session, id)).join(', ')}.`
  });
}

/**
 * @param {BasicPlayer[]} players
 * @param {Record<string, unknown>} [options]
 * @returns {MoosSession | { error: string }}
 */
export function createMoosgeisterSession(players, options = {}) {
  const selected = (Array.isArray(players) ? players : []).slice(0, moosgeisterGame.maxPlayers);
  if (selected.length < moosgeisterGame.minPlayers) {
    return { error: 'Moosgeister braucht mindestens zwei Spieler.' };
  }
  const totalDurchgaenge = Number(options.durchgaenge) === 1 ? 1 : 3;
  const turnOrder = selected.map((player) => player.id);
  const previous = typeof options.previousStarterId === 'string' ? turnOrder.indexOf(options.previousStarterId) : -1;
  const startPlayerId = previous >= 0 ? turnOrder[(previous + 1) % turnOrder.length] : turnOrder[Math.floor(Math.random() * turnOrder.length)];

  /** @type {MoosSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: moosgeisterGame.id,
    name: moosgeisterGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selected.map((player) => ({ id: player.id, name: player.name, layout: emptyLayout(), discarded: 0 })),
    state: {
      phase: 'drafting',
      durchgang: 1,
      totalDurchgaenge,
      runde: 0,
      deck: [],
      deckCount: 0,
      market: [],
      currentPlayerId: null,
      turnOrder,
      startPlayerId,
      roundStarterId: null,
      lastTakerId: null,
      picksThisRound: 0,
      confirmedPlayerIds: [],
      results: [],
      totals: turnOrder.map((playerId) => ({ playerId, score: 0 })),
      roundScores: [],
      higherScoreWins: true,
      winnerId: null,
      winnerIds: [],
      isDraw: false,
      moveCount: 0,
      lastEvent: null
    }
  };
  startDurchgang(session, startPlayerId);
  setEvent(session, { type: 'start', playerId: startPlayerId, text: `${nameOf(session, startPlayerId)} wählt zuerst.` });
  return session;
}

const RESULT_TEXT = {
  place: 'setzt',
  cover: 'setzt auf Moos:',
  'flip-new': 'legt als Moos unter den Geist:',
  'flip-old': 'unterlegt mit dem alten Geist:',
  moss: 'legt als Moos aus:',
  discard: 'muss abwerfen:'
};

/**
 * @param {MoosSession} session
 * @param {string} playerId
 * @param {MoosMove} move
 * @returns {{ session: MoosSession } | { error: string }}
 */
export function makeMoosgeisterMove(session, playerId, move) {
  const { state } = session;
  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) return { error: 'Du spielst in dieser Runde nicht mit.' };
  if (session.status !== 'running') return { error: 'Das Spiel ist schon vorbei.' };

  if (move?.type === 'continue') {
    if (state.phase !== 'scoring') return { error: 'Gerade gibt es nichts zu bestätigen.' };
    if (!state.confirmedPlayerIds.includes(playerId)) state.confirmedPlayerIds.push(playerId);
    state.moveCount += 1;
    if (state.confirmedPlayerIds.length >= session.players.length) {
      state.durchgang += 1;
      const starter = state.lastTakerId ?? state.startPlayerId ?? state.turnOrder[0];
      startDurchgang(session, starter);
      setEvent(session, { type: 'durchgang-start', playerId: starter, text: `Durchgang ${state.durchgang} beginnt. ${nameOf(session, starter)} wählt zuerst.` });
    } else {
      setEvent(session, { type: 'continue', playerId, text: `${player.name} ist bereit für den nächsten Durchgang.` });
    }
    return { session };
  }

  if (move?.type !== 'take') return { error: 'Unbekannter Zug.' };
  if (state.phase !== 'drafting') return { error: 'Gerade wird gewertet.' };
  if (state.currentPlayerId !== playerId) return { error: 'Du bist nicht am Zug.' };
  const card = state.market.find((candidate) => candidate.id === move.cardId);
  if (!card) return { error: 'Diese Karte liegt nicht in der Mitte.' };

  const placed = applyPlacement(player.layout, card, { slot: move.slot, flipOld: move.flipOld });
  if ('error' in placed) return { error: placed.error };
  player.layout = placed.layout;
  if (placed.result === 'discard') player.discarded += 1;
  state.market = state.market.filter((candidate) => candidate.id !== card.id);
  state.picksThisRound += 1;
  state.lastTakerId = playerId;
  state.moveCount += 1;
  setEvent(session, {
    type: 'take',
    playerId,
    card,
    slot: placed.slot,
    result: placed.result,
    text: `${player.name} ${RESULT_TEXT[placed.result]} ${moosCardName(card)}.`
  });

  const roundOver = state.market.length === 0;
  const checkpoint = session.players.length === 2 ? state.picksThisRound % 2 === 0 || roundOver : roundOver;
  if (checkpoint && session.players.some((candidate) => isComplete(candidate.layout))) {
    endDurchgang(session);
    return { session };
  }
  if (roundOver) {
    // Wer die letzte Karte nehmen musste, beginnt die nächste Runde.
    if (!startRound(session, playerId)) endDurchgang(session);
    return { session };
  }
  state.currentPlayerId = playerAfter(session, playerId);
  return { session };
}

/**
 * Verdeckte Moos-Karten der anderen bleiben geheim, bis der Durchgang gewertet ist.
 * @param {MoosSession} session
 * @param {string | null} viewerId
 */
export function redactMoosgeisterSession(session, viewerId) {
  const state = /** @type {Partial<MoosState>} */ (session.state);
  if (Array.isArray(state.deck)) {
    state.deckCount = state.deck.length;
    delete state.deck;
  }
  if (state.phase === 'drafting') {
    for (const player of session.players) {
      if (viewerId && player.id === viewerId) continue;
      player.layout = player.layout.map((slot) => (slot.moss ? { ...slot, moss: { hidden: true } } : slot));
    }
  }
  return session;
}
