/**
 * Ab nach Hause – Würfel-Laufspiel für 2–4 Personen (klassische Kreuz-und-Kreis-Mechanik).
 *
 * Regelentscheidungen:
 * - Rauskommen ist Pflicht: Bei einer 6 mit Figuren in der Basis muss eine Figur heraus,
 *   sofern das eigene Startfeld nicht von einer eigenen Figur besetzt ist. Eine fremde
 *   Figur auf dem Startfeld wird dabei geschlagen.
 * - Startfeld räumen: Steht eine eigene Figur auf dem Startfeld und sind noch Figuren in der
 *   Basis, muss diese Figur zuerst weiterziehen – wenn sie das mit dem Wurf kann. Kann sie es
 *   nicht (eigene Figur auf dem Zielfeld, Ziel jenseits des Zuhauses), sind alle anderen
 *   legalen Züge erlaubt. Die Pflicht zum Rauskommen hat Vorrang.
 * - Im Zuhause darf nicht über eigene Figuren gesprungen werden, Ziel muss exakt erreicht werden.
 * - Eine 6 gibt immer einen weiteren Wurf (auch wenn mit ihr kein Zug möglich war), außer das
 *   Spiel ist damit gewonnen.
 * - Drei Versuche: Steht keine eigene Figur auf der Bahn und ist ohne 6 kein Zug möglich
 *   (Basis + aufgeschlossenes Zuhause), darf bis zu dreimal gewürfelt werden. Nach einer 6
 *   und dem anschließenden Zug wird das neu bewertet.
 * - Gibt es nach einem Wurf keinen legalen Zug, geht der Zug automatisch weiter (oder es wird
 *   im Rahmen der drei Versuche erneut gewürfelt). Züge werden nie automatisch ausgeführt.
 *
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {{ id: string, name: string, seat: number, pieces: number[], homeCount: number }} HeimPlayer
 * @typedef {{ playerId: string, pieceIndex: number } | null} HeimCapture
 * @typedef {{ pieceIndex: number, from: number, to: number, capture: HeimCapture }} HeimLegalMove
 * @typedef {{ seq: number, playerId: string, pieceIndex: number, from: number, to: number, capture: HeimCapture }} HeimLastMove
 * @typedef {'start' | 'roll' | 'no-move' | 'retry' | 'bonus' | 'enter' | 'move' | 'capture' | 'home' | 'win'} HeimEventType
 * @typedef {{ seq: number, type: HeimEventType, playerId: string | null, text: string, dice?: number, capturedPlayerId?: string }} HeimEvent
 * @typedef {{
 *   currentPlayerId: string | null,
 *   winnerId: string | null,
 *   isDraw: boolean,
 *   phase: 'roll' | 'move' | 'done',
 *   dice: number | null,
 *   rollSeq: number,
 *   rollsLeft: number,
 *   maxRolls: number,
 *   legalMoves: HeimLegalMove[],
 *   turnOrder: string[],
 *   moveCount: number,
 *   lastMove: HeimLastMove | null,
 *   lastEvent: HeimEvent | null
 * }} HeimState
 * @typedef {{ id: string, gameId: string, name: string, status: 'running' | 'finished', createdAt: string, players: HeimPlayer[], state: HeimState }} HeimSession
 * @typedef {{ type?: unknown, pieceIndex?: unknown }} HeimMove
 */

import { BASE, HOME_END, HOME_START, PIECES_PER_PLAYER, SEAT_LAYOUT, SEATS, TRACK_LENGTH, trackIndexOf } from './board.js';

export const abNachHauseGame = {
  id: 'ab-nach-hause',
  name: 'Ab nach Hause',
  description: 'Würfeln, rauskommen, schlagen: Wer bringt zuerst alle vier Figuren ins Ziel?',
  previewImage: '/images/ab-nach-hause-scene.webp',
  minPlayers: 2,
  maxPlayers: 4
};

/**
 * Alle legalen Züge eines Spielers für einen Würfelwert (reine Funktion).
 * @param {HeimPlayer[]} players
 * @param {number} playerIndex
 * @param {number} die
 * @returns {HeimLegalMove[]}
 */
