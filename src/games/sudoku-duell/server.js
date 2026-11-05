/**
 * Sudoku-Duell – alle lösen gleichzeitig dasselbe Sudoku. Wer zuerst fertig ist, gewinnt.
 *
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {'leicht' | 'mittel' | 'schwer'} SudokuDifficulty
 * @typedef {{
 *   id: string,
 *   name: string,
 *   entries: number[],
 *   filledCount: number,
 *   progress: number,
 *   mistakes: number,
 *   finished: boolean,
 *   gaveUp: boolean,
 *   blockedUntil: number | null,
 *   lastMistakeCell: number | null
 * }} SudokuPlayer
 * @typedef {'start' | 'place' | 'mistake' | 'give-up' | 'win' | 'draw'} SudokuEventType
 * @typedef {{ seq: number, type: SudokuEventType, playerId: string | null, text: string, cell?: number, value?: number }} SudokuEvent
 * @typedef {{
 *   currentPlayerId: null,
 *   winnerId: string | null,
 *   isDraw: boolean,
 *   difficulty: SudokuDifficulty,
 *   givens: number[],
 *   givenCount: number,
 *   emptyCount: number,
 *   solution?: number[],
 *   startedAt: number,
 *   finishedAt: Record<string, number>,
 *   gaveUpAt: Record<string, number>,
 *   blockMs: number,
 *   moveCount: number,
 *   serverNow?: number,
 *   lastEvent: SudokuEvent | null
 * }} SudokuState
 * @typedef {{ id: string, gameId: string, name: string, status: 'running' | 'finished', createdAt: string, players: SudokuPlayer[], state: SudokuState }} SudokuSession
 * @typedef {{ type?: unknown, cell?: unknown, value?: unknown }} SudokuMove
 * @typedef {{ now?: number }} SudokuMoveOptions
 */

export const sudokuDuellGame = {
  id: 'sudoku-duell',
  name: 'Sudoku-Duell',
  description: 'Alle lösen gleichzeitig dasselbe Sudoku. Falsche Zahlen sperren dich kurz – wer zuerst fertig ist, gewinnt.',
  previewImage: '/images/sudoku-duell-scene.webp',
  minPlayers: 2,
  maxPlayers: 8
};

/** Givens per difficulty. */
export const SUDOKU_GIVENS = /** @type {Record<SudokuDifficulty, number>} */ ({ leicht: 40, mittel: 32, schwer: 26 });
export const SUDOKU_DIFFICULTIES = /** @type {SudokuDifficulty[]} */ (['leicht', 'mittel', 'schwer']);
/** Cooldown after a wrong number. */
export const SUDOKU_BLOCK_MS = 5000;

/* ------------------------------------------------------------------ */
/* Solver / generator (bitmask backtracking with fewest-candidates)    */
/* ------------------------------------------------------------------ */

const ROW_OF = new Int8Array(81);
const COL_OF = new Int8Array(81);
const BOX_OF = new Int8Array(81);
for (let cell = 0; cell < 81; cell += 1) {
  ROW_OF[cell] = Math.floor(cell / 9);
  COL_OF[cell] = cell % 9;
  BOX_OF[cell] = Math.floor(ROW_OF[cell] / 3) * 3 + Math.floor(COL_OF[cell] / 3);
}
const ALL = 0x3fe; // bits 1..9

/** @param {number} mask */
function bitCount(mask) {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count += 1;
  }
  return count;
}

/**
 * Counts solutions of a grid (0 = empty) up to `limit`. If `random` is set, candidates are
 * tried in random order and the first solution is written into `out`.
 * @param {number[]} grid
 * @param {number} limit
 * @param {{ random?: boolean, out?: number[] }} [opts]
 */
export function countSudokuSolutions(grid, limit = 2, opts = {}) {
  const cells = Int8Array.from(grid);
  const rows = new Int16Array(9);
  const cols = new Int16Array(9);
  const boxes = new Int16Array(9);
  for (let cell = 0; cell < 81; cell += 1) {
    const value = cells[cell];
    if (!value) continue;
    const bit = 1 << value;
    if ((rows[ROW_OF[cell]] | cols[COL_OF[cell]] | boxes[BOX_OF[cell]]) & bit) return 0;
    rows[ROW_OF[cell]] |= bit;
    cols[COL_OF[cell]] |= bit;
    boxes[BOX_OF[cell]] |= bit;
  }
  let found = 0;

  /** @returns {boolean} true to stop */
  function search() {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let cell = 0; cell < 81; cell += 1) {
      if (cells[cell]) continue;
      const mask = ALL & ~(rows[ROW_OF[cell]] | cols[COL_OF[cell]] | boxes[BOX_OF[cell]]);
      const count = bitCount(mask);
      if (count === 0) return false;
      if (count < bestCount) {
        best = cell;
        bestMask = mask;
        bestCount = count;
        if (count === 1) break;
      }
    }
    if (best === -1) {
      found += 1;
      if (found === 1 && opts.out) {
        for (let cell = 0; cell < 81; cell += 1) opts.out[cell] = cells[cell];
      }
      return found >= limit;
    }
    /** @type {number[]} */
    const values = [];
    for (let value = 1; value <= 9; value += 1) if (bestMask & (1 << value)) values.push(value);
    if (opts.random) shuffleInPlace(values);
    const r = ROW_OF[best];
    const c = COL_OF[best];
    const b = BOX_OF[best];
    for (const value of values) {
      const bit = 1 << value;
      cells[best] = value;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      const stop = search();
      cells[best] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      if (stop) return true;
    }
    return false;
  }

  search();
  return found;
}

