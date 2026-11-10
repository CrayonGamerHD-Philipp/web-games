/**
 * Verrückte Kreuze – Würfel- und Ankreuzspiel für 1–6 Personen.
 * Jede Runde (Session) bekommt ein neu erzeugtes Brett, das für alle gleich ist.
 * Modus „erweitert“ bringt Sonderwürfel, Zeilenwertung, Herzen und goldene Würfelfelder.
 *
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {import('./board.js').Board} Board
 * @typedef {import('./board.js').KreuzColor} KreuzColor
 * @typedef {import('./board.js').BoardSize} BoardSize
 * @typedef {import('./rules.js').Claims} Claims
 * @typedef {import('./rules.js').SpecialKind} SpecialKind
 * @typedef {import('./rules.js').ScoreBreakdown} ScoreBreakdown
 * @typedef {KreuzColor | 'joker'} ColorFace
 * @typedef {number | 'joker'} NumberFace
 * @typedef {{ id: string, colorDice: ColorFace[], numberDice: NumberFace[], specialDie: SpecialKind | null }} Roll
 * @typedef {{ colorDieIndex: number, numberDieIndex: number, color: KreuzColor, number: number, jokerCost: number }} ResolvedCombo
 * @typedef {{ combo: ResolvedCombo | null, special: SpecialKind | null }} ResolvedChoice  Farbe+Zahl und/oder Sonderwürfel
 * @typedef {{
 *   id: string, name: string,
 *   checkedCells: string[],
 *   lastCells: string[],
 *   usedJokers: number,
 *   hearts: number,
 *   specialTokens: number,
 *   bonusBombs: number,
 *   specialsUsed: number,
 *   columnHearts: Record<string, number>,
 *   lockedChoice: ResolvedChoice | null,
 *   confirmed: boolean,
 *   skipped: boolean,
 *   score: ScoreBreakdown
 * }} KreuzPlayer
 * @typedef {{ kind: 'column' | 'row' | 'color', index: number, color?: KreuzColor, playerIds: string[], first: boolean, points: number, bonus?: string }} Achievement
 * @typedef {{ seq: number, type: 'start' | 'roll' | 'finish', round: number, achievements: Achievement[], text: string }} KreuzEvent
 * @typedef {{
 *   mode: 'klassisch' | 'erweitert',
 *   boardSize: BoardSize,
 *   board: Board,
 *   phase: 'selecting' | 'waiting' | 'finished',
 *   round: number,
 *   maxRounds: number,
 *   roll: Roll,
 *   confirmedPlayerIds: string[],
 *   activePlayerId: string | null,
 *   startPlayerId: string | null,
 *   activeChoice: ResolvedChoice | null,
 *   activeSkipped: boolean,
 *   claims: Claims,
 *   winnerIds: string[],
 *   winnerId: string | null,
 *   isDraw: boolean,
 *   roundScores: { playerId: string, score: number, breakdown: ScoreBreakdown }[],
 *   higherScoreWins: true,
 *   lastEvent: KreuzEvent | null
 * }} KreuzState
 * @typedef {{ id: string, gameId: 'noch-mal', name: string, status: 'running' | 'finished', createdAt: string, players: KreuzPlayer[], state: KreuzState }} KreuzSession
 * @typedef {{ type?: unknown, choice?: any, cellIds?: unknown, specialCellIds?: unknown, bonusBombCells?: unknown }} KreuzMove
 */

import { BOARD_SIZES, COLORS, generateBoard } from './board.js';
import {
  JOKERS,
  MAX_HEARTS,
  MAX_NUMBER,
  SPECIAL_FACES,
  completedColorCount,
  emptyClaims,
  isColorDone,
  isColumnDone,
  isRowDone,
  scorePlayer,
  validateCombo,
  validateSpecial
} from './rules.js';

export const nochMalGame = {
  id: 'noch-mal',
  name: 'Verrückte Kreuze',
  description: 'Farbe und Zahl würfeln, Blöcke ankreuzen, Spalten und Zeilen füllen – jede Runde auf einem neuen Spielfeld. Mit Sonderwürfel, Bomben und Herzen.',
  previewImage: '/images/noch-mal-scene.webp',
  minPlayers: 1,
  maxPlayers: 6
};

const SOLO_ROUNDS = 30;
/** @type {Record<SpecialKind, string>} */
const SPECIAL_NAMES = { bomb: 'Bombe', heart: 'Herz', stars: 'Sterne', row: 'Drei in einer Zeile', block: 'Farbblock' };
const MAX_ROUNDS = 200;
/** Ab diesem Wurf nimmt der aktive Spieler seine Würfel aus der Auswahl. */
const ADVANTAGE_FROM = 4;