export function computeAbNachHauseLegalMoves(players, playerIndex, die) {
  const player = players[playerIndex];
  const { seat, pieces } = player;

  /** @type {Map<number, { playerId: string, pieceIndex: number, own: boolean }>} */
  const occupied = new Map();
  players.forEach((other, otherIndex) => {
    other.pieces.forEach((progress, pieceIndex) => {
      const field = trackIndexOf(other.seat, progress);
      if (field >= 0) occupied.set(field, { playerId: other.id, pieceIndex, own: otherIndex === playerIndex });
    });
  });

  /** @type {HeimLegalMove[]} */
  const candidates = [];
  pieces.forEach((progress, pieceIndex) => {
    if (progress === BASE) {
      if (die !== 6) return;
      const target = occupied.get(SEATS[seat].start);
      if (target?.own) return;
      candidates.push({ pieceIndex, from: BASE, to: 0, capture: target ? { playerId: target.playerId, pieceIndex: target.pieceIndex } : null });
      return;
    }
    const next = progress + die;
    if (next > HOME_END) return;
    if (next >= HOME_START) {
      // Kein Überspringen eigener Figuren im Zuhause, kein Landen auf eigener Figur.
      for (let field = Math.max(HOME_START, progress + 1); field <= next; field += 1) {
        if (pieces.includes(field)) return;
      }
      candidates.push({ pieceIndex, from: progress, to: next, capture: null });
      return;
    }
    const target = occupied.get(trackIndexOf(seat, next));
    if (target?.own) return;
    candidates.push({ pieceIndex, from: progress, to: next, capture: target ? { playerId: target.playerId, pieceIndex: target.pieceIndex } : null });
  });

  const inBase = pieces.some((progress) => progress === BASE);
  const onStart = pieces.indexOf(0);

  // Rauskommen ist Pflicht.
  if (die === 6 && inBase && onStart === -1) {
    return candidates.filter((move) => move.from === BASE);
  }
  // Startfeld räumen, solange noch Figuren in der Basis warten (wenn möglich).
  if (inBase && onStart !== -1) {
    const clear = candidates.filter((move) => move.pieceIndex === onStart);
    if (clear.length) return clear;
  }
  return candidates;
}

/**
 * Drei Versuche, wenn keine Figur auf der Bahn steht und ohne 6 nichts geht.
 * @param {HeimPlayer[]} players
 * @param {number} playerIndex
 */
export function abNachHauseRollsAllowed(players, playerIndex) {
  const { pieces } = players[playerIndex];
  if (pieces.some((progress) => progress >= 0 && progress < TRACK_LENGTH)) return 1;
  for (let die = 1; die <= 5; die += 1) {
    if (computeAbNachHauseLegalMoves(players, playerIndex, die).length) return 1;
  }
  return 3;
}

/**
 * @param {BasicPlayer[]} players
 * @param {{ random?: () => number }} [options]
 * @returns {HeimSession | { error: string }}
 */