/** @param {number[]} items */
function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

/** @returns {number[]} a random complete, valid grid */
function randomSolvedGrid() {
  const out = new Array(81).fill(0);
  countSudokuSolutions(new Array(81).fill(0), 1, { random: true, out });
  return out;
}

/**
 * Generates a puzzle with exactly one solution and (if at all possible) exactly `targetGivens` givens.
 * @param {number} targetGivens
 * @returns {{ puzzle: number[], solution: number[] }}
 */
export function generateSudoku(targetGivens = SUDOKU_GIVENS.mittel) {
  const target = Math.max(17, Math.min(81, Math.round(targetGivens)));
  /** @type {{ puzzle: number[], solution: number[] } | null} */
  let best = null;
  let bestGivens = 82;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const solution = randomSolvedGrid();
    const puzzle = [...solution];
    let givens = 81;
    const order = shuffleInPlace(Array.from({ length: 81 }, (_, index) => index));
    for (const cell of order) {
      if (givens <= target) break;
      const kept = puzzle[cell];
      puzzle[cell] = 0;
      if (countSudokuSolutions(puzzle, 2) === 1) {
        givens -= 1;
      } else {
        puzzle[cell] = kept;
      }
    }
    if (givens === target) return { puzzle, solution };
    if (givens < bestGivens) {
      best = { puzzle, solution };
      bestGivens = givens;
    }
  }
  return /** @type {{ puzzle: number[], solution: number[] }} */ (best);
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

/** @param {SudokuSession} session @param {string | null} playerId */
function nameOf(session, playerId) {
  return session.players.find((player) => player.id === playerId)?.name ?? 'Jemand';
}

/**
 * @param {SudokuSession} session
 * @param {Omit<SudokuEvent, 'seq'>} event
 */
function setEvent(session, event) {
  const seq = (session.state.lastEvent?.seq ?? 0) + 1;
  session.state.lastEvent = { seq, ...event };
}

/** @param {unknown} value */
function normalizeDifficulty(value) {
  return SUDOKU_DIFFICULTIES.includes(/** @type {SudokuDifficulty} */ (value)) ? /** @type {SudokuDifficulty} */ (value) : 'mittel';
}

/**
 * @param {BasicPlayer[]} players
 * @param {{ difficulty?: unknown, [key: string]: unknown }} [options]
 * @returns {SudokuSession | { error: string }}
 */
export function createSudokuDuellSession(players, options = {}) {
  const selected = (Array.isArray(players) ? players : []).slice(0, sudokuDuellGame.maxPlayers);
  if (selected.length < sudokuDuellGame.minPlayers) {
    return { error: 'Sudoku-Duell braucht mindestens zwei Spieler.' };
  }
  const difficulty = normalizeDifficulty(options?.difficulty);
  const { puzzle, solution } = generateSudoku(SUDOKU_GIVENS[difficulty]);
  const givenCount = puzzle.filter(Boolean).length;
  const now = Date.now();

  /** @type {SudokuSession} */
  const session = {
    id: crypto.randomUUID(),
    gameId: sudokuDuellGame.id,
    name: sudokuDuellGame.name,
    status: 'running',
    createdAt: new Date(now).toISOString(),
    players: selected.map((player) => ({
      id: player.id,
      name: player.name,
      entries: new Array(81).fill(0),
      filledCount: 0,
      progress: 0,
      mistakes: 0,
      finished: false,
      gaveUp: false,
      blockedUntil: null,
      lastMistakeCell: null
    })),
    state: {
      currentPlayerId: null,
      winnerId: null,
      isDraw: false,
      difficulty,
      givens: puzzle,
      givenCount,
      emptyCount: 81 - givenCount,
      solution,
      startedAt: now,
      finishedAt: {},
      gaveUpAt: {},
      blockMs: SUDOKU_BLOCK_MS,
      moveCount: 0,
      lastEvent: null
    }
  };
  const label = { leicht: 'leichtes', mittel: 'mittelschweres', schwer: 'schweres' }[difficulty];
  setEvent(session, { type: 'start', playerId: null, text: `Ein ${label} Sudoku mit ${givenCount} Vorgaben. Los geht’s!` });
  return session;
}