/** @param {number} sides */
function roll(sides) {
  return Math.floor(Math.random() * sides);
}

/** @param {boolean} extended @returns {Roll} */
function rollDice(extended) {
  return {
    id: crypto.randomUUID(),
    colorDice: Array.from({ length: 3 }, () => {
      const face = roll(6);
      return face === 5 ? 'joker' : COLORS[face];
    }),
    numberDice: Array.from({ length: 3 }, () => {
      const face = roll(6);
      return face === 5 ? 'joker' : face + 1;
    }),
    specialDie: extended ? SPECIAL_FACES[roll(SPECIAL_FACES.length)] : null
  };
}

/** @param {KreuzSession} session */
function isExtended(session) {
  return session.state.mode === 'erweitert';
}

/** @param {KreuzSession} session @param {string | null} playerId */
function nameOf(session, playerId) {
  return session.players.find((player) => player.id === playerId)?.name ?? 'Jemand';
}

/** @param {KreuzSession} session */
function isAdvantageRound(session) {
  return session.players.length > 1 && session.state.round >= ADVANTAGE_FROM;
}

/** @param {KreuzSession} session */
function refreshScores(session) {
  for (const player of session.players) {
    player.score = scorePlayer(session.state.board, player, session.state.claims, isExtended(session));
  }
}

/**
 * @param {KreuzSession} session
 * @param {Omit<KreuzEvent, 'seq'>} event
 */
function setEvent(session, event) {
  const seq = (session.state.lastEvent?.seq ?? 0) + 1;
  session.state.lastEvent = { seq, ...event };
}

/**
 * @param {BasicPlayer[]} players
 * @param {Record<string, unknown>} [options]
 * @returns {KreuzSession | { error: string }}
 */