export function createAbNachHauseSession(players, options = {}) {
  void options;
  const selected = Array.isArray(players) ? players.slice(0, abNachHauseGame.maxPlayers) : [];
  if (selected.length < abNachHauseGame.minPlayers) {
    return { error: 'Ab nach Hause braucht mindestens zwei Spieler.' };
  }
  const seats = SEAT_LAYOUT[selected.length];
  /** @type {HeimPlayer[]} */
  const heimPlayers = selected.map((player, index) => ({
    id: player.id,
    name: player.name,
    seat: seats[index],
    pieces: Array(PIECES_PER_PLAYER).fill(BASE),
    homeCount: 0
  }));
  const first = heimPlayers[0];

  /** @type {HeimSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: abNachHauseGame.id,
    name: abNachHauseGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: heimPlayers,
    state: {
      currentPlayerId: first.id,
      winnerId: null,
      isDraw: false,
      phase: 'roll',
      dice: null,
      rollSeq: 0,
      rollsLeft: 3,
      maxRolls: 3,
      legalMoves: [],
      turnOrder: heimPlayers.map((player) => player.id),
      moveCount: 0,
      lastMove: null,
      lastEvent: null
    }
  };
  beginTurn(session, 0);
  pushEvent(session, 'start', first.id, `${first.name} beginnt. Mit einer 6 kommt eine Figur heraus.`);
  return session;
}

/**
 * @param {HeimSession} session
 * @param {HeimEventType} type
 * @param {string | null} playerId
 * @param {string} text
 * @param {Partial<HeimEvent>} [extra]
 */
function pushEvent(session, type, playerId, text, extra = {}) {
  const seq = (session.state.lastEvent?.seq ?? 0) + 1;
  session.state.lastEvent = { seq, type, playerId, text, ...extra };
}

/**
 * Startet einen (Teil-)Zug: setzt Würfelphase und Anzahl der Versuche neu.
 * @param {HeimSession} session
 * @param {number} playerIndex
 */
function beginTurn(session, playerIndex) {
  const { state } = session;
  const allowed = abNachHauseRollsAllowed(session.players, playerIndex);
  state.currentPlayerId = session.players[playerIndex].id;
  state.phase = 'roll';
  state.rollsLeft = allowed;
  state.maxRolls = allowed;
  state.legalMoves = [];
}

/** @param {HeimSession} session @param {number} playerIndex */
function nextPlayerIndex(session, playerIndex) {
  return (playerIndex + 1) % session.players.length;
}

/** @param {number} value */
function diceWord(value) {
  return value === 6 ? 'eine 6' : `eine ${value}`;
}

/**
 * @param {HeimSession} session
 * @param {string} playerId
 * @param {HeimMove} move
 * @returns {{ session: HeimSession } | { error: string }}
 */
export function makeAbNachHauseMove(session, playerId, move) {
  if (!session || session.status !== 'running') {
    return { error: 'Dieses Spiel ist bereits beendet.' };
  }
  const playerIndex = session.players.findIndex((player) => player.id === playerId);
  if (playerIndex === -1) {
    return { error: 'Du spielst in dieser Runde nur als Zuschauer mit.' };
  }
  const { state } = session;
  if (state.currentPlayerId !== playerId) {
    return { error: 'Du bist noch nicht am Zug.' };
  }
  const type = move && typeof move === 'object' ? move.type : undefined;

  if (type === 'roll') {
    if (state.phase !== 'roll') return { error: 'Du hast schon gewürfelt – zieh jetzt eine Figur.' };
    return roll(session, playerIndex);
  }
  if (type === 'move') {
    if (state.phase !== 'move') return { error: 'Erst würfeln, dann ziehen.' };
    const pieceIndex = Number(move.pieceIndex);
    if (!Number.isInteger(pieceIndex) || pieceIndex < 0 || pieceIndex >= PIECES_PER_PLAYER) {
      return { error: 'Diese Figur gibt es nicht.' };
    }
    const legal = state.legalMoves.find((candidate) => candidate.pieceIndex === pieceIndex);
    if (!legal) return { error: 'Diese Figur kann mit dem Wurf nicht ziehen.' };
    return applyMove(session, playerIndex, legal);
  }
  return { error: 'Unbekannter Zug.' };
}

/**
 * @param {HeimSession} session
 * @param {number} playerIndex
 */
function roll(session, playerIndex) {
  const { state } = session;
  const player = session.players[playerIndex];
  const value = 1 + Math.min(5, Math.floor(Math.random() * 6));
  state.dice = value;
  state.rollSeq += 1;
  state.rollsLeft = Math.max(0, state.rollsLeft - 1);
  const legal = computeAbNachHauseLegalMoves(session.players, playerIndex, value);

  if (legal.length) {
    state.phase = 'move';
    state.legalMoves = legal;
    const hint = legal.length === 1 ? 'Ein Zug ist möglich.' : `${legal.length} Figuren können ziehen.`;
    pushEvent(session, 'roll', player.id, `${player.name} würfelt ${diceWord(value)}. ${hint}`, { dice: value });
    return { session };
  }

  state.legalMoves = [];
  if (value === 6) {
    beginTurn(session, playerIndex);
    pushEvent(session, 'bonus', player.id, `${player.name} würfelt eine 6, kann aber nicht ziehen – und darf noch einmal würfeln.`, { dice: value });
    return { session };
  }
  if (state.rollsLeft > 0) {
    state.phase = 'roll';
    const left = state.rollsLeft === 1 ? 'ein Versuch' : `${state.rollsLeft} Versuche`;
    pushEvent(session, 'retry', player.id, `${player.name} würfelt ${diceWord(value)} – keine 6. Noch ${left}.`, { dice: value });
    return { session };
  }
  const next = session.players[nextPlayerIndex(session, playerIndex)];
  beginTurn(session, nextPlayerIndex(session, playerIndex));
  pushEvent(session, 'no-move', player.id, `${player.name} würfelt ${diceWord(value)} und kann nicht ziehen. ${next.name} ist dran.`, { dice: value });
  return { session };
}

/**
 * @param {HeimSession} session
 * @param {number} playerIndex
 * @param {HeimLegalMove} legal
 */
function applyMove(session, playerIndex, legal) {
  const { state } = session;
  const player = session.players[playerIndex];
  const die = /** @type {number} */ (state.dice);

  player.pieces[legal.pieceIndex] = legal.to;
  /** @type {HeimPlayer | undefined} */
  let victim;
  if (legal.capture) {
    const capture = legal.capture;
    victim = session.players.find((candidate) => candidate.id === capture.playerId);
    if (victim) victim.pieces[capture.pieceIndex] = BASE;
  }
  player.homeCount = player.pieces.filter((progress) => progress >= HOME_START).length;
  state.moveCount += 1;
  state.legalMoves = [];
  state.lastMove = { seq: state.moveCount, playerId: player.id, pieceIndex: legal.pieceIndex, from: legal.from, to: legal.to, capture: legal.capture };

  if (player.homeCount === PIECES_PER_PLAYER) {
    session.status = 'finished';
    state.phase = 'done';
    state.winnerId = player.id;
    state.currentPlayerId = null;
    state.rollsLeft = 0;
    pushEvent(session, 'win', player.id, `${player.name} hat alle Figuren zu Hause und gewinnt!`);
    return { session };
  }

  let text;
  /** @type {HeimEventType} */
  let type = 'move';
  if (victim) {
    type = 'capture';
    text = `${player.name} schlägt eine Figur von ${victim.name} – zurück in die Basis!`;
  } else if (legal.from === BASE) {
    type = 'enter';
    text = `${player.name} bringt eine Figur ins Spiel.`;
  } else if (legal.to >= HOME_START && legal.from < HOME_START) {
    type = 'home';
    text = `${player.name} bringt eine Figur nach Hause (${player.homeCount} von 4).`;
  } else {
    text = `${player.name} zieht ${die} ${die === 1 ? 'Feld' : 'Felder'}.`;
  }

  if (die === 6) {
    beginTurn(session, playerIndex);
    text += ' Die 6 gibt einen weiteren Wurf.';
  } else {
    beginTurn(session, nextPlayerIndex(session, playerIndex));
  }
  pushEvent(session, type, player.id, text, victim ? { capturedPlayerId: victim.id } : {});
  return { session };
}