/**
 * @param {SudokuSession} session
 * @param {string} playerId
 * @param {SudokuMove} move
 * @param {SudokuMoveOptions} [options] `now` (ms) can be injected for tests.
 * @returns {{ session: SudokuSession } | { error: string }}
 */
export function makeSudokuDuellMove(session, playerId, move, options = {}) {
  const now = Number.isFinite(options?.now) ? /** @type {number} */ (options.now) : Date.now();
  if (!session || session.gameId !== sudokuDuellGame.id) return { error: 'Ungültige Spielsitzung.' };
  if (session.status !== 'running') return { error: 'Das Spiel ist bereits beendet.' };
  const player = session.players.find((entry) => entry.id === playerId);
  if (!player) return { error: 'Du spielst in dieser Runde nicht mit.' };
  if (player.gaveUp) return { error: 'Du hast bereits aufgegeben.' };
  if (player.finished) return { error: 'Du bist schon fertig.' };
  const type = move?.type;
  const { state } = session;
  const solution = /** @type {number[]} */ (state.solution);

  if (type === 'give-up') {
    player.gaveUp = true;
    player.blockedUntil = null;
    state.gaveUpAt[player.id] = now;
    state.moveCount += 1;
    const active = session.players.filter((entry) => !entry.gaveUp && !entry.finished);
    if (active.length === 0) {
      session.status = 'finished';
      state.winnerId = null;
      state.isDraw = true;
      setEvent(session, { type: 'draw', playerId: player.id, text: 'Alle haben aufgegeben. Diesmal gewinnt niemand.' });
    } else {
      setEvent(session, { type: 'give-up', playerId: player.id, text: `${player.name} gibt auf.` });
    }
    return { session };
  }

  if (type !== 'place') return { error: 'Unbekannter Zug.' };

  const cell = move?.cell;
  const value = move?.value;
  if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 80) return { error: 'Dieses Feld gibt es nicht.' };
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 9) return { error: 'Nur die Zahlen 1 bis 9 sind erlaubt.' };
  if (player.blockedUntil && now < player.blockedUntil) {
    const seconds = Math.ceil((player.blockedUntil - now) / 1000);
    return { error: `Du bist noch ${seconds} ${seconds === 1 ? 'Sekunde' : 'Sekunden'} gesperrt.` };
  }
  if (state.givens[cell]) return { error: 'Vorgaben kann man nicht ändern.' };
  if (player.entries[cell]) return { error: 'Dieses Feld hast du schon gelöst.' };

  state.moveCount += 1;
  if (solution[cell] !== value) {
    // Wrong number: not stored, but counted and punished with a cooldown.
    player.mistakes += 1;
    player.blockedUntil = now + SUDOKU_BLOCK_MS;
    player.lastMistakeCell = cell;
    setEvent(session, {
      type: 'mistake',
      playerId: player.id,
      cell,
      value,
      text: `${player.name} lag daneben und ist ${SUDOKU_BLOCK_MS / 1000} Sekunden gesperrt.`
    });
    return { session };
  }

  player.entries[cell] = value;
  player.filledCount += 1;
  player.progress = state.emptyCount ? player.filledCount / state.emptyCount : 1;
  player.blockedUntil = null;

  if (player.filledCount >= state.emptyCount) {
    player.finished = true;
    player.progress = 1;
    state.finishedAt[player.id] = now;
    session.status = 'finished';
    state.winnerId = player.id;
    state.isDraw = false;
    setEvent(session, { type: 'win', playerId: player.id, cell, value, text: `${player.name} hat das Sudoku zuerst gelöst!` });
    return { session };
  }

  setEvent(session, { type: 'place', playerId: player.id, cell, value, text: `${nameOf(session, player.id)} hat ein Feld gelöst.` });
  return { session };
}

/**
 * Receives a deep clone. The solution never leaves the server; each player only sees their own entries.
 * @param {SudokuSession} session
 * @param {string | null} viewerId
 */
export function redactSudokuDuellSession(session, viewerId) {
  const state = /** @type {Partial<SudokuState>} */ (session.state);
  delete state.solution;
  for (const player of session.players) {
    if (session.status !== 'finished' && (!viewerId || player.id !== viewerId)) {
      player.entries = [];
      player.lastMistakeCell = null;
    }
  }
  const event = state.lastEvent;
  if (event && (!viewerId || event.playerId !== viewerId)) {
    delete event.cell;
    delete event.value;
  }
  state.serverNow = Date.now();
  return session;
}