export function createNochMalSession(players, options = {}) {
  const selected = (Array.isArray(players) ? players : []).slice(0, nochMalGame.maxPlayers);
  if (selected.length < nochMalGame.minPlayers) return { error: 'Verrückte Kreuze braucht mindestens einen Spieler.' };

  const mode = options.mode === 'klassisch' ? 'klassisch' : 'erweitert';
  const boardSize = /** @type {BoardSize} */ (Object.hasOwn(BOARD_SIZES, String(options.boardSize)) ? String(options.boardSize) : 'normal');
  const board = generateBoard({ size: boardSize, mode });
  const order = selected.map((player) => player.id);
  const previous = typeof options.previousStarterId === 'string' ? order.indexOf(options.previousStarterId) : -1;
  const startPlayerId = previous >= 0 ? order[(previous + 1) % order.length] : order[0];

  /** @type {KreuzSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: 'noch-mal',
    name: nochMalGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selected.map((player) => ({
      id: player.id,
      name: player.name,
      checkedCells: [],
      lastCells: [],
      usedJokers: 0,
      hearts: 0,
      specialTokens: mode === 'erweitert' ? 1 : 0,
      bonusBombs: 0,
      specialsUsed: 0,
      columnHearts: {},
      lockedChoice: null,
      confirmed: false,
      skipped: false,
      score: { columns: 0, rows: 0, colors: 0, hearts: 0, jokers: JOKERS, tokens: 0, stars: 0, total: 0 }
    })),
    state: {
      mode,
      boardSize,
      board,
      phase: 'selecting',
      round: 1,
      maxRounds: selected.length === 1 ? SOLO_ROUNDS : MAX_ROUNDS,
      roll: rollDice(mode === 'erweitert'),
      confirmedPlayerIds: [],
      activePlayerId: startPlayerId,
      startPlayerId,
      activeChoice: null,
      activeSkipped: false,
      claims: emptyClaims(board),
      winnerIds: [],
      winnerId: null,
      isDraw: false,
      roundScores: [],
      higherScoreWins: true,
      lastEvent: null
    }
  };
  refreshScores(session);
  setEvent(session, { type: 'start', round: 1, achievements: [], text: `Neues Spielfeld (${BOARD_SIZES[boardSize].label}). ${nameOf(session, startPlayerId)} würfelt zuerst.` });
  return session;
}

/**
 * Prüft, welche Würfel der Spieler nehmen darf, und löst Joker auf.
 * Erlaubt sind Farbe + Zahl, der Sonderwürfel oder beides zusammen.
 * @param {KreuzSession} session
 * @param {KreuzPlayer} player
 * @param {any} raw  `{ combo?: { colorDieIndex, numberDieIndex, color?, number? } | null, special?: boolean }`
 * @returns {ResolvedChoice | { error: string }}
 */
function resolveChoice(session, player, raw) {
  const { state } = session;
  const wantsCombo = Boolean(raw?.combo);
  const wantsSpecial = Boolean(raw?.special);
  if (!wantsCombo && !wantsSpecial) return { combo: null, special: null };

  const isActive = state.activePlayerId === player.id;
  const advantage = isAdvantageRound(session);
  if (advantage && !isActive && !state.activeChoice && !state.activeSkipped) {
    return { error: 'Warte, bis der aktive Spieler seine Würfel genommen hat.' };
  }
  if (advantage && isActive && player.lockedChoice) {
    // Der aktive Spieler hat schon festgelegt – der Zug muss genau dazu passen.
    const lockedChoice = player.lockedChoice;
    const sameCombo = lockedChoice.combo
      ? wantsCombo && lockedChoice.combo.colorDieIndex === Number(raw.combo.colorDieIndex) && lockedChoice.combo.numberDieIndex === Number(raw.combo.numberDieIndex)
      : !wantsCombo;
    if (!sameCombo || Boolean(lockedChoice.special) !== wantsSpecial) return { error: 'Du hast deine Würfel schon festgelegt.' };
    return lockedChoice;
  }
  const taken = advantage && !isActive ? state.activeChoice : null;

  /** @type {SpecialKind | null} */
  let special = null;
  if (wantsSpecial) {
    if (!isExtended(session) || !state.roll.specialDie) return { error: 'In diesem Modus gibt es keinen Sonderwürfel.' };
    if (player.specialTokens < 1) return { error: 'Du hast keine Sonderwürfel-Marke mehr.' };
    if (taken?.special) return { error: 'Den Sonderwürfel hat der aktive Spieler genommen.' };
    special = state.roll.specialDie;
  }

  /** @type {ResolvedCombo | null} */
  let combo = null;
  if (wantsCombo) {
    const colorDieIndex = Number(raw.combo.colorDieIndex);
    const numberDieIndex = Number(raw.combo.numberDieIndex);
    if (!Number.isInteger(colorDieIndex) || colorDieIndex < 0 || colorDieIndex >= state.roll.colorDice.length) return { error: 'Dieser Farbwürfel ist ungültig.' };
    if (!Number.isInteger(numberDieIndex) || numberDieIndex < 0 || numberDieIndex >= state.roll.numberDice.length) return { error: 'Dieser Zahlenwürfel ist ungültig.' };
    if (taken?.combo && (taken.combo.colorDieIndex === colorDieIndex || taken.combo.numberDieIndex === numberDieIndex)) {
      return { error: 'Diese Würfel hat der aktive Spieler genommen.' };
    }
    const colorFace = state.roll.colorDice[colorDieIndex];
    const numberFace = state.roll.numberDice[numberDieIndex];
    const color = colorFace === 'joker' ? raw.combo.color : colorFace;
    const number = numberFace === 'joker' ? Number(raw.combo.number) : numberFace;
    if (!COLORS.includes(color)) return { error: 'Wähle eine Farbe für den Joker.' };
    if (!Number.isInteger(number) || number < 1 || number > MAX_NUMBER) return { error: 'Wähle eine Zahl von 1 bis 5 für den Joker.' };
    const jokerCost = (colorFace === 'joker' ? 1 : 0) + (numberFace === 'joker' ? 1 : 0);
    if (player.usedJokers + jokerCost > JOKERS) return { error: 'Du hast nicht mehr genug Joker.' };
    combo = { colorDieIndex, numberDieIndex, color, number, jokerCost };
  }
  return { combo, special };
}

/** @param {unknown} raw */
function readIds(raw) {
  return Array.isArray(raw) ? raw.map(String) : [];
}

/**
 * Vergibt Spalten, Zeilen und Farben nach einem Wurf. Wer im selben Wurf gleichzeitig
 * als Erster fertig wird, bekommt den ersten Wert gemeinsam.
 * @param {KreuzSession} session
 * @returns {Achievement[]}
 */
function resolveClaims(session) {
  const { state } = session;
  const { board, claims } = state;
  const extended = isExtended(session);
  /** @type {Achievement[]} */
  const achievements = [];
  const checkedOf = new Map(session.players.map((player) => [player.id, new Set(player.checkedCells)]));
  /** @param {import('./rules.js').Claim} claim @param {(checked: Set<string>) => boolean} done */
  const newly = (claim, done) =>
    session.players.filter((player) => !claim.first.includes(player.id) && !claim.normal.includes(player.id) && done(/** @type {Set<string>} */ (checkedOf.get(player.id)))).map((player) => player.id);

  claims.columns.forEach((claim, col) => {
    const ids = newly(claim, (checked) => isColumnDone(board, checked, col));
    if (!ids.length) return;
    const first = claim.first.length === 0;
    if (first) claim.first.push(...ids);
    else claim.normal.push(...ids);
    for (const id of ids) {
      const player = /** @type {KreuzPlayer} */ (session.players.find((candidate) => candidate.id === id));
      if (extended && player.hearts > 0) player.columnHearts[String(col)] = player.hearts;
    }
    achievements.push({ kind: 'column', index: col, playerIds: ids, first, points: first ? board.columnPoints.top[col] : board.columnPoints.bottom[col] });
  });

  if (extended) {
    claims.rows.forEach((claim, row) => {
      const ids = newly(claim, (checked) => isRowDone(board, checked, row));
      if (!ids.length) return;
      const first = claim.first.length === 0;
      if (first) claim.first.push(...ids);
      else claim.normal.push(...ids);
      // Den Bonus bekommt jeder, der die Zeile füllt; die 5 Punkte nur der Erste.
      const bonus = board.rowBonus[row];
      for (const id of ids) {
        const player = /** @type {KreuzPlayer} */ (session.players.find((candidate) => candidate.id === id));
        if (bonus === 'bomb') player.bonusBombs += 1;
        else if (bonus === 'token') player.specialTokens += 1;
        else player.hearts = Math.min(MAX_HEARTS, player.hearts + 1);
      }
      achievements.push({ kind: 'row', index: row, playerIds: ids, first, points: first ? 5 : 0, bonus });
    });
  }

  for (const color of COLORS) {
    const claim = claims.colors[color];
    const ids = newly(claim, (checked) => isColorDone(board, checked, color));
    if (!ids.length) continue;
    const first = claim.first.length === 0;
    if (first) claim.first.push(...ids);
    else claim.normal.push(...ids);
    achievements.push({ kind: 'color', index: COLORS.indexOf(color), color, playerIds: ids, first, points: first ? 5 : 3 });
  }
  return achievements;
}

/** @param {KreuzSession} session */
function finishGame(session) {
  const { state } = session;
  refreshScores(session);
  const scores = session.players.map((player) => ({ playerId: player.id, score: player.score.total, breakdown: player.score }));
  const best = Math.max(...scores.map((entry) => entry.score));
  const tied = session.players.filter((player) => player.score.total === best);
  const mostJokers = Math.max(...tied.map((player) => JOKERS - player.usedJokers));
  const winnerIds = tied.filter((player) => JOKERS - player.usedJokers === mostJokers).map((player) => player.id);
  state.phase = 'finished';
  state.winnerIds = winnerIds;
  state.winnerId = winnerIds.length === 1 ? winnerIds[0] : null;
  state.isDraw = winnerIds.length !== 1;
  state.roundScores = scores;
  session.status = 'finished';
}

/** @param {KreuzSession} session */
function nextRoll(session) {
  const { state } = session;
  const achievements = resolveClaims(session);
  refreshScores(session);

  const ended = session.players.some((player) => completedColorCount(state.board, new Set(player.checkedCells)) >= 2) || state.round >= state.maxRounds;
  if (ended) {
    finishGame(session);
    const names = state.winnerIds.map((id) => nameOf(session, id)).join(', ');
    setEvent(session, { type: 'finish', round: state.round, achievements, text: `Spielende! ${state.winnerIds.length === 1 ? `${names} gewinnt.` : `Gleichstand: ${names}.`}` });
    return;
  }

  const order = session.players.map((player) => player.id);
  state.round += 1;
  state.roll = rollDice(isExtended(session));
  state.phase = 'selecting';
  state.confirmedPlayerIds = [];
  state.activePlayerId = order[(order.indexOf(state.activePlayerId ?? order[0]) + 1) % order.length];
  state.activeChoice = null;
  state.activeSkipped = false;
  for (const player of session.players) {
    player.confirmed = false;
    player.skipped = false;
    player.lockedChoice = null;
  }
  setEvent(session, { type: 'roll', round: state.round, achievements, text: `Wurf ${state.round}: ${nameOf(session, state.activePlayerId)} ist aktiv.` });
}

/** @param {KreuzSession} session @param {KreuzPlayer} player */
function confirm(session, player) {
  player.confirmed = true;
  session.state.confirmedPlayerIds = [...new Set([...session.state.confirmedPlayerIds, player.id])];
  if (session.players.every((candidate) => candidate.confirmed)) nextRoll(session);
  else session.state.phase = 'waiting';
}

/**
 * @param {KreuzSession} session
 * @param {string} playerId
 * @param {KreuzMove} move
 * @returns {{ session: KreuzSession } | { error: string }}
 */
export function makeNochMalMove(session, playerId, move) {
  const { state } = session;
  if (session.status !== 'running') return { error: 'Das Spiel ist schon beendet.' };
  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) return { error: 'Du schaust dieser Runde nur zu.' };
  if (player.confirmed) return { error: 'Du hast diesen Wurf schon bestätigt.' };
  const type = String(move?.type ?? '');
  const isActive = state.activePlayerId === playerId;

  if (type === 'lock-choice') {
    if (!isAdvantageRound(session) || !isActive) return { error: 'Festlegen muss nur der aktive Spieler ab dem 4. Wurf.' };
    if (player.lockedChoice) return { error: 'Du hast deine Würfel schon festgelegt.' };
    const choice = resolveChoice(session, player, move.choice);
    if ('error' in choice) return choice;
    if (!choice.combo && !choice.special) return { error: 'Zum Aussetzen nutze „Aussetzen“.' };
    player.lockedChoice = choice;
    state.activeChoice = choice;
    return { session };
  }

  if (type === 'skip-turn') {
    player.skipped = true;
    player.lastCells = [];
    if (isActive && !player.lockedChoice) state.activeSkipped = true;
    confirm(session, player);
    return { session };
  }

  if (type !== 'submit-turn') return { error: 'Diese Aktion ist nicht bekannt.' };

  const choice = resolveChoice(session, player, move.choice);
  if ('error' in choice) return choice;
  const checked = new Set(player.checkedCells);
  const cellIds = readIds(move.cellIds);
  const specialIds = readIds(move.specialCellIds);

  // Zuerst Farbe + Zahl, danach darf die Sonderaktion schon an die neuen Kreuze anschließen.
  if (choice.combo) {
    const error = validateCombo(state.board, checked, choice.combo.color, choice.combo.number, cellIds);
    if (error) return { error };
  } else if (cellIds.length) {
    return { error: 'Ohne Farb- und Zahlenwürfel kannst du hier keine Felder ankreuzen.' };
  }
  const afterCombo = new Set([...checked, ...cellIds]);
  if (choice.special) {
    const error = validateSpecial(state.board, afterCombo, choice.special, specialIds);
    if (error) return { error: `${SPECIAL_NAMES[choice.special]}: ${error}` };
  } else if (specialIds.length) {
    return { error: 'Ohne Sonderwürfel gibt es keine Sonderfelder.' };
  }

  // Bonusbombe aus einem Zeilenbonus: zusätzlich, nach allem anderen.
  const bombIds = readIds(move.bonusBombCells);
  if (bombIds.length) {
    if (player.bonusBombs < 1) return { error: 'Du hast keine Bonusbombe.' };
    const after = new Set([...afterCombo, ...specialIds]);
    const error = validateSpecial(state.board, after, 'bomb', bombIds);
    if (error) return { error: `Bonusbombe: ${error}` };
  }
  const usesDice = Boolean(choice.combo || choice.special);
  if (!usesDice && !bombIds.length) return { error: 'Wähle Würfel oder setze aus.' };

  // Anwenden
  if (isAdvantageRound(session) && isActive && !state.activeChoice) {
    if (usesDice) state.activeChoice = choice;
    else state.activeSkipped = true;
  }
  const newCells = [...cellIds, ...specialIds, ...bombIds];
  if (choice.combo) player.usedJokers += choice.combo.jokerCost;
  if (choice.special) {
    player.specialTokens -= 1;
    player.specialsUsed += 1;
    if (choice.special === 'heart') player.hearts = Math.min(MAX_HEARTS, player.hearts + 1);
  }
  if (bombIds.length) player.bonusBombs -= 1;
  player.checkedCells = [...player.checkedCells, ...newCells];
  player.lastCells = newCells;
  if (isExtended(session)) {
    const gold = state.board.cells.filter((cell) => cell.gold && newCells.includes(cell.id)).length;
    player.specialTokens += gold;
  }
  player.score = scorePlayer(state.board, player, state.claims, isExtended(session));
  confirm(session, player);
  return { session };
}
